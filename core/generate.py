"""
file:generate.py
description:Contains the functions to generate the dateset using functions in openrouter_synthesis.py
"""
import os
import sys
#add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.openrouter_sythesis import *
import json
from typing import Any, Dict

from utils.exceptions import GenerationModelNotFoundError, TeacherModelNotFoundError
from utils.models import generationModelConfig, personaSplitsChoices, teacherModelConfig
from utils.logger import Logger

#create the log
log=Logger(__name__)
MODEL_LIST_FILE="./data/openrouter_models_list.json"
DATASET_FOLDER="./data/datasets/test_datasets/"
with open(MODEL_LIST_FILE) as f:
    openrouterModelList=[model.get('id') for model in json.load(f)]


def _initGenerationStats(total_splits:int,total_rows_requested:int)->Dict[str,Any]:
    return {
        "totalSplits": total_splits,
        "successfulSplits": 0,
        "failedSplits": 0,
        "totalRowsRequested": total_rows_requested,
        "rowsGenerated": 0,
        "rowsFailed": 0,
        "errors": [],
    }


def _recordSplitError(
    stats:Dict[str,Any],
    split:personaSplits,
    stage:str,
    error:Exception,
    retryable:bool=False
)->None:
    stats["errors"].append(
        {
            "split": split,
            "stage": stage,
            "errorType": type(error).__name__,
            "message": str(error),
            "retryable": retryable,
        }
    )


