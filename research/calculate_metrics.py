from __future__ import annotations

import argparse
import ast
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from umap import UMAP


QUESTION_COLUMN = "Question"
TOPIC_COLUMN = "topic"
EMBEDDINGS_COLUMN = "embeddings"
TOKEN_PATTERN = re.compile(r"\w+|[^\w\s]", re.UNICODE)


def dataset_label_from_stem(dataset_stem: str) -> str:
    return dataset_stem.replace("_", " ").title()


def normalize_topic(value: Any) -> str:
    if pd.isna(value):
        return "Unknown"
    normalized = str(value).strip()
    return normalized or "Unknown"


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(str(text).lower())


def parse_embedding(
    raw_embedding: Any, dataset_name: str, row_index: int
) -> list[float]:
    if isinstance(raw_embedding, list):
        return [float(value) for value in raw_embedding]
    if pd.isna(raw_embedding):
        raise ValueError(f"Missing embedding in {dataset_name} at row {row_index}.")
    try:
        parsed = ast.literal_eval(str(raw_embedding))
    except (SyntaxError, ValueError) as exc:
        raise ValueError(
            f"Could not parse embedding in {dataset_name} at row {row_index}."
        ) from exc
    if not isinstance(parsed, list):
        raise ValueError(
            f"Embedding in {dataset_name} at row {row_index} is not a list."
        )
    return [float(value) for value in parsed]


def round_or_none(value: float | None, decimals: int = 6) -> float | None:
    if value is None:
        return None
    return round(float(value), decimals)


def build_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    if embeddings.ndim != 2:
        raise ValueError("Embeddings must be a 2D matrix.")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized = embeddings / norms
    similarity_matrix = normalized @ normalized.T
    return np.clip(similarity_matrix, -1.0, 1.0)


def upper_triangle_values(similarity_matrix: np.ndarray) -> np.ndarray:
    if similarity_matrix.shape[0] < 2:
        return np.array([], dtype=float)
    return similarity_matrix[np.triu_indices(similarity_matrix.shape[0], k=1)]


def nearest_neighbor_values(similarity_matrix: np.ndarray) -> np.ndarray:
    if similarity_matrix.shape[0] < 2:
        return np.array([], dtype=float)
    masked = similarity_matrix.copy()
    np.fill_diagonal(masked, -np.inf)
    return masked.max(axis=1)


def compute_topic_entropy(topics: list[str]) -> float:
    if not topics:
        return 0.0
    counts = Counter(topics)
    total = sum(counts.values())
    entropy = 0.0
    for count in counts.values():
        probability = count / total
        entropy -= probability * math.log(probability)
    return entropy


def compute_distinct_2(texts: list[str]) -> float:
    unique_bigrams: set[tuple[str, str]] = set()
    total_bigrams = 0
    for text in texts:
        tokens = tokenize(text)
        if len(tokens) < 2:
            continue
        for bigram in zip(tokens, tokens[1:]):
            unique_bigrams.add(bigram)
            total_bigrams += 1
    if total_bigrams == 0:
        return 0.0
    return len(unique_bigrams) / total_bigrams


def load_dataset(csv_path: Path) -> dict[str, Any]:
    frame = pd.read_csv(csv_path)
    required_columns = {QUESTION_COLUMN, TOPIC_COLUMN, EMBEDDINGS_COLUMN}
    missing_columns = sorted(required_columns - set(frame.columns))
    if missing_columns:
        raise ValueError(
            f"Dataset {csv_path.name} is missing required columns: {', '.join(missing_columns)}"
        )

    questions = frame[QUESTION_COLUMN].fillna("").astype(str).tolist()
    topics = [normalize_topic(topic) for topic in frame[TOPIC_COLUMN].tolist()]
    embeddings = [
        parse_embedding(raw_embedding, csv_path.name, row_index)
        for row_index, raw_embedding in enumerate(frame[EMBEDDINGS_COLUMN].tolist())
    ]

    embedding_dimensions = {len(vector) for vector in embeddings}
    if len(embedding_dimensions) != 1:
        raise ValueError(
            f"Dataset {csv_path.name} has inconsistent embedding dimensions: {sorted(embedding_dimensions)}"
        )

    return {
        "datasetId": csv_path.stem,
        "datasetLabel": dataset_label_from_stem(csv_path.stem),
        "sourceFile": str(csv_path),
        "questions": questions,
        "topics": topics,
        "embeddings": np.asarray(embeddings, dtype=float),
    }


