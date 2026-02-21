from langchain_core.messages import AIMessage
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
        persona:str|List[str],
        model:str="qwen/qwen3-235b-a22b-thinking-2507",
        domain:Literal["math","instruction","knowledge","reasoning","tool","npc"]="math",
                    )->str|List[str]:
    #TODO : get the template for each domain
    domainTemplate=getDomainTemplate(domain)
    #set the generator model
    generator_model = ChatOpenRouter(
            model=model,
            temperature=0,
        )

    #check is single or mutltiple
    if type(persona)==str:
        personaPrompt =domainTemplate.format(persona=persona)

        # log.info(persona_prompt)
        template = ChatPromptTemplate(
            [
                ("system",personaPrompt),
            ]
        )
        log.info("querying model")
        response:AIMessage=generator_model.invoke(input=template.format_prompt())

        return str(response.content)

    else:
        #get the list of prompts
        personaPrompts=[{"personaPrompts":domainTemplate.format(p)} for p in persona]
        #need to invoke in batches
        template= ChatPromptTemplate.from_messages(
             [("system","{personaPrompt}")]
            )
        #create a chain
        generation_chain=template|generator_model
        log.info(f"Batch querying model with {len(persona)}")
        responses=generation_chain.batch(personaPrompts)

        #convert the responses to strings
        responses=[str(r.content) for r in responses]

        return responses


def generateAnswers(
        question:str|List[str],
        model:str="qwen/qwen3-235b-a22b-thinking-2507",
        teacherName:str="default",
                    )->str|List[str]:

    if teacherName=="default":
        system_prompt=teacher_prompt
    else:
        #TODO :custom user teacher prompt
        system_prompt=teacher_prompt

    generator_model = ChatOpenRouter(
        model=model,
        temperature=0,
    )
    if type(question)==str:

        #escape the {} which langchain considers as variables
        question=question.replace("{","{{").replace("}","}}")


        template = ChatPromptTemplate(
            [
                ("system",system_prompt),
                ("user",question),
            ]
        )
        log.info("querying model")
        response:AIMessage=generator_model.invoke(input=template.format_prompt())

        return str(response.content)
    else:
        question=[q.replace("{","{{").replace("}","}}") for q in question]
        questionPrompts=[{"systemPrompt":system_prompt,"user":q} for q in question]
        #need to invoke in batches
        template= ChatPromptTemplate.from_messages(
             [
                ("system","{systemPrompt}"),
                ("user","{question}"),
              ]

            )
        #create a chain
        generation_chain=template|generator_model
        log.info(f"Batch querying model with {len(question)}")
        responses=generation_chain.batch(questionPrompts)

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

    inputPersona=createPersonaList("math",size=1)['input persona'].values[0]
    print(inputPersona)
    question=generateQuestions(inputPersona)
    print(question)
    answer=generateAnswers(question,model="stepfun/step-3.5-flash:free")
    print(answer)
    # create DataFrame and save to CSV
    df = pd.DataFrame([{
        'inputPersona': inputPersona,
        'question': question,
        'answer': answer
    }])
    df.to_csv(DATASET_FOLDER + 'qa_output_1.csv', index=False)




