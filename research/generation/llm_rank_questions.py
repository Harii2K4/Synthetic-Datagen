from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import Logger

load_dotenv()

NUM_ROUNDS = 50
RANDOM_SEED: int | None = None
QUESTION_COLUMN = "Question"
DATASET_FILES = (
    "math_evol.csv",
    "math_persona.csv",
    "math_persona_general.csv",
)
DATASET_IDS = tuple(Path(file_name).stem for file_name in DATASET_FILES)
BORDA_POINTS_BY_RANK = {
    1: 3,
    2: 2,
    3: 1,
}
SYSTEM_PROMPT = """
You are serving as an expert evaluator for a research study on synthetic math-problem generation.
You will compare three generated math questions, each tagged with a dataset_id.
Rank them from best to worst using these criteria together:
- mathematical coherence and correctness
- clarity and unambiguity
- appropriate difficulty and reasoning depth
- originality and non-triviality
- usefulness as a high-quality benchmark or training sample

Be strict but fair.
Return only valid JSON with this exact schema:
{
  "ranking": ["math_evol", "math_persona", "math_persona_general"]
}
The ranking array must contain all three dataset IDs exactly once, ordered from best to worst.
""".strip()
JSON_BLOCK_PATTERN = re.compile(r"\{.*\}", re.DOTALL)
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_JSON = SCRIPT_DIR / "results" / "llm_judge" / "llm_question_ranking_summary.json"
LOG = Logger(__name__)

RANKING_MODELS: dict[str, ChatOpenRouter] = {
    "gpt-5.4-mini": ChatOpenRouter(
        model="openai/gpt-5.4-mini",
        temperature=0,
        reasoning={"effort": "minimal"},
    ),
    "gemini-3-flash-preview": ChatOpenRouter(
        model="google/gemini-3-flash-preview",
        temperature=0,
        reasoning={"effort": "minimal"},
    ),
    "claude-haiku-4.5": ChatOpenRouter(
        model="anthropic/claude-haiku-4.5",
        temperature=0,
        reasoning={"effort": "none"},
    ),
    "groq-4": ChatOpenRouter(
        model="x-ai/grok-4-fast",
        temperature=0,
        reasoning={"effort": "minimal"},
    ),
}


def with_timestamp_suffix(path: Path, timestamp: str) -> Path:
    return path.with_name(f"{path.stem}_{timestamp}{path.suffix}")


def load_dataset_questions(csv_path: Path) -> dict[str, Any]:
    frame = pd.read_csv(csv_path)
    if QUESTION_COLUMN not in frame.columns:
        raise ValueError(
            f"Dataset {csv_path.name} is missing required column: {QUESTION_COLUMN}"
        )

    questions = frame[QUESTION_COLUMN].fillna("").astype(str).tolist()
    entries = [
        {
            "rowIndex": index,
            "question": question.strip(),
        }
        for index, question in enumerate(questions)
        if question.strip()
    ]
    if not entries:
        raise ValueError(
            f"Dataset {csv_path.name} does not contain any usable questions."
        )

    return {
        "datasetId": csv_path.stem,
        "questionCount": len(entries),
        "entries": entries,
    }


def build_round_specs(
    datasets: list[dict[str, Any]],
    rounds_requested: int,
    rng: random.Random,
) -> list[dict[str, Any]]:
    max_available_rounds = min(dataset["questionCount"] for dataset in datasets)
    rounds_to_run = min(rounds_requested, max_available_rounds)

    if rounds_to_run < rounds_requested:
        LOG.warning(
            f"Requested {rounds_requested} rounds, but only {rounds_to_run} can be run without replacement."
        )

    draws_by_dataset: dict[str, list[dict[str, Any]]] = {}
    for dataset in datasets:
        dataset_entries = list(dataset["entries"])
        rng.shuffle(dataset_entries)
        draws_by_dataset[dataset["datasetId"]] = dataset_entries[:rounds_to_run]

    rounds: list[dict[str, Any]] = []
    for round_index in range(rounds_to_run):
        samples: dict[str, dict[str, Any]] = {}
        prompt_order: list[str] = []
        for dataset in datasets:
            dataset_id = dataset["datasetId"]
            selected_entry = draws_by_dataset[dataset_id][round_index]
            samples[dataset_id] = selected_entry
            prompt_order.append(dataset_id)

        rng.shuffle(prompt_order)
        rounds.append(
            {
                "round": round_index + 1,
                "samples": samples,
                "promptOrder": prompt_order,
            }
        )

    return rounds


