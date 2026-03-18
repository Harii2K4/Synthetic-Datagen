import os
import sys

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import warnings
from typing import List, Literal, Optional

import pandas as pd
from dotenv import load_dotenv
from langchain_core.messages import AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter

from prompts.teacher_template import defaultPrompt
from utils.exceptions import TeacherPromptNotFoundError
from utils.logger import Logger
from utils.models import Domain, personaSplits

# load the environment variables
load_dotenv()

PERSONA_FOLDER = "./data/persona_hub/"
DATASET_FOLDER = "./data/datasets/"
# setup the logger
log = Logger(__name__)


def getDomainTemplate(
    domain: Domain,
) -> str:
    """
    The function is used to get the respective domain for the domain
    Each domain has its own template for generation Model
    Args:
        domain:Domain

    Returns:
        str

    """
    if domain == "math":
        from prompts.domain_templates import mathTemplate

        return mathTemplate
    elif domain == "instruction":
        from prompts.domain_templates import instructionTemplate

        return instructionTemplate
    elif domain == "knowledge":
        from prompts.domain_templates import knowledgeTemplate

        return knowledgeTemplate
    elif domain == "reasoning":
        from prompts.domain_templates import reasoningTemplate

        return reasoningTemplate
    elif domain == "tool":
        from prompts.domain_templates import toolTemplate

        return toolTemplate
    elif domain == "npc":
        from prompts.domain_templates import npcTemplate

        return npcTemplate


def generateQuestions(
    personas: List[str],
    model: ChatOpenRouter,
    domain: Domain = "math",
    maxConcurrentRequests: int = 10,
) -> List[AIMessage]:
    """
    The function is used to generate questions for list of personas
    the api calls are made to the model through openrouter
    The requests are made concurrently

    Args:
        personas:List[str]
        model:ChatOpenRouter
        domain:Domain
        maxConcurrentRequests:int

    Returns:
        List[AIMessage]

    """
    # gets the domain template per selectionMethod
    domainTemplate = getDomainTemplate(domain)
    # get the list of prompts
    personaPrompts = [
        {"personaPrompt": domainTemplate.format(persona=p)} for p in personas
    ]
    # need to invoke in batches
    template = ChatPromptTemplate.from_messages([("system", "{personaPrompt}")])
    # create a chain
    generationChain = template | model
    log.info(f"Batch querying model with {len(personas)}")
    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=maxConcurrentRequests)

    responses = generationChain.batch(
        personaPrompts, return_exceptions=True, config=config
    )
    log.info(f"Recieved {len(responses)} questions")
    return responses


def generateAnswers(
    questions: List[str],
    model: ChatOpenRouter,
    teacherName: str = "default",
    maxConcurrentRequests: int = 10,
) -> List[AIMessage]:
    """
    The function is used to generate answers for list of questions
    the api calls are made to the model through openrouter
    The requests are made concurrently

    Args:
        questions:List[str]
        model:ChatOpenRouter
        teacherName:str
        maxConcurrentRequests:int

    Returns:
        List[AIMessage]
    Raises:
        TeacherPromptNotFoundError:If the user defined teacher prompt is not found
    """
    if teacherName == "default":
        systemPrompt = defaultPrompt
    else:
        try:
            systemPrompt = getattr(__import__("prompts.teacher_template"), teacherName)
        except AttributeError as e:
            raise TeacherPromptNotFoundError(
                f"User Defined teacher prompt not found: {e}"
            )
    questions = [q.replace("{", "{{").replace("}", "}}") for q in questions]
    questionPrompts = [{"systemPrompt": systemPrompt, "question": q} for q in questions]
    # need to invoke in batches
    template = ChatPromptTemplate.from_messages(
        [
            ("system", "{systemPrompt}"),
            ("user", "{question}"),
        ]
    )
    # create a chain
    generation_chain = template | model
    log.info(f"Batch querying model for answers with {len(questions)}")
    # create the config to limit the number of concurrent requests
    config = RunnableConfig(max_concurrency=maxConcurrentRequests)
    # invoke
    responses = generation_chain.batch(
        questionPrompts, return_exceptions=True, config=config
    )
    log.info(f"recieved {len(responses)} answers")
    return responses


