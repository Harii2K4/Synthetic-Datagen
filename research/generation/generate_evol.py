"""
file:generate_evol.py
description :File contain functions for generating dateset for the evolution part
"""

from typing import Any, cast
import pandas as pd
from langchain_openrouter import ChatOpenRouter
from dotenv import load_dotenv

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from research.question_formatting import (
    normalize_math_problem_batch,
    normalize_math_problem_text,
)
from utils.logger import Logger

load_dotenv()
# add the root path to the file


log = Logger(__name__)
DATASET_FOLDER = "./datasets/"
Model_Name = "openai/gpt-oss-120b"

# the question generation prompts
level1DepthPrompt = """
        Here is a math problem:
        {seed_problem}

        Rewrite this into a harder version by doing ONE of the following:
        - Add more steps to reach the solution
        - Introduce an additional variable or constraint
        - Embed it in a real-world context that requires interpretation
        - Require knowledge of one additional concept to solve

        Rules:
        - Stay on the same core topic as the original
        - The new problem must still have a clean, exact solution
        - Do NOT just add irrelevant complexity
        - use latex for mathematical notation
        - Provide exactly one problem, with at most 2 sub-parts
        - The first line must be exactly "Math problem:"
        - Starting on the next line, provide only the problem statement
        - Output plain text only with no markdown fences, solution, or extra headings
    """

level1BreathPrompt = """
        Here is a math problem:
        {seed_problem}

        Create a NEW math problem that:
        - Is at a SIMILAR difficulty level to the original
        - Covers a DIFFERENT but mathematically related concept
        - Is fully self-contained with no reference to the original
        - Has a clean, exact solution

        Rules:
        - Do not paraphrase or rephrase the original
        - The connection to the original should be conceptual, not surface-level
        - use latex for mathematical notation
        - Provide exactly one problem, with at most 2 sub-parts
        - The first line must be exactly "Math problem:"
        - Starting on the next line, provide only the problem statement
        - Output plain text only with no markdown fences, solution, or extra headings
        """

level2DepthPrompt = """
    Here is a math problem that was already evolved once from a simpler version:
    {level_1_output}

    Evolve this further into an even harder problem by doing ONE of the following:
    - Combine it with another mathematical concept
    - Turn it into a multi-part problem (a, b, c)
    - Require proof or generalization instead of a specific numerical answer
    - Introduce ambiguity that the student must resolve before solving

    Rules:
    - Must be meaningfully harder than the input, not just cosmetically changed
    - Must still have a rigorous, complete solution
    - Do NOT make it unsolvable or ill-defined
    - use latex for mathematical notation
    - Provide exactly one problem, with at most 2 sub-parts
    - The first line must be exactly "Math problem:"
    - Starting on the next line, provide only the problem statement
    - Output plain text only with no markdown fences, solution, or extra headings
    """
level2BreathPrompt = """
    Here is a math problem:
    {level_1_output}

    This problem was already branched from another topic. Now branch again:
    - Move to a DIFFERENT area of mathematics entirely
    - The new problem should feel standalone — no connection to the previous two
    - Maintain similar difficulty to the input problem
    - Must have a clean, exact solution

    Rules:
    - Do not reference or allude to the previous problem
    - Prioritize topics not yet covered in this evolution chain
    - use latex for mathematical notation
    - Provide exactly one problem, with at most 2 sub-parts
    - The first line must be exactly "Math problem:"
    - Starting on the next line, provide only the problem statement
    - Output plain text only with no markdown fences, solution, or extra headings
    """