def build_messages(round_spec: dict[str, Any]) -> list[BaseMessage]:
    prompt_lines = [
        "Compare the following three generated math questions and rank them from best to worst.",
        "",
        "Return only valid JSON matching the required schema.",
        "",
    ]

    for display_index, dataset_id in enumerate(round_spec["promptOrder"], start=1):
        question = round_spec["samples"][dataset_id]["question"]
        prompt_lines.extend(
            [
                f"Question {display_index}",
                f"dataset_id: {dataset_id}",
                question,
                "",
            ]
        )

    return [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content="\n".join(prompt_lines).strip()),
    ]


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        match = JSON_BLOCK_PATTERN.search(cleaned)
        if match is None:
            raise ValueError(f"Could not find JSON object in model response: {cleaned}")
        payload = json.loads(match.group(0))

    if not isinstance(payload, dict):
        raise ValueError("Ranking response must decode to a JSON object.")
    return payload


def parse_ranking(response: AIMessage) -> list[str]:
    payload = extract_json_object(str(response.content))
    ranking = payload.get("ranking")
    if not isinstance(ranking, list):
        raise ValueError(f"Ranking response is missing ranking array: {payload}")

    normalized_ranking = [str(item).strip() for item in ranking]
    expected_ids = set(DATASET_IDS)
    if len(normalized_ranking) != len(DATASET_IDS):
        raise ValueError(
            f"Ranking must contain exactly {len(DATASET_IDS)} dataset IDs."
        )
    if len(set(normalized_ranking)) != len(DATASET_IDS):
        raise ValueError(
            f"Ranking contains duplicate dataset IDs: {normalized_ranking}"
        )
    if set(normalized_ranking) != expected_ids:
        raise ValueError(
            f"Ranking must contain exactly these dataset IDs: {sorted(expected_ids)}"
        )

    return normalized_ranking


def create_model_summary() -> dict[str, Any]:
    return {
        "validRoundCount": 0,
        "invalidResponseCount": 0,
        "datasetStats": {
            dataset_id: {
                "pointsTotal": 0,
                "rankSum": 0.0,
                "firstPlaceCount": 0,
                "secondPlaceCount": 0,
                "thirdPlaceCount": 0,
            }
            for dataset_id in DATASET_IDS
        },
    }


def update_summary_for_ranking(summary: dict[str, Any], ranking: list[str]) -> None:
    summary["validRoundCount"] += 1
    for rank_position, dataset_id in enumerate(ranking, start=1):
        dataset_stats = summary["datasetStats"][dataset_id]
        dataset_stats["pointsTotal"] += BORDA_POINTS_BY_RANK[rank_position]
        dataset_stats["rankSum"] += rank_position
        if rank_position == 1:
            dataset_stats["firstPlaceCount"] += 1
        elif rank_position == 2:
            dataset_stats["secondPlaceCount"] += 1
        else:
            dataset_stats["thirdPlaceCount"] += 1


def finalize_model_summary(summary: dict[str, Any]) -> dict[str, Any]:
    valid_round_count = int(summary["validRoundCount"])
    finalized_dataset_stats: dict[str, dict[str, int | float | None]] = {}

    for dataset_id, dataset_stats in summary["datasetStats"].items():
        average_rank = None
        if valid_round_count > 0:
            average_rank = round(dataset_stats["rankSum"] / valid_round_count, 4)

        finalized_dataset_stats[dataset_id] = {
            "pointsTotal": int(dataset_stats["pointsTotal"]),
            "averageRank": average_rank,
            "firstPlaceCount": int(dataset_stats["firstPlaceCount"]),
            "secondPlaceCount": int(dataset_stats["secondPlaceCount"]),
            "thirdPlaceCount": int(dataset_stats["thirdPlaceCount"]),
        }

    return {
        "validRoundCount": valid_round_count,
        "invalidResponseCount": int(summary["invalidResponseCount"]),
        "datasetStats": finalized_dataset_stats,
    }


