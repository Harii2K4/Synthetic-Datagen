"""
file:generate.py
description:Contains the functions to generate the dateset using functions in openrouter_synthesis.py
"""

from openrouter_sythesis import *
from models import personaSplitsChoices
import json
from logger import Logger
from typing import Dict
#create the log
log=Logger(__name__)

with open('openrouter_models_list.json') as f:
    openrouterModelList=[model.get('id') for model in json.load(f)]


def generateDataset(
    datasetConfig:List[Dict[Domain,personaSplitsChoices]],
    datasetSize:int,
    generationModel:str="nvidia/nemotron-3-nano-30b-a3b:free",
    teacherModel:str="upstage/solar-pro-3:free",
    datasetName:str="default_gen"
                    ):
    # #check will be removed later and done on server
    if generationModel not in openrouterModelList:
        raise ValueError(f"The generation model id {generationModel} doesnt exist")
    if teacherModel not in openrouterModelList:
        raise ValueError(f"The teacher model id {generationModel} doesnt exist")
    #empty list for storing the rows for the dataset (each list is a column)
    inputPersonas=[]
    questions=[]
    answers=[]
    log.info(f"generating a dataset of size :{datasetSize}")
    for config in datasetConfig:
        domain,personSplit=next(iter(config.items()))
        #extract the persona list
        try:
            currInputPersonas=createPersonaList(
                **personSplit.model_dump()

            )['persona'].tolist()
        except ValueError as e:
            #TODO:figure out how to handle this
            log.error(f"Error creating persona list: {e}")
            continue

        if currInputPersonas is None and len(currInputPersonas)==0:
            #TODO: add execption or figure out what to do
            continue
        #generate questions
        currQuestions=generateQuestions(
            personas=currInputPersonas,
            model=generationModel,
            domain=domain
        )
        if currQuestions is None or len(currQuestions)==0:
            #TODO: add execption or figure out what to do
            continue

        # print(question)
        #generate answers
        currAnswers=generateAnswers(
           questions=currQuestions,
           model=teacherModel,

        )
        # print(answer)
        #TODO :split rate limited queries if exists
        #append to the dataset
        inputPersonas.extend(currInputPersonas)
        questions.extend(currQuestions)
        answers.extend(currAnswers)

    #create the dataset
    log.info("creating the dataset")
    df = pd.DataFrame(list(zip(inputPersonas, questions, answers)),
                          columns=['input persona', 'Question', 'Answer'])
    # ensure dataset folder exists and save
    df.to_csv(DATASET_FOLDER+datasetName+'.csv', index=False)
    log.info("saved the dataset" )

if __name__=="__main__":
    choices: List[Dict[Domain, personaSplitsChoices]] = [
            {"math": personaSplitsChoices(size=2)}
    ]
    generateDataset(choices,2)