def generateEvolutionDataset(
    generationModel: ChatOpenRouter,
):
    # import the seeds
    seedProblems = normalize_math_problem_batch(
        pd.read_csv("./evol_seed.csv")["problem"].tolist()
    )

    # generate the level 1 from the
    l1_indepth_messages = [
        level1DepthPrompt.format(seed_problem=seed) for seed in seedProblems
    ]
    l1_breath_messages = [
        level1BreathPrompt.format(seed_problem=seed) for seed in seedProblems
    ]
    # level 1 generation
    log.info(f"generating depth level 1 from {len(seedProblems)} problems")
    l1_indepth_responses = generationModel.batch(cast(list[Any], l1_indepth_messages))
    l1_indepth_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l1_indepth_responses]
    )

    log.info(f"generating breath level 1 from {len(seedProblems)} problems")
    l1_breath_responses = generationModel.batch(cast(list[Any], l1_breath_messages))
    l1_breath_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l1_breath_responses]
    )

    # level 2 generation
    log.info("[Evol-Instruct] Running Level-2 in-depth evolution...")

    # depth branch
    l2_indepth_messages = [
        level2DepthPrompt.format(level_1_output=l1) for l1 in l1_indepth_problems
    ]
    l2_indepth_breath_messages = [
        level2BreathPrompt.format(level_1_output=l1) for l1 in l1_breath_problems
    ]

    log.info(
        f"generating depth level 2(from level 1 in-depth) from {len(l2_indepth_messages)} problems"
    )
    l2_indepth_responses = generationModel.batch(cast(list[Any], l2_indepth_messages))
    l2_indepth_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l2_indepth_responses]
    )

    log.info(
        f"generating depth level 2(from level 1 breath) from {len(l1_breath_problems)} problems"
    )
    l2_indepth_breath_responses = generationModel.batch(
        cast(list[Any], l2_indepth_breath_messages)
    )
    l2_indepth_breath_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l2_indepth_breath_responses]
    )

    # breath branch
    l2_breath_messages = [
        level2DepthPrompt.format(level_1_output=l1) for l1 in l1_breath_problems
    ]
    l2_breath_indepth_messages = [
        level2DepthPrompt.format(level_1_output=l1) for l1 in l1_indepth_problems
    ]

    log.info(
        f"generating depth(from level 1 breath) level 2 from {len(l2_breath_messages)} problems"
    )
    l2_breath_responses = generationModel.batch(cast(list[Any], l2_breath_messages))
    l2_breath_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l2_breath_responses]
    )

    log.info(
        f"generating depth(from level 1 in-depth) level 2 from {len(l2_indepth_messages)} problems"
    )
    l2_breath_indepth_responses = generationModel.batch(
        cast(list[Any], l2_breath_indepth_messages)
    )
    l2_breath_indepth_problems = normalize_math_problem_batch(
        [str(r.content).strip() for r in l2_breath_indepth_responses]
    )
    # create the dataset
    seedQuestions = []
    depth = []
    typeQuestion = []
    questionList = []

    for idx, seedQuestion in enumerate(seedProblems):
        seedQuestions.extend([seedQuestion] * 6)

        questionList.append(l1_indepth_problems[idx])
        depth.append(1)
        typeQuestion.append("depth")

        questionList.append(l1_breath_problems[idx])
        depth.append(1)
        typeQuestion.append("breath")

        questionList.append(l2_indepth_problems[idx])
        depth.append(2)
        typeQuestion.append("depth")

        questionList.append(l2_breath_problems[idx])
        depth.append(2)
        typeQuestion.append("breath")

        questionList.append(l2_indepth_breath_problems[idx])
        depth.append(2)
        typeQuestion.append("breath")

        questionList.append(l2_breath_indepth_problems[idx])
        depth.append(2)
        typeQuestion.append("depth")

    df = pd.DataFrame(
        list(zip(seedQuestions, depth, typeQuestion, questionList)),
        columns=["seedQuestion", "depth", "typeQuestion", "Question"],
    )
    df["seedQuestion"] = df["seedQuestion"].map(normalize_math_problem_text)
    df["Question"] = df["Question"].map(normalize_math_problem_text)

    df.to_csv(DATASET_FOLDER + "math_evol.csv", index=False)


model = ChatOpenRouter(
    model=Model_Name,
    reasoning={"effort": "minimal"},
    openrouter_provider={"order": ["groq", "google-vertex"]},
    temperature=0.7,
)
generateEvolutionDataset(
    generationModel=model,
)