def compute_dataset_metrics(dataset: dict[str, Any]) -> dict[str, Any]:
    embeddings = dataset["embeddings"]
    similarity_matrix = build_similarity_matrix(embeddings)
    pairwise_values = upper_triangle_values(similarity_matrix)
    nn_values = nearest_neighbor_values(similarity_matrix)
    topic_counts = Counter(dataset["topics"])
    total_samples = int(len(dataset["questions"]))

    metrics = {
        "sampleCount": total_samples,
        "embeddingDimension": int(embeddings.shape[1])
        if embeddings.ndim == 2 and embeddings.size
        else 0,
        "meanPairwiseCosineSimilarity": round_or_none(
            float(np.mean(pairwise_values)) if pairwise_values.size else None
        ),
        "p90PairwiseSimilarity": round_or_none(
            float(np.percentile(pairwise_values, 90)) if pairwise_values.size else None
        ),
        "meanNearestNeighborSimilarity": round_or_none(
            float(np.mean(nn_values)) if nn_values.size else None
        ),
        "topicEntropy": round_or_none(compute_topic_entropy(dataset["topics"])),
        "uniqueTopicCount": int(len(topic_counts)),
        "distinct2": round_or_none(compute_distinct_2(dataset["questions"])),
    }

    topic_distribution = [
        {
            "topic": topic,
            "count": int(count),
            "percentage": round_or_none(
                (count / total_samples) * 100 if total_samples else 0.0
            ),
        }
        for topic, count in sorted(
            topic_counts.items(), key=lambda item: (-item[1], item[0])
        )
    ]

    return {
        "datasetId": dataset["datasetId"],
        "datasetLabel": dataset["datasetLabel"],
        "sourceFile": dataset["sourceFile"],
        "metrics": metrics,
        "topicDistribution": topic_distribution,
        "pairwiseSimilarityValues": pairwise_values.tolist(),
        "nearestNeighborSimilarityValues": nn_values.tolist(),
        "embeddings": embeddings,
        "topics": dataset["topics"],
    }


def generate_umap_plot(
    dataset_results: list[dict[str, Any]], output_path: Path
) -> None:
    if not dataset_results:
        raise ValueError("No dataset results available for UMAP plotting.")

    embedding_batches = [result["embeddings"] for result in dataset_results]
    labels = [
        result["datasetLabel"]
        for result in dataset_results
        for _ in range(result["embeddings"].shape[0])
    ]
    combined_embeddings = np.vstack(embedding_batches)

    if combined_embeddings.shape[0] >= 3:
        reducer = UMAP(
            n_neighbors=min(30, combined_embeddings.shape[0] - 1),
            min_dist=0.3,
            n_components=2,
            metric="cosine",
            random_state=42,
        )
        coordinates = reducer.fit_transform(combined_embeddings)
    else:
        padded = np.pad(
            combined_embeddings,
            ((0, 0), (0, max(0, 2 - combined_embeddings.shape[1]))),
            mode="constant",
        )
        coordinates = padded[:, :2]

    unique_labels = list(dict.fromkeys(labels))
    color_map = plt.get_cmap("tab10")

    plt.figure(figsize=(14, 10))
    for index, label in enumerate(unique_labels):
        mask = np.array([item == label for item in labels])
        plt.scatter(
            coordinates[mask, 0],
            coordinates[mask, 1],
            label=label,
            alpha=0.8,
            s=36,
            color=color_map(index % 10),
        )
    plt.title("Semantic Space Coverage by Generation Method")
    plt.xlabel("UMAP 1")
    plt.ylabel("UMAP 2")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close()


def generate_similarity_histogram(
    dataset_results: list[dict[str, Any]], output_path: Path
) -> None:
    plt.figure(figsize=(14, 9))
    for index, result in enumerate(dataset_results):
        values = np.asarray(result["pairwiseSimilarityValues"], dtype=float)
        if values.size == 0:
            continue
        plt.hist(
            values,
            bins=30,
            range=(0, 1),
            density=True,
            histtype="step",
            linewidth=2,
            alpha=0.95,
            label=result["datasetLabel"],
            color=plt.get_cmap("tab10")(index % 10),
        )
    plt.title("Pairwise Cosine Similarity Distribution")
    plt.xlabel("cosine similarity (0 to 1)")
    plt.ylabel("density")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close()