def evaluate_rounds_with_model(
    rounds: list[dict[str, Any]],
    model_name: str,
    ranking_model: ChatOpenRouter,
    max_concurrency: int,
) -> dict[str, Any]:
    batched_messages = [build_messages(round_spec) for round_spec in rounds]
    config = RunnableConfig(max_concurrency=max_concurrency)

    LOG.info(f"Evaluating {len(rounds)} ranking rounds with model {model_name}")
    responses = ranking_model.batch(
        cast(list[Any], batched_messages),
        return_exceptions=True,
        config=config,
    )

    summary = create_model_summary()
    for round_index, result in enumerate(responses, start=1):
        if isinstance(result, Exception):
            summary["invalidResponseCount"] += 1
            LOG.warning(
                f"Ranking call failed for model {model_name} round {round_index}: {result}"
            )
            continue

        try:
            ranking = parse_ranking(result)
        except Exception as exc:
            summary["invalidResponseCount"] += 1
            LOG.warning(
                f"Could not parse ranking response for model {model_name} round {round_index}: {exc}"
            )
            continue

        update_summary_for_ranking(summary, ranking)

    return finalize_model_summary(summary)


def build_output_payload(
    rounds_requested: int,
    rounds_completed: int,
    random_seed: int | None,
    per_model_results: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        "runMetadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "roundsRequested": rounds_requested,
            "roundsCompleted": rounds_completed,
            "datasets": list(DATASET_IDS),
            "models": list(RANKING_MODELS.keys()),
            "sampling": "without_replacement_until_exhausted",
            "randomSeed": random_seed,
            "scoring": {
                "borda": {
                    str(rank): points for rank, points in BORDA_POINTS_BY_RANK.items()
                },
                "rankMetric": "lower_is_better",
            },
        },
        "perModel": per_model_results,
    }


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--datasets-dir",
        type=Path,
        default=SCRIPT_DIR / "datasets",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=DEFAULT_OUTPUT_JSON,
    )
    parser.add_argument(
        "--max-concurrency",
        type=int,
        default=10,
    )
    parser.add_argument(
        "--rounds",
        type=int,
        default=NUM_ROUNDS,
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=RANDOM_SEED,
    )
    args = parser.parse_args()

    datasets_dir = args.datasets_dir.resolve()
    output_json = args.output_json.resolve()
    run_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_json = with_timestamp_suffix(output_json, run_timestamp)

    if not os.getenv("OPENROUTER_API_KEY"):
        raise EnvironmentError("OPENROUTER_API_KEY is not set.")
    if not datasets_dir.exists():
        raise FileNotFoundError(f"Datasets directory not found: {datasets_dir}")
    if args.rounds <= 0:
        raise ValueError("--rounds must be a positive integer.")

    output_json.parent.mkdir(parents=True, exist_ok=True)

    csv_paths = [datasets_dir / file_name for file_name in DATASET_FILES]
    missing_paths = [str(path) for path in csv_paths if not path.exists()]
    if missing_paths:
        raise FileNotFoundError(f"Missing dataset files: {missing_paths}")

    datasets = [load_dataset_questions(csv_path) for csv_path in csv_paths]
    rng = random.Random(args.seed)
    rounds = build_round_specs(datasets=datasets, rounds_requested=args.rounds, rng=rng)
    if not rounds:
        raise ValueError(
            "No ranking rounds could be created from the available datasets."
        )

    per_model_results: dict[str, dict[str, Any]] = {}
    for model_name, ranking_model in RANKING_MODELS.items():
        per_model_results[model_name] = evaluate_rounds_with_model(
            rounds=rounds,
            model_name=model_name,
            ranking_model=ranking_model,
            max_concurrency=args.max_concurrency,
        )

    payload = build_output_payload(
        rounds_requested=args.rounds,
        rounds_completed=len(rounds),
        random_seed=args.seed,
        per_model_results=per_model_results,
    )
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote LLM ranking summary to {output_json}")


if __name__ == "__main__":
    main()
