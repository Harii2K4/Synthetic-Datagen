"""
file:server.py
description:File contain the endpoints for the fast api server
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os,json
import asyncio
from typing import Literal, Optional
#load env variables
from dotenv import load_dotenv

from core.openrouter_sythesis import PERSONA_FOLDER
load_dotenv()

from core.generate import generateDataset
from utils.csv_selection import filteredSelection,rangedSelection
from utils.exceptions import TeacherModelNotFoundError,GenerationModelNotFoundError
from utils.logger import Logger
from utils.models import datasetGenerationMetrics, datasetGenerationRequest, personaSplits
log=Logger(__name__)

#Global variables
DATASET_FOLDER="./data/datasets/"
PERSONA_FOLDER="./data/persona_hub/"
PROJECT_ROOT=os.path.abspath(".")
#create the app
app =FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#NOTE:always create the fixed routes first
#create the endpoints
@app.get("/")
def readRoot():
    """Root endpoint to check if server is running.
    
    Returns:
        str: Confirmation message that server is working
    """
    return "hello server is working boy"

#dataset related endpoints
@app.get("/dataset")
def listDatasets():
    """List all available CSV datasets in the dataset folder.
    
    Returns:
        dict: Dictionary containing list of dataset filenames
    """
    datasets=[]
    for file in os.listdir(DATASET_FOLDER):
        if file.endswith('.csv'):
            datasets.append(file)
    return {"datasetList":datasets}


@app.get("/dataset/{datasetName:path}")
def viewDataset(datasetName:str,lowerLimit:int,upperLimit:int):
    """View a specific dataset with row range limits.
    
    Args:
        datasetName: Name of the dataset file to view
        lowerLimit: Starting row index (inclusive)
        upperLimit: Ending row index (exclusive)
    
    Returns:
        JSONResponse: Dataset rows within specified range and count of rows returned
    
    Raises:
        HTTPException: If dataset folder not found, file not found, or invalid file format
    """
    log.info(f"Dataset Name {datasetName}")
    #if datasets folder doesnt exists in disk
    if  not os.path.exists(DATASET_FOLDER):
        log.error(f"Dataset folder not found create it or run setup.py:{DATASET_FOLDER}")
        raise HTTPException(status_code=404,detail=f"Dataset folder not found at {DATASET_FOLDER}")

    fileLocation=DATASET_FOLDER+datasetName

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
async def datasetGeneration(request:datasetGenerationRequest):
    """Generate a new dataset based on persona configuration.
    
    Args:
        request: Dataset generation request containing configuration and job ID
    
    Returns:
        datasetGenerationMetrics: Statistics about the generated dataset including status
    
    Raises:
        HTTPException: If generation or teacher model not found, or invalid configuration
    """
    #check if api key is present .env if not sleep for 5 checks and return mocked dataset

    if  os.getenv("OPENROUTER_API_KEY") is None:
        #TODO Get the mocked dataset for viewing with mocked stats
        log.info("No api key found in .env mocking the data")
        await asyncio.sleep(5)
        stats=datasetGenerationMetrics.mock()
        return stats

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
    """List all available persona split files in the persona hub.
    
    Returns:
        dict: Dictionary containing list of persona split filenames
    """
    personaSplits=[]
    for file in os.listdir(PERSONA_FOLDER):
        if file.endswith('.csv'):
            personaSplits.append(file)
    return {"personaSplits":personaSplits}


@app.get("/persona_hub/{personaSplit}")
def viewPersonaSplit(personaSplit:personaSplits,
                     noOfRows:int,
                     lowerLimit:Optional[int]=None,
                     upperLimit:Optional[int]=None,
                     method:Literal["range","filter","hybrid"]='range',
                     filter:Optional[Literal["user","system"]]='system'):
    """View a specific persona split with various selection methods.
    
    Args:
        personaSplit: Name of the persona split to view
        noOfRows: Number of rows to return
        lowerLimit: Starting row index for range method
        upperLimit: Ending row index for range method
        method: Selection method ('range', 'filter', or 'hybrid')
        filter: Filter type ('user' or 'system') for filter method
    
    Returns:
        JSONResponse: Persona data, rows returned, and rows requested
    
    Raises:
        HTTPException: If persona folder not found, file not found, or invalid parameters
    """

    if personaSplit == "general":
        fileLocation=PERSONA_FOLDER+"persona.csv"
    else:
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
    if method=="filter":
        if filter is None:
            raise HTTPException(status_code=422,detail=f"Filter type is not provided please choose system or user:{method}")
        try:
            df,requestedRows=filteredSelection(df,filter,noOfRows)
        except Exception as e:
            raise HTTPException(status_code=422,
                                detail=str(e))
    elif method=="range":
        try:
            df,requestedRows=rangedSelection(df,lowerLimit,upperLimit)
        except Exception as e:
            raise HTTPException(status_code=422,
                                detail=str(e))
    else:
        if filter is None:
            raise HTTPException(status_code=422,detail=f"Filter type is not provided please choose system or user:{method}")
        try:
            df,_=rangedSelection(df,lowerLimit,upperLimit)
            df,requestedRows=filteredSelection(df,filter,noOfRows)
        except Exception as e:
            raise HTTPException(status_code=422,
                                detail=str(e))


    responseDf=str(df.to_json(orient="records"))
    rowsReturned=len(json.loads(responseDf))
    log.info(f"Successfully sent requested rows {lowerLimit}:{upperLimit} for {personaSplit}")
    return JSONResponse({"dataset":responseDf,
                         "rowsReturned":rowsReturned,
                         "rowsRequested":requestedRows})


#TODO: persona updating
@app.post("/persona_hub/{personaSplit}")
def addPersonaToSplit(personaSplit:personaSplits,persona:str):
    """Add a new persona to a specific persona split file.
    
    Args:
        personaSplit: Name of the persona split to add to
        persona: Persona text to add
    
    Returns:
        dict: Success message confirming persona was added
    
    Raises:
        HTTPException: If persona folder not found
    """
    fileLocation=PERSONA_FOLDER+f"persona_{personaSplit}.csv"
    if  not os.path.exists(PERSONA_FOLDER):
        log.error(f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}")
        raise HTTPException(status_code=404,detail=f"personaSplit folder not found at {PERSONA_FOLDER}")

    #row to add to the file
    personaInput=persona+","+"user"
    with open(fileLocation,"a")as f:
        log.info(f"writing persona in to split:{personaSplit}")
        f.write(personaInput)
    log.info(f"Successfully written persona into split:{personaSplit}")
    return {"message":f"Successfully written persona into split:{personaSplit}"}


#general csv endpoints
@app.get("/csv")
def getNumberOfRows(fileName:str,dataType:Literal["dataset","persona"]):
    """Get the number of rows in a CSV file (dataset or persona).
    
    Args:
        fileName: Name of the CSV file
        dataType: Type of data ('dataset' or 'persona')
    
    Returns:
        dict: Number of rows in the specified file
    
    Raises:
        HTTPException: If folder not found, file not found, or invalid file format
    """
    if dataType=="dataset":
        if  not os.path.exists(DATASET_FOLDER):
            log.error(f"dataset folder not found create it:{DATASET_FOLDER}")
            raise HTTPException(status_code=404,detail=f"dataset folder not found at {DATASET_FOLDER}")
        fileLocation=DATASET_FOLDER+fileName

    else:
        if  not os.path.exists(PERSONA_FOLDER):
            log.error(f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}")
            raise HTTPException(status_code=404,detail=f"personaSplit folder not found at {PERSONA_FOLDER}")
        if fileName == "general":
            fileLocation=PERSONA_FOLDER+"persona.csv"
        else:
            fileLocation=PERSONA_FOLDER+f"persona_{fileName}.csv"
    try:
        df=pd.read_csv(fileLocation)
        log.info(f"Successfully loaded file :{fileName}")
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(status_code=404,detail=f"Invalid filename '{fileName}': {e}") from e
    except FileNotFoundError :
        raise HTTPException(status_code=404,detail=f"File not found at {fileLocation}")
    return{"NoOfRows":df.shape[0]}



#supabase endpoints


