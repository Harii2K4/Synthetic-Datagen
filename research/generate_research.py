"""
file:generate_research.py
description :File contain functions for generating dateset for the reasearch part
"""

import os 
import sys 
#add the root path to the file
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List

import pandas as pd
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter

from core.openrouter_sythesis import generateQuestions
from utils.logger import Logger


log = Logger(__name__)
DATASET_FOLDER = "./data/datasets/research_datasets/"


def generatePersonaDataset(
    inputPersona: List[str],
    generationModel: ChatOpenRouter,
    DatasetName: str,
    domainName: str,
) -> None:
    # generate questions for the domain using persona
    question = generateQuestions(inputPersona, generationModel, domain="math")
    question = [str(q.content) for q in question if isinstance(q, AIMessage)]

    domain = [domainName] * len(inputPersona)
    log.info("creating the dataset using persona")
    df = pd.DataFrame(
        list(zip(inputPersona, domain, question)),
        columns=["persona", "domain", "Question"],
    )
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER + f"{DatasetName}.csv", index=False)
    log.info("saved the dataset using persona")


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
        - Your response must start with the literal string "Math problem:".
        - Do not provide the solution or any introductory conversational filler.
        - Use LaTeX for all mathematical notation."""
    # get the list of prompts
    prompts = [baselineTemplate] * datasetSize
    # create a chain
    log.info(f"Batch querying model with {datasetSize} prompts")
    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=25)

    responses = generationModel.batch(prompts, return_exceptions=True, config=config)
    question = [str(q.content) for q in responses if isinstance(q, AIMessage)]

    domain = [domainName] * len(inputPersona)
    log.info("creating the dataset using baseline")
    df = pd.DataFrame(
        list(zip(inputPersona, domain, question)),
        columns=["persona", "domain", "Question"],
    )
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER + f"{DatasetName}.csv", index=False)
    log.info("saved the dataset using baseline")


if __name__ == "__main__":
    file = "./data/persona_hub/experiment_subset/" + "math_subset.csv"
    inputPersona = pd.read_csv(file)["input persona"].tolist()
    # print(inputPersona)
    generationModel = ChatOpenRouter(
        model="openai/gpt-oss-120b",
        reasoning={"effort": "minimal"},
        openrouter_provider={"order": ["groq", "google-vertex"]},
    )

    generateBaselineDataset(generationModel, "math_baseline", "math", len(inputPersona))
    generatePersonaDataset(inputPersona, generationModel, "math_persona", "math")
    # generateBaselineDataset(generationModel,"math_baseline","math",1)
