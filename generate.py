"""
file:generate.py
description:Contains the functions to generate the dateset using functions in openrouter_synthesis.py
"""

from exceptions import GenerationModelNotFoundError, TeacherModelNotFoundError
from openrouter_sythesis import *
from models import generationModelConfig, personaSplitsChoices, teacherModelConfig
import json
from logger import Logger
from typing import Dict
#create the log
log=Logger(__name__)
MODEL_LIST_FILE="./openrouter_models_list.json"
with open(MODEL_LIST_FILE) as f:
    openrouterModelList=[model.get('id') for model in json.load(f)]


def generateDataset(
    datasetConfig:List[Dict[Domain,personaSplitsChoices]],
    datasetSize:int,
    generationModel:generationModelConfig=generationModelConfig(modelId="nvidia/nemotron-3-nano-30b-a3b:free"),
    teacherModel:teacherModelConfig=teacherModelConfig(modelId="upstage/solar-pro-3:free"),
    datasetName:str="default_gen"
                    ):
    #checking if non default values are of the right type
    if datasetConfig is None or len(datasetConfig)==0:
        log.error(f"Invalid datasetConfig:{datasetConfig}")
        raise ValueError(f"User configurations for each split is empty or null got :{datasetConfig}")
    if datasetSize is None or datasetSize==0:
        log.error(f"Invalid datasetSize:{datasetSize}")
        raise ValueError(f"User configurations for each split is empty or null got :{datasetSize}")


    # #check will be removed later and done on server
    if generationModel.modelId not in openrouterModelList:
        raise GenerationModelNotFoundError(f"The generation model id :{generationModel.modelId} doesnt exist in {MODEL_LIST_FILE}")
    if teacherModel.modelId not in openrouterModelList:
        raise TeacherModelNotFoundError(f"The teacher model id: {teacherModel.modelId} doesnt exist in {MODEL_LIST_FILE}")

    #create the Chatopenrouter Instance for the models
    generationModelInstance=generationModel.createModelInstance()
    teacherModelInstance=teacherModel.createModelInstance()

    #empty list for storing the rows for the dataset (each list is a column)
    inputPersonas=[]
    questions=[]
    answers=[]
    log.info(f"generating a dataset of size :{datasetSize}")
    for config in datasetConfig:
        domain,personaSplit=next(iter(config.items()))
        #extract the persona list
        try:
            currInputPersonas=createPersonaList(
                **personaSplit.returnSplitConfig()
            )['persona'].tolist()
        except ValueError as e:
            #TODO:figure out how to handle this
            log.error(f"Error creating persona list: {e}")
            continue

        if currInputPersonas is None and len(currInputPersonas)==0:
            #TODO: add execption or figure out what to do
            continue
        if personaSplit.generationModel is not None and personaSplit.generationModel.modelId in openrouterModelList:
            #will be removed and added in server
            #generate questions
            currQuestions=generateQuestions(
                personas=currInputPersonas,
                model=personaSplit.generationModel.createModelInstance(),
                domain=domain
            )
        else:
            #generate questions
            currQuestions=generateQuestions(
                personas=currInputPersonas,
                model=generationModelInstance,
                domain=domain
            )
        if currQuestions is None or len(currQuestions)==0:
            #TODO: add execption or figure out what to do
            continue

        # print(question)
        #generate answers
        if personaSplit.teacherModel is not None and personaSplit.teacherModel.modelId in openrouterModelList:
            #will be removed and added in server
            #generate questions
            currAnswers=generateAnswers(
               questions=currQuestions,
               model=personaSplit.teacherModel.createModelInstance(),
            )
        else:
            currAnswers=generateAnswers(
               questions=currQuestions,
               model=teacherModelInstance,

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
    try:
        generateDataset(datasetConfig=choices,datasetSize=2)
    except Exception as e:
        print(e)