def generate_topic_distribution_plot(
    dataset_results: list[dict[str, Any]], output_path: Path
) -> None:
    topic_union = sorted(
        {
            item["topic"]
            for result in dataset_results
            for item in result["topicDistribution"]
        }
    )
    dataset_labels = [result["datasetLabel"] for result in dataset_results]
    positions = np.arange(len(dataset_labels))
    cumulative = np.zeros(len(dataset_results), dtype=float)
    color_map = plt.get_cmap("tab20")

    plt.figure(figsize=(16, 10))
    for index, topic in enumerate(topic_union):
        percentages = np.array(
            [
                next(
                    (
                        item["percentage"]
                        for item in result["topicDistribution"]
                        if item["topic"] == topic
                    ),
                    0.0,
                )
                for result in dataset_results
            ],
            dtype=float,
        )
        plt.bar(
            positions,
            percentages,
            bottom=cumulative,
            label=topic,
            color=color_map(index % 20),
        )
        cumulative += percentages

    plt.xticks(positions, dataset_labels, rotation=25, ha="right")
    plt.ylabel("percentage of problems")
    plt.title("Topic Distribution by Generation Method")
    plt.legend(bbox_to_anchor=(1.02, 1), loc="upper left")
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close()


def build_output_payload(
    dataset_results: list[dict[str, Any]], graphs_dir: Path
) -> dict[str, Any]:
    metrics_table = []
    datasets_payload = []

    for result in dataset_results:
        metrics_row = {
            "datasetId": result["datasetId"],
            "datasetLabel": result["datasetLabel"],
            **result["metrics"],
        }
        metrics_table.append(metrics_row)
        datasets_payload.append(
            {
                "datasetId": result["datasetId"],
                "datasetLabel": result["datasetLabel"],
                "sourceFile": result["sourceFile"],
                "metrics": result["metrics"],
                "topicDistribution": result["topicDistribution"],
            }
        )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "datasetCount": len(dataset_results),
        "metricsTable": metrics_table,
        "datasets": datasets_payload,
        "plots": {
            "umapScatter": str(graphs_dir / "umap_scatter.png"),
            "similarityHistogram": str(graphs_dir / "similarity_histogram.png"),
            "topicDistribution": str(graphs_dir / "topic_distribution.png"),
        },
    }


def with_timestamp_suffix(path: Path, timestamp: str) -> Path:
    return path.with_name(f"{path.stem}_{timestamp}{path.suffix}")


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--datasets-dir",
        type=Path,
        default=script_dir / "datasets",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=script_dir / "results",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=script_dir / "results" / "summary" / "dataset_metrics_summary.json",
    )
    parser.add_argument(
        "--graphs-dir",
        type=Path,
        default=script_dir / "results" / "graphs",
    )
    args = parser.parse_args()

    datasets_dir = args.datasets_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_json = args.output_json.resolve()
    graphs_dir = args.graphs_dir.resolve()
    run_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_json = with_timestamp_suffix(output_json, run_timestamp)

    if not datasets_dir.exists():
        raise FileNotFoundError(f"Datasets directory not found: {datasets_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    graphs_dir.mkdir(parents=True, exist_ok=True)

    csv_paths = sorted(datasets_dir.glob("*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSV datasets found in {datasets_dir}")

    dataset_results = [
        compute_dataset_metrics(load_dataset(csv_path)) for csv_path in csv_paths
    ]

    generate_umap_plot(dataset_results, graphs_dir / "umap_scatter.png")
    generate_similarity_histogram(
        dataset_results, graphs_dir / "similarity_histogram.png"
    )
    generate_topic_distribution_plot(
        dataset_results, graphs_dir / "topic_distribution.png"
    )

    payload = build_output_payload(dataset_results, graphs_dir)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Wrote metrics JSON to {output_json}")
    print(f"Saved UMAP scatter to {graphs_dir / 'umap_scatter.png'}")
    print(f"Saved similarity histogram to {graphs_dir / 'similarity_histogram.png'}")
    print(f"Saved topic distribution plot to {graphs_dir / 'topic_distribution.png'}")


if __name__ == "__main__":
    main()