def createPersonaList(
    split: personaSplits = "general",
    size: int = 10,
    selectionMethod: Literal["random", "sequence", "selected", "ranged"] = "sequence",
    rangeList: Optional[List[int]] = None,
    selectionList: Optional[List[int]] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """
    The function is used to create the list of personas to be used for generation
    from the spilt.
    There are different modes for selection of personas based on the selectionMethod
    the required parameters are validated

    Args:
        split:personaSplits
        size:int
        selectionMethod:Literal["random","sequence","selected","ranged"]
        rangeList:Optional[List[int]]
        selectionList:Opetional[List[int]]
        seed:int

    Returns:
        pd.DataFrame
    Raises:
        ValueError:If the parameters are invalid
        FileNotFoundError:If the file is not found in the disk
    """
    # create the dataset name
    fileName = f"persona_{split}.csv" if split != "general" else "persona.csv"
    # loading the dataset
    try:
        df = pd.read_csv(PERSONA_FOLDER + fileName)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise ValueError(f"Invalid dataset file '{fileName}': {e}") from e
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Dataset file not found in path: {PERSONA_FOLDER + fileName}"
        ) from None

    # creating the list of personas
    if size > df.shape[0]:
        warnings.warn("""size is greater than dataset size setting to dataset
                        size and ignoring persona selectionMethod mode """)
        personaList = df
    elif selectionMethod == "sequence":
        personaList = df.loc[: size - 1]
    elif selectionMethod == "random":
        personaList = df.sample(n=size, random_state=seed)
    elif selectionMethod == "ranged":
        if rangeList is None:
            log.error("rangeList is not provided for ranged selection")
            raise ValueError("rangeList is not provided for ranged selection")
        if len(rangeList) > 2:
            log.error(
                f"rangeList is provided has more than two elements:{len(rangeList)}"
            )
            raise ValueError("rangeList is provided has more than two elements")
        lowerLimit = min(rangeList)
        upperLimit = max(rangeList)
        if lowerLimit < 0:
            log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
            lowerLimit = 0
        if upperLimit > df.shape[0]:
            log.warning(
                f"upperLimit is out of index setting to last index:{upperLimit}"
            )
            upperLimit = df.shape[0]
        personaList = df.iloc[lowerLimit:upperLimit]
    elif selectionMethod == "selected":
        if selectionList is None or len(selectionList) == 0:
            raise ValueError("""In selected mode and requires personas to be selected,
                             selectionMethod list is None or empty""")
        if size != len(selectionList):
            warnings.warn(
                "size and selectionMethod list size are not equal,using selectionMethod list"
            )
        if min(selectionList) < 0 or max(selectionList) > df.shape[0]:
            raise ValueError(f"""selectionList list indexes out of range,
                             Min Index : {min(selectionList)}
                             Max Index : {max(selectionList)}""")
        personaList = df.iloc[selectionList]
    return personaList


# if __name__ == "__main__":
#
#     file="./data/persona_hub/experiment_subset/"+"persona_subset.csv"
#     inputPersona=pd.read_csv(file)['persona'].tolist()
#     generationModel=ChatOpenRouter(
#         model="nvidia/nemotron-3-nano-30b-a3b:free",
#         reasoning={"effort":"none"}
#     )
#     question=generateQuestions(inputPersona,generationModel,domain="math")
#     question=[str(q.content) for q in question  if isinstance(q,AIMessage)]
#
#     answerModel=ChatOpenRouter(model="stepfun/step-3.5-flash:free")
#     answer=generateAnswers(question,answerModel)
#     answer=[str(a.content) for a in answer  if isinstance(a,AIMessage)]
#
#     domain=["math"]*len(inputPersona)
#     log.info("creating the dataset")
#     df = pd.DataFrame(list(zip(inputPersona, question, answer)),
#                           columns=['persona', 'Question', 'Answer'])
#     # ensure dataset folder exists and save
#     df.to_csv(DATASET_FOLDER+'Mock_general.csv', index=False)
#     log.info("saved the dataset" )