def generateDataset(
    personaConfig:List[Dict[Domain,personaSplitsChoices]],
    datasetSize:int,
    generationModel:generationModelConfig=generationModelConfig(modelId="nvidia/nemotron-3-nano-30b-a3b:free"),
    teacherModel:teacherModelConfig=teacherModelConfig(modelId="upstage/solar-pro-3:free"),
    datasetName:str="default_gen"
                    ):
    #checking if non default values are of the right type
    if personaConfig is None or len(personaConfig)==0:
        log.error(f"Invalid personaConfig:{personaConfig}")
        raise ValueError(f"User configurations for each split is empty or null got :{personaConfig}")
    if datasetSize is None or datasetSize==0:
        log.error(f"Invalid datasetSize:{datasetSize}")
        raise ValueError(f"User configurations for each split is empty or null got :{datasetSize}")


    #check to the model ID
    if generationModel.modelId not in openrouterModelList:
        log.error(f"Invalid generation modelId :{generationModel.modelId}")
        raise GenerationModelNotFoundError(f"The generation model id :{generationModel.modelId} doesnt exist in {MODEL_LIST_FILE}")
    if teacherModel.modelId not in openrouterModelList:
        log.error(f"Invalid teacher modelId :{generationModel.modelId}")
        raise TeacherModelNotFoundError(f"The teacher model id: {teacherModel.modelId} doesnt exist in {MODEL_LIST_FILE}")

    #create the Chatopenrouter Instance for the models
    generationModelInstance=generationModel.createModelInstance()
    teacherModelInstance=teacherModel.createModelInstance()
    stats=_initGenerationStats(
        total_splits=len(personaConfig),
        total_rows_requested=datasetSize,
    )

    #empty list for storing the rows for the dataset (each list is a column)
    inputPersonas=[]
    domains=[]
    questions=[]
    answers=[]
    apiExceptionRaised:bool=False
    log.info(f"generating a dataset of size :{datasetSize}")
    #starting generation
    for config in personaConfig:
        #initialise local variable
        currDomain,personaSplit=next(iter(config.items()))
        currQuestions:List[str]=[]
        currAnswers:List[str]=[]
        splitHadError:bool=False if not apiExceptionRaised else True
        questionErrorLogged:bool=False
        answerErrorLogged:bool=False

        #extract the persona list
        try:
            currInputPersonas=createPersonaList(
                **personaSplit.returnSplitConfig()
            )['persona'].tolist()
        except (ValueError, FileNotFoundError, KeyError) as e:
            log.error(f"Error creating persona list: {e}")
            _recordSplitError(
                stats=stats,
                split=personaSplit.split,
                stage="persona_read",
                error=e,
                retryable=False,
            )
            stats["failedSplits"] += 1
            continue

        #should never happen but just in case
        if currInputPersonas is None or len(currInputPersonas)==0:
            log.error(f"personas retrieval return empty or no results:{currInputPersonas}")
            _recordSplitError(
                stats=stats,
                split=personaSplit.split,
                stage="persona_read",
                error=ValueError("Persona list is empty"),
                retryable=False,
            )
            stats["failedSplits"] += 1
            continue

        #question generation block
        #if prev split has lead to exceptions skip making model calls
        if apiExceptionRaised:
            log.info("Skipping question generation as api exception was raised")
            currQuestions=['']*len(currInputPersonas)
        else:
            if personaSplit.generationModel is not None and personaSplit.generationModel.modelId in openrouterModelList:
                #generate questions
                log.info(f"Question generation with local model:{personaSplit.generationModel.modelId}")
                questionResponses=generateQuestions(
                    personas=currInputPersonas,
                    model=personaSplit.generationModel.createModelInstance(),
                    domain=currDomain
                )
            else:
                #generate questions
                log.info(f"Question generation with global model:{generationModel.modelId}")
                questionResponses=generateQuestions(
                    personas=currInputPersonas,
                    model=generationModelInstance,
                    domain=currDomain
                )
            #shouldint happen but just in case
            if questionResponses is None or len(questionResponses)==0:
                log.error(f"Question list was empty for split:{personaSplit.split}")
                _recordSplitError(
                    stats=stats,
                    split=personaSplit.split,
                    stage="question_generation",
                    error=ValueError("Generated question list is empty"),
                    retryable=False,
                )
                stats["failedSplits"] += 1
                continue

            #check for errors and exceptions in generations
            for q in questionResponses:
                if isinstance(q,Exception):
                    #set apiExceptionRaised to true to ensure we dont make futher calls
                    if not apiExceptionRaised:
                        apiExceptionRaised=True
                        log.error(f'''Api call to openrouter has returned an exception while generation questions for {personaSplit}:{currDomain},will be creating partial dataset''')
                    #to track failure in split tracking
                    if not splitHadError:
                        splitHadError=True
                    #log the execption
                    if not questionErrorLogged:
                        _recordSplitError(
                            stats=stats,
                            split=personaSplit.split,
                            stage="question_generation",
                            error=q,
                            retryable=True,
                        )
                        questionErrorLogged=True
                    currQuestions.append('')
                else :
                    currQuestions.append(str(q.content))
        # generate answers
        if apiExceptionRaised:
            log.info("Skipping answers generation as api exception was raised")
            currAnswers=['']*len(currInputPersonas)
        else:
            if personaSplit.teacherModel is not None and personaSplit.teacherModel.modelId in openrouterModelList:
                #generate answers
                log.info(f"Answer generation with local model:{personaSplit.teacherModel.modelId}")
                answerResponses=generateAnswers(
                   questions=currQuestions,
                   model=personaSplit.teacherModel.createModelInstance(),
                )
            else:
                log.info(f"Answer generation with local model:{teacherModel.modelId}")
                answerResponses=generateAnswers(
                   questions=currQuestions,
                   model=teacherModelInstance,

                )
            #againg shouldnt happen just in case
            if answerResponses is None or len(answerResponses)==0:
                log.error(f"Answer list was empty for split:{personaSplit.split}")
                _recordSplitError(
                    stats=stats,
                    split=personaSplit.split,
                    stage="answer_generation",
                    error=ValueError("Generated answer list is empty"),
                    retryable=False,
                )
                stats["failedSplits"] += 1
                continue

            #check for errors and exceptions
            for q in answerResponses:
                if  isinstance(q,Exception):
                    #set apiExceptionRaised to true to ensure we dont make futher calls
                    if not apiExceptionRaised:
                        log.error(f'''Api call to openrouter has returned an exception while generation answers for {personaSplit}:{currDomain},will be creating partial dataset''')
                        apiExceptionRaised=True
                    if not splitHadError:
                        splitHadError=True
                    #do logging
                    if not answerErrorLogged:
                        _recordSplitError(
                            stats=stats,
                            split=personaSplit.split,
                            stage="answer_generation",
                            error=q,
                            retryable=True,
                        )
                        answerErrorLogged=True
                    currAnswers.append('')
                else :
                    currAnswers.append(str(q.content))

        #append to the dataset
        inputPersonas.extend(currInputPersonas)
        domains.extend([currDomain]*len(currInputPersonas))
        questions.extend(currQuestions)
        answers.extend(currAnswers)
        #determining if it is a failed or succesfull split
        if splitHadError:
            stats["failedSplits"] += 1
        else:
            stats["successfulSplits"] += 1

        completeRows=0
        for q,a in zip(currQuestions,currAnswers):
            if q!='' and a!='':
                completeRows+=1
        stats["rowsGenerated"] += completeRows

    #create the dataset
    fileLocation=DATASET_FOLDER+datasetName+'.csv'
    log.info(f"creating the dataset at {fileLocation}")
    #final check to see if all rows are the same size shouldnt happen but yeah
    if len(inputPersonas)>len(questions):
        questions.extend(['']*(len(inputPersonas)-len(questions)))
    if len(inputPersonas)>len(answers):
        answers.extend(['']*(len(inputPersonas)-len(answers)))
    df = pd.DataFrame(list(zip(inputPersonas,domains, questions, answers)),
                          columns=['persona','domain','Question', 'Answer'])
    # ensure dataset folder exists and save
    df.to_csv(fileLocation, index=False)
    log.info("saved the dataset" )
    stats['datasetSaveLocation']=fileLocation
    stats["rowsFailed"] = max(stats["totalRowsRequested"] - stats["rowsGenerated"], 0)
    return stats

if __name__=="__main__":
    choices: List[Dict[Domain, personaSplitsChoices]] = [
            {"math": personaSplitsChoices(size=2)},
            {"tool": personaSplitsChoices(size=3,split="general")}
    ]
    try:
        print(generateDataset(personaConfig=choices,datasetSize=5,datasetName="test_2domain_after_refactor"))
    except Exception as e:
        print(e)
