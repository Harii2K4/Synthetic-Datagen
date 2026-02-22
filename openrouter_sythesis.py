from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_openrouter import ChatOpenRouter
from langchain_core.prompts import ChatPromptTemplate
from prompts.teacher_template import teacher_prompt
from dotenv import load_dotenv
import pandas as pd
from logger import Logger
from typing import Literal,Optional,List
import warnings
#load the environment variables
load_dotenv()

PERSONA_FOLDER="./persona_hub/"
DATASET_FOLDER="./datasets/test_datasets/"
#setup the logger
log=Logger(__name__)

def getDomainTemplate(
        domain:Literal["math","instruction","knowledge","reasoning","tool","npc"]="math",
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
        model:str="upstage/solar-pro-3:free",
        domain:Literal["math","instruction","knowledge","reasoning","tool","npc"]="math",
        maxConcurrentRequests:int=10
                    )->List[str]:
    #gets the domain template per selection
    domainTemplate=getDomainTemplate(domain)
    #set the generator model
    generator_model = ChatOpenRouter(
            model=model,
            temperature=0,
            # openrouter_provider={"order":["alibaba"]}
        )
    #get the list of prompts
    personaPrompts=[{"personaPrompt":domainTemplate.format(persona=p)} for p in personas]
    #need to invoke in batches
    template= ChatPromptTemplate.from_messages(
         [("system","{personaPrompt}")]
        )
    #create a chain
    generation_chain=template|generator_model
    log.info(f"Batch querying model with {len(personas)}")
    #create the config to limit the number of concurrent requests
    config=RunnableConfig(max_concurrency=maxConcurrentRequests)

    responses=generation_chain.batch(
        personaPrompts,
        return_exceptions=True,
        config=config
    )
    log.info(f"Recieved {len(responses)} questions")

    #convert the responses to strings
    responses=[str(r.content) for r in responses]

    return responses


def generateAnswers(
        questions:List[str],
        model:str="openai/gpt-oss-120b",
        teacherName:str="default",
        maxConcurrentRequests:int=10
                    )->str|List[str]:

    if teacherName=="default":
        system_prompt=teacher_prompt
    else:
        #TODO :custom user teacher prompt
        system_prompt=teacher_prompt
    #create the model instance
    generator_model = ChatOpenRouter(
        model=model,
        temperature=0,
        openrouter_provider={"order":["groq","baseten/fp4"]}
    )
    questions=[q.replace("{","{{").replace("}","}}") for q in questions]
    questionPrompts=[{"systemPrompt":system_prompt,"question":q} for q in questions]
    #need to invoke in batches
    template= ChatPromptTemplate.from_messages(
        [
            ("system","{systemPrompt}"),
            ("user","{question}"),
        ]

    )
    #create a chain
    generation_chain=template|generator_model
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

    #convert the responses to strings
    responses=[str(r.content) for r in responses]

    return responses

def createPersonaList(
    respository:Literal["math","instruction","knowledge","reasoning","tool","npc","general"]="general",
    size:int=10,
    selection:Literal["random","sequence","selected"]="sequence",
    selectionList:Optional[List[int]]=None,
    seed:int=42
                  ):
    #create the dataset name
    fileName=f"persona_{respository}.csv" if respository!="general" else "persona.csv"
    #loading the dataset
    try:
        df=pd.read_csv(PERSONA_FOLDER+fileName)
    except Exception as e:
        raise Exception(f"Error loading dataset: {e}")
    #creating the list of personas
    if size>df.shape[0]:
        warnings.warn("""size is greater than dataset size setting to dataset
                        size and ignoring persona selection mode """)
        personaList=df
    elif selection=="sequence":
        personaList=df.loc[:size-1]
    elif selection=="random":
        personaList=df.sample(n=size,random_state=seed)
    elif selection=="selected":
        if selectionList is None:
            raise ValueError("""In selected mode and requires personas to be selected,
                             selection list is None""")
        if size!=len(selectionList):
            warnings.warn("size and selection list size are not equal,using selection list")
        personaList=df.iloc[selectionList]
    return personaList


if __name__ == "__main__":

    inputPersona=createPersonaList("math",size=2)['input persona'].tolist()
    # print(inputPersona)
    question=generateQuestions(inputPersona)
    # print(question)
    answer=generateAnswers(question)
    # print(answer)
    log.info("creating the dataset")
    df = pd.DataFrame(list(zip(inputPersona, question, answer)),
                          columns=['input persona', 'Question', 'Answer'])
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER+'qa_output_2.csv', index=False)
    log.info("saved the dataset" )






