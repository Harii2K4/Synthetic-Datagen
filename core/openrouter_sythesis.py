import os
import sys

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter
from langchain_core.prompts import ChatPromptTemplate
import pandas as pd
import warnings
from typing import Literal,Optional,List

from utils.exceptions import TeacherPromptNotFoundError
from utils.models import personaSplits,Domain
from utils.logger import Logger
from prompts.teacher_template import defaultPrompt

from dotenv import load_dotenv
#load the environment variables
load_dotenv()

PERSONA_FOLDER="./data/persona_hub/"
DATASET_FOLDER="./data/datasets/test_datasets/"
#setup the logger
log=Logger(__name__)

def getDomainTemplate(
        domain:Domain,
 )->str:
    if domain=="math":
        from prompts.domain_templates import mathTemplate
        return mathTemplate
    elif domain=="instruction":
        from prompts.domain_templates import instructionTemplate
        return instructionTemplate
    elif domain=="knowledge":
        from prompts.domain_templates import knowledgeTemplate
        return knowledgeTemplate
    elif domain=="reasoning":
        from prompts.domain_templates import reasoningTemplate
        return reasoningTemplate
    elif domain=="tool":
        from prompts.domain_templates import toolTemplate
        return toolTemplate
    elif domain=="npc":
        from prompts.domain_templates import npcTemplate
        return npcTemplate

def generateQuestions(
        personas:List[str],
        model:ChatOpenRouter,
        domain:Domain="math",
        maxConcurrentRequests:int=10
                    )->List[AIMessage]:
    #gets the domain template per selectionMethod
    domainTemplate=getDomainTemplate(domain)
    #get the list of prompts
    personaPrompts=[{"personaPrompt":domainTemplate.format(persona=p)} for p in personas]
    #need to invoke in batches
    template= ChatPromptTemplate.from_messages(
         [("system","{personaPrompt}")]
        )
    #create a chain
    generationChain=template|model
    log.info(f"Batch querying model with {len(personas)}")
    #create the config to limit the number of concurrent requests
    config=RunnableConfig(max_concurrency=maxConcurrentRequests)

    responses=generationChain.batch(
        personaPrompts,
        return_exceptions=True,
        config=config
    )
    log.info(f"Recieved {len(responses)} questions")
    return responses


def generateAnswers(
        questions:List[str],
        model:ChatOpenRouter,
        teacherName:str="default",
        maxConcurrentRequests:int=10
                    )->List[AIMessage]:

    if teacherName=="default":
        systemPrompt=defaultPrompt
    else:
        try:
            systemPrompt=getattr(__import__("prompts.teacher_template"),teacherName)
        except AttributeError as e:
            raise TeacherPromptNotFoundError(f"User Defined teacher prompt not found: {e}")
    questions=[q.replace("{","{{").replace("}","}}") for q in questions]
    questionPrompts=[{"systemPrompt":systemPrompt,"question":q} for q in questions]
    #need to invoke in batches
    template= ChatPromptTemplate.from_messages(
        [
            ("system","{systemPrompt}"),
            ("user","{question}"),
        ]

    )
    #create a chain
    generation_chain=template|model
    log.info(f"Batch querying model for answers with {len(questions)}")
    #create the config to limit the number of concurrent requests
    config=RunnableConfig(max_concurrency=maxConcurrentRequests)
    #invoke
    responses=generation_chain.batch(
        questionPrompts,
        return_exceptions=True,
        config=config
    )
    log.info(f"recieved {len(responses)} answers")
    return responses

def createPersonaList(
    split:personaSplits="general",
    size:int=10,
    selectionMethod:Literal["random","sequence","selected","ranged"]="sequence",
    rangeList:Optional[List[int]]=None,
    selectionList:Optional[List[int]]=None,
    seed:int=42
                  ):
    #create the dataset name
    fileName=f"persona_{split}.csv" if split!="general" else "persona.csv"
    #loading the dataset
    try:
        df=pd.read_csv(PERSONA_FOLDER+fileName)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise ValueError(f"Invalid dataset file '{fileName}': {e}") from e
    except FileNotFoundError :
        raise FileNotFoundError(f"Dataset file not found in path: {PERSONA_FOLDER+fileName}") from None

    #creating the list of personas
    if size>df.shape[0]:
        warnings.warn("""size is greater than dataset size setting to dataset
                        size and ignoring persona selectionMethod mode """)
        personaList=df
    elif selectionMethod=="sequence":
        personaList=df.loc[:size-1]
    elif selectionMethod=="random":
        personaList=df.sample(n=size,random_state=seed)
    elif selectionMethod=="ranged":
        if rangeList ==None:
            log.error("rangeList is not provided for ranged selection")
            raise ValueError("rangeList is not provided for ranged selection")
        if len(rangeList)>2:
            log.error(f"rangeList is provided has more than two elements:{len(rangeList)}")
            raise ValueError("rangeList is provided has more than two elements")
        lowerLimit=min(rangeList)
        upperLimit=max(rangeList)
        if lowerLimit<0:
            log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
            lowerLimit=0
        if upperLimit>df.shape[0]:
            log.warning(f"upperLimit is out of index setting to last index:{upperLimit}")
            upperLimit=df.shape[0]
        personaList=df.iloc[lowerLimit:upperLimit]
    elif selectionMethod=="selected":
        if selectionList is None or len(selectionList)==0:
            raise ValueError("""In selected mode and requires personas to be selected,
                             selectionMethod list is None or empty""")
        if size!=len(selectionList):
            warnings.warn("size and selectionMethod list size are not equal,using selectionMethod list")
        if min(selectionList)<0 or max(selectionList)>df.shape[0]:
            raise ValueError(f'''selectionList list indexes out of range,
                             Min Index : {min(selectionList)}
                             Max Index : {max(selectionList)}''')
        personaList=df.iloc[selectionList]
    return personaList


# if __name__ == "__main__":
#     #
#     # inputPersona=createPersonaList("math",size=2)['input persona'].tolist()
#     # # print(inputPersona)
#     # question=generateQuestions(inputPersona)
#     # # print(question)
#     question=["question 1","question 2"]
#     answer=generateAnswers(question,teacherName="custom-teacher")
#     # # print(answer)
#     # log.info("creating the dataset")
#     # df = pd.DataFrame(list(zip(inputPersona, question, answer)),
#     #                       columns=['persona', 'Question', 'Answer'])
#     # # ensure dataset folder exists and save
#     # df.to_csv(DATASET_FOLDER+'qa_output_2.csv', index=False)
#     # log.info("saved the dataset" )






