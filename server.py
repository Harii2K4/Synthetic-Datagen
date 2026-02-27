"""
file:server.py
description:File contain the endpoints for the fast api server
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import os,json
#load env variables
from dotenv import load_dotenv

from core.openrouter_sythesis import PERSONA_FOLDER, createPersonaList
load_dotenv()

from core.generate import generateDataset
from utils.exceptions import TeacherModelNotFoundError,GenerationModelNotFoundError
from utils.logger import Logger
from utils.models import datasetGenerationMetrics, datasetGenerationRequest, personaSplits
log=Logger(__name__)

#Global variables
DATASET_FOLDER="./data/datasets/"
PERSONA_FOLDER="./data/persona_hub/"
#create the app
app =FastAPI()

#NOTE:always create the fixed routes first
#create the endpoints
@app.get("/")
def readRoot():
    return "hello server is working boy"

#dataset related endpoints
@app.get("/dataset")
def listDatasets():
    datasets=[]
    for file in os.listdir(DATASET_FOLDER):
        if file.endswith('.csv'):
            datasets.append(file)
    return {"datasetList":datasets}

@app.get("/dataset/{datasetName}")
def viewDataset(datasetName:str,lowerLimit:int,upperLimit:int):
    fileLocation=DATASET_FOLDER+datasetName+".csv"

    #if datasets folder doesnt exists in disk
    if  not os.path.exists(DATASET_FOLDER):
        log.error(f"Dataset folder not found create it or run setup.py:{DATASET_FOLDER}")
        raise HTTPException(status_code=404,detail=f"Dataset folder not found at {DATASET_FOLDER}")
    #TODO:change this to load only the required rows
    try:
        df=pd.read_csv(fileLocation)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(status_code=404,detail=f"Invalid dataset file '{datasetName}': {e}") from e
    except FileNotFoundError :
        raise HTTPException(status_code=404,detail=f"Dataset not found at {fileLocation}")
    #validate the row ranges
    if lowerLimit<0:
        log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
        lowerLimit=0
    if upperLimit>df.shape[0]:
        log.warning(f"upperLimit is out of index setting to last index:{upperLimit}")
        upperLimit=df.shape[0]

    df:pd.DataFrame=df.iloc[lowerLimit:upperLimit]
    responseDf=str(df.to_json(orient="records"))
    rowsReturned=len(json.loads(responseDf))

    log.info(f"Successfully sent requested rows {lowerLimit}:{upperLimit} for {datasetName}")
    return JSONResponse({"dataset":responseDf,"rowsReturned":rowsReturned})

@app.post("/dataset",response_model=datasetGenerationMetrics)
def datasetGeneration(request:datasetGenerationRequest):
    #check if api key is present .env if not sleep for 5 checks and return mocked dataset
    if os.getenv("OPENROUTER_API_KEY")is None:
        #TODO Get the mocked dataset for viewing with mocked stats
        pass
    try :
        log.info(f"generating dataset for jobID:{request.jobId}")
        stats=generateDataset(
            personaConfig=request.config.personaConfig,
            datasetSize=request.config.datasetSize,
            generationModel=request.config.generationModel,
            teacherModel=request.config.teacherModel,
            datasetName=request.config.datasetName,
        )
    except (GenerationModelNotFoundError,TeacherModelNotFoundError) as e:
        raise HTTPException(status_code=422,detail=str(e))
    except (ValueError) as e:
        raise HTTPException(status_code=400,detail=str(e))
    #now we need to figure if partial failure or not
    if stats['failedSplits'] == stats['totalSplits']:
        stats['status']='failure'
    elif stats['successfulSplits'] == stats['totalSplits']:
        stats['status']='success'
    else:
        #if  0 < rowsGenerated < totalRowsRequestedor or if 0 < successfulSplits < totalSplits.
        stats['status']='partial'
    stats['jobId']=request.jobId
    return stats

#persona endpoints
@app.get("/persona_hub")
def getPersonList():
    personaSplits=[]
    for file in os.listdir(PERSONA_FOLDER):
        if file.endswith('.csv'):
            personaSplits.append(file)
    return {"personaSplits":personaSplits}


@app.get("/persona_hub/{personaSplit}")
def viewPersonaSplit(personaSplit:personaSplits,lowerLimit:int,upperLimit:int):
    fileLocation=PERSONA_FOLDER+f"persona_{personaSplit}.csv"

    #if datasets folder doesnt exists in disk
    if  not os.path.exists(PERSONA_FOLDER):
        log.error(f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}")
        raise HTTPException(status_code=404,detail=f"personaSplit folder not found at {PERSONA_FOLDER}")
    try:
        #TODO:change this to load only the required rows
        df=pd.read_csv(fileLocation)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(status_code=404,detail=f"Invalid personaSplit file '{personaSplit}': {e}") from e
    except FileNotFoundError :
        raise HTTPException(status_code=404,detail=f"personaSplit not found at {fileLocation}")
    #validate the row ranges
    if lowerLimit<0:
        log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
        lowerLimit=0
    if upperLimit>df.shape[0]:
        log.warning(f"upperLimit is out of index setting to last index:{upperLimit}")
        upperLimit=df.shape[0]

    df:pd.DataFrame=df.iloc[lowerLimit:upperLimit]
    responseDf=str(df.to_json(orient="records"))
    rowsReturned=len(json.loads(responseDf))

    log.info(f"Successfully sent requested rows {lowerLimit}:{upperLimit} for {personaSplit}")
    return JSONResponse({"dataset":responseDf,"rowsReturned":rowsReturned})


#TODO person addition and persona updating


