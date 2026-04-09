"""
file:generate_research.py
description :File contain functions for generating dateset for the reasearch part
"""

import os
import sys

# add the root path to the file
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Any, List, cast
import pandas as pd
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter

from core.openrouter_sythesis import generateQuestions
from research.question_formatting import normalize_math_problem_batch
from utils.logger import Logger

log = Logger(__name__)
DATASET_FOLDER = "./datasets/"
Model_Name = "openai/gpt-oss-120b"


# used to generate a persona dataset
def generatePersonaDataset(
    inputPersona: List[str],
    generationModel: ChatOpenRouter,
    DatasetName: str,
    domainName: str,
) -> None:
    # generate questions for the domain using persona
    question = generateQuestions(inputPersona, generationModel, domain="math")
    question = normalize_math_problem_batch(
        [str(q.content) for q in question if isinstance(q, AIMessage)]
    )

    domain = [domainName] * len(inputPersona)
    log.info(f"creating the dataset using persona for {DatasetName}")
    df = pd.DataFrame(
        list(zip(inputPersona, domain, question)),
        columns=["persona", "domain", "Question"],
    )
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER + f"{DatasetName}.csv", index=False)
    log.info(f"saved the dataset using persona {DatasetName}")


def generateSelfInstructDataset(
    generationModel: ChatOpenRouter,
    DatasetName: str,
    domainName: str,
    datasetSize: int,
) -> None:
    # generate the instructions for the model to generate questions
    instructionGenerationModel = ChatOpenRouter(
        model=Model_Name,
        reasoning={"effort": "minimal"},
        openrouter_provider={"order": ["groq", "google-vertex"]},
        temperature=0.7,
    )
    log.info(f"generating instructions for {DatasetName}")
    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=25)
    # generate the instructions
    instructionPrompt = """
        Generate a diverse and specific math task instruction.

        Requirements:
        - The instruction must require multi-step reasoning
        - It should specify a mathematical area or concept
        - Avoid generic instructions
        - Keep it concise (1–2 sentences)
        - instruct the model to using the following format:
            - The generated problem must use the exact first line "Math problem:".
            - Do not provide the solution or any introductory conversational filler.
            - Use LaTeX for all mathematical notation.
        Return only the instruction.
        """

    instructionPrompts = [instructionPrompt] * datasetSize
    # generate the instructions for the model to generate questions
    instuctionResponses = instructionGenerationModel.batch(
        cast(list[Any], instructionPrompts), return_exceptions=True, config=config
    )
    # extract the instructions
    instructions = [
        str(i.content) for i in instuctionResponses if isinstance(i, AIMessage)
    ]

    # template for questions generation
    prompts = [
        f"""
        Follow the instruction below and generate a math problem.

        Instruction:
        {instruction}

        Requirements:
        - The problem must require multi-step reasoning
        - It should strictly follow the given instruction
        - Avoid trivial or textbook-style templates
        - Provide exactly one problem (at most 2 sub-parts)
        - The output must be plain text only, with no markdown fences or extra headings

        Format:
        - The first line must be exactly "Math problem:"
        - Starting on the next line, provide only the problem statement
        - Use LaTeX for mathematical expressions
        - Do NOT include the solution
    """
        for instruction in instructions
    ]
    # create a chain
    log.info(
        f"Batch querying model with {datasetSize} prompts for generating instructions"
    )

    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=25)
    responses = generationModel.batch(
        cast(list[Any], prompts), return_exceptions=True, config=config
    )
    question = normalize_math_problem_batch(
        [str(q.content) for q in responses if isinstance(q, AIMessage)]
    )

    domain = [domainName] * datasetSize
    log.info(f"creating the dataset using self-instruct {len(instructions)}")
    df = pd.DataFrame(
        list(zip(instructions, domain, question)),
        columns=["instruction", "domain", "Question"],
    )
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER + f"{DatasetName}.csv", index=False)
    log.info(f"saved the dataset using self-instruct {DatasetName}")


def generateBaselineDataset(
    generationModel: ChatOpenRouter,
    DatasetName: str,
    domainName: str,
    datasetSize: int,
) -> None:
    # generate questions for the domain using baseline template
    baselineTemplate = """Create a math problem

    Constraints:
    1.The problem must require advanced mathematical reasoning that only top talents in the feld can solve. Avoid trivial arithmetic.
    2.Structure: Provide exactly one problem, which may contain up to 2 sub-problems(a and b).
    3.Format:
        - The first line must be exactly "Math problem:".
        - Starting on the next line, provide only the problem statement.
        - Do not provide the solution or any introductory conversational filler.
        - Use LaTeX for all mathematical notation.
        - Do not use markdown fences or extra headings."""
    # get the list of prompts
    prompts = [baselineTemplate] * datasetSize
    # create a chain
    log.info(f"Batch querying model with {datasetSize} prompts for {DatasetName}")
    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=25)

    responses = generationModel.batch(
        cast(list[Any], prompts), return_exceptions=True, config=config
    )
    question = normalize_math_problem_batch(
        [str(q.content) for q in responses if isinstance(q, AIMessage)]
    )

    domain = [domainName] * datasetSize
    log.info("creating the dataset using baseline")
    df = pd.DataFrame(
        list(zip(domain, question)),
        columns=["domain", "Question"],
    )
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER + f"{DatasetName}.csv", index=False)
    log.info(f"saved the dataset using baseline {DatasetName}")


if __name__ == "__main__":
    if not os.path.exists(DATASET_FOLDER):
        print("dataset folder does not exist, creating it")
    else:
        # # generate the baseline for temp = 0.7
        generationModel = ChatOpenRouter(
            model=Model_Name,
            reasoning={"effort": "minimal"},
            openrouter_provider={"order": ["groq", "google-vertex"]},
            temperature=0.7,
        )
        generateBaselineDataset(generationModel, "math_baseline_temp_0.7", "math", 100)
        # # generate for temperature 0
        generationModel = ChatOpenRouter(
            model=Model_Name,
            reasoning={"effort": "minimal"},
            openrouter_provider={"order": ["groq", "google-vertex"]},
            temperature=0,
        )
        generateBaselineDataset(generationModel, "math_baseline_temp_0", "math", 100)
        # persona based generation

        # math domain based persona's
        file = "./experiment_subset/" + "math_subset.csv"
        inputPersona = pd.read_csv(file)["persona"].tolist()
        generatePersonaDataset(inputPersona, generationModel, "math_persona", "math")

        # general domain  based persona's
        file = "./experiment_subset/" + "persona_subset.csv"
        inputPersona = pd.read_csv(file)["persona"].tolist()
        generatePersonaDataset(
            inputPersona, generationModel, "math_persona_general", "math"
        )

        # generate the self-instruct dataset
        generateSelfInstructDataset(
            generationModel=generationModel,
            DatasetName="math_self_instruct",
            domainName="math",
            datasetSize=100,
        )
