"""
file:server.py
description:File contain the endpoints for the fast api server
"""

import asyncio
import json
import os
from typing import Literal, Optional
from uuid import uuid4

import pandas as pd

# load env variables
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.openrouter_sythesis import PERSONA_FOLDER

load_dotenv()

from core.generate import generateDataset
from utils.csv_selection import filteredSelection, rangedSelection
from utils.database import (
    fetch_dashboard_summary,
    fetch_generation_history,
    fetch_generation_job,
    get_database_status,
    save_generation_run,
)
from utils.exceptions import GenerationModelNotFoundError, TeacherModelNotFoundError
from utils.logger import Logger
from utils.models import (
    datasetGenerationConfig,
    datasetGenerationMetrics,
    datasetGenerationRequest,
    personaSplits,
)

# Set up logging
log = Logger(__name__)

# Global variables
DATASET_FOLDER = "./data/datasets/"
PROJECT_ROOT = os.path.abspath(".")
# create the app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _persist_generation_result(
    request_payload: dict,
    stats: dict,
    retried_from_job_id: Optional[str] = None,
) -> None:
    """Persist generation result to Supabase without breaking request flow on DB errors."""
    ok, err = save_generation_run(
        job_id=stats.get("jobId", request_payload.get("jobId", "")),
        request_payload=request_payload,
        stats=stats,
        retried_from_job_id=retried_from_job_id,
    )
    if not ok:
        log.warning(f"Supabase persistence skipped/failed: {err}")


def _apply_generation_status(stats: dict, job_id: str) -> dict:
    if stats["failedSplits"] == stats["totalSplits"]:
        stats["status"] = "failure"
    elif stats["successfulSplits"] == stats["totalSplits"]:
        stats["status"] = "success"
    else:
        stats["status"] = "partial"
    stats["jobId"] = job_id
    return stats


# NOTE:always create the fixed routes first
# create the endpoints
@app.get("/")
def readRoot():
    """Root endpoint to check if server is running.

    Returns:
        str: Confirmation message that server is working
    """
    return "hello server is working boy"


# dataset related endpoints
@app.get("/dataset")
def listDatasets():
    """List all available CSV datasets in the dataset folder.

    Returns:
        dict: Dictionary containing list of dataset filenames
    """
    datasets = []
    for file in os.listdir(DATASET_FOLDER):
        if file.endswith(".csv"):
            datasets.append(file)
    return {"datasetList": datasets}


@app.get("/dataset/{datasetName:path}")
def viewDataset(datasetName: str, lowerLimit: int, upperLimit: int):
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
    # if datasets folder doesnt exists in disk
    if not os.path.exists(DATASET_FOLDER):
        log.error(
            f"Dataset folder not found create it or run setup.py:{DATASET_FOLDER}"
        )
        raise HTTPException(
            status_code=404, detail=f"Dataset folder not found at {DATASET_FOLDER}"
        )

    fileLocation = DATASET_FOLDER + datasetName

    # TODO:change this to load only the required rows
    try:
        df = pd.read_csv(fileLocation)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(
            status_code=404, detail=f"Invalid dataset file '{datasetName}': {e}"
        ) from e
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"Dataset not found at {fileLocation}"
        )
    # validate the row ranges
    if lowerLimit < 0:
        log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
        lowerLimit = 0
    if upperLimit > df.shape[0]:
        log.warning(f"upperLimit is out of index setting to last index:{upperLimit}")
        upperLimit = df.shape[0]

    df: pd.DataFrame = df.iloc[lowerLimit:upperLimit]
    responseDf = str(df.to_json(orient="records"))
    rowsReturned = len(json.loads(responseDf))

    log.info(
        f"Successfully sent requested rows {lowerLimit}:{upperLimit} for {datasetName}"
    )
    return JSONResponse({"dataset": responseDf, "rowsReturned": rowsReturned})


@app.post("/dataset", response_model=datasetGenerationMetrics)
async def datasetGeneration(request: datasetGenerationRequest):
    """Generate a new dataset based on persona configuration.

    Args:
        request: Dataset generation request containing configuration and job ID

    Returns:
        datasetGenerationMetrics: Statistics about the generated dataset including status

    Raises:
        HTTPException: If generation or teacher model not found, or invalid configuration
    """
    # check if api key is present .env if not sleep for 5 checks and return mocked dataset

    if not os.getenv("OPENROUTER_API_KEY"):
        # TODO Get the mocked dataset for viewing with mocked stats
        log.info("No api key found in .env mocking the data")
        await asyncio.sleep(5)
        stats = datasetGenerationMetrics.mock(jobid=request.jobId)
        _persist_generation_result(
            request_payload=request.model_dump(),
            stats=stats.model_dump(),
        )
        return stats

    try:
        log.info(f"generating dataset for jobID:{request.jobId}")
        stats = generateDataset(
            personaConfig=request.config.personaConfig,
            datasetSize=request.config.datasetSize,
            generationModel=request.config.generationModel,
            teacherModel=request.config.teacherModel,
            datasetName=request.config.datasetName,
        )
    except (GenerationModelNotFoundError, TeacherModelNotFoundError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    stats = _apply_generation_status(stats=stats, job_id=request.jobId)
    _persist_generation_result(
        request_payload=request.model_dump(),
        stats=stats,
    )
    return stats


@app.post("/dataset/retry/{jobId}", response_model=datasetGenerationMetrics)
async def retryDatasetGeneration(jobId: str):
    """Retry generation for a previously saved job config from Supabase."""
    if os.getenv("OPENROUTER_API_KEY") is None:
        raise HTTPException(
            status_code=400,
            detail="OPENROUTER_API_KEY missing. Add credits/key and retry.",
        )

    jobRow, dbErr = fetch_generation_job(jobId)
    if dbErr is not None:
        raise HTTPException(status_code=503, detail=dbErr)
    if jobRow is None:
        raise HTTPException(status_code=404, detail=f"No job found for jobId:{jobId}")

    requestPayload = jobRow.get("request_payload")
    if not isinstance(requestPayload, dict):
        raise HTTPException(
            status_code=422, detail=f"Invalid request payload saved for jobId:{jobId}"
        )

    configPayload = requestPayload.get("config")
    if not isinstance(configPayload, dict):
        raise HTTPException(
            status_code=422, detail=f"Missing config in saved payload for jobId:{jobId}"
        )

    try:
        config = datasetGenerationConfig.model_validate(configPayload)
    except Exception as e:
        raise HTTPException(
            status_code=422, detail=f"Saved config validation failed: {e}"
        )

    retryJobId = f"{jobId}-retry-{uuid4().hex[:8]}"
    try:
        stats = generateDataset(
            personaConfig=config.personaConfig,
            datasetSize=config.datasetSize,
            generationModel=config.generationModel,
            teacherModel=config.teacherModel,
            datasetName=config.datasetName,
        )
    except (GenerationModelNotFoundError, TeacherModelNotFoundError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    stats = _apply_generation_status(stats=stats, job_id=retryJobId)
    retryPayload = {
        "jobId": retryJobId,
        "config": config.model_dump(),
    }
    _persist_generation_result(
        request_payload=retryPayload,
        stats=stats,
        retried_from_job_id=jobId,
    )

    return stats


@app.get("/dashboard/summary")
def getDashboardSummary(limit: int = 500):
    summary, err = fetch_dashboard_summary(limit=limit)
    if err is not None:
        raise HTTPException(status_code=503, detail=err)
    return summary


@app.get("/dashboard/history")
def getDashboardHistory(limit: int = 50, offset: int = 0):
    history, err = fetch_generation_history(limit=limit, offset=offset)
    if err is not None:
        raise HTTPException(status_code=503, detail=err)
    return {"history": history, "limit": limit, "offset": offset}


@app.get("/dashboard/history/{jobId}")
def getDashboardHistoryDetails(jobId: str):
    details, err = fetch_generation_job(jobId)
    if err is not None:
        raise HTTPException(status_code=503, detail=err)
    if details is None:
        raise HTTPException(
            status_code=404, detail=f"No history row found for jobId:{jobId}"
        )
    return {"details": details}


@app.get("/dashboard/database_status")
def getDashboardDatabaseStatus():
    return get_database_status()


# @app.get("/dashboard/schema_sql")
# def getDashboardSchemaSQL():
#     return {"sql":get_schema_sql()}


# persona endpoints
@app.get("/persona_hub")
def getPersonList():
    """List all available persona split files in the persona hub.

    Returns:
        dict: Dictionary containing list of persona split filenames
    """
    personaSplits = []
    for file in os.listdir(PERSONA_FOLDER):
        if file.endswith(".csv"):
            personaSplits.append(file)
    return {"personaSplits": personaSplits}


@app.get("/persona_hub/{personaSplit}")
def viewPersonaSplit(
    personaSplit: personaSplits,
    noOfRows: int,
    lowerLimit: Optional[int] = None,
    upperLimit: Optional[int] = None,
    method: Literal["range", "filter", "hybrid"] = "range",
    filter: Optional[Literal["user", "system"]] = "system",
):
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
        fileLocation = PERSONA_FOLDER + "persona.csv"
    else:
        fileLocation = PERSONA_FOLDER + f"persona_{personaSplit}.csv"

    # if datasets folder doesnt exists in disk
    if not os.path.exists(PERSONA_FOLDER):
        log.error(
            f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}"
        )
        raise HTTPException(
            status_code=404, detail=f"personaSplit folder not found at {PERSONA_FOLDER}"
        )
    try:
        # TODO:change this to load only the required rows
        df = pd.read_csv(fileLocation)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(
            status_code=404, detail=f"Invalid personaSplit file '{personaSplit}': {e}"
        ) from e
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"personaSplit not found at {fileLocation}"
        )
    if method == "filter":
        if filter is None:
            raise HTTPException(
                status_code=422,
                detail=f"Filter type is not provided please choose system or user:{method}",
            )
        try:
            df, requestedRows = filteredSelection(df, filter, noOfRows)
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))
    elif method == "range":
        try:
            df, requestedRows = rangedSelection(df, lowerLimit, upperLimit)
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        if filter is None:
            raise HTTPException(
                status_code=422,
                detail=f"Filter type is not provided please choose system or user:{method}",
            )
        try:
            df, _ = rangedSelection(df, lowerLimit, upperLimit)
            df, requestedRows = filteredSelection(df, filter, noOfRows)
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))

    responseDf = str(df.to_json(orient="records"))
    rowsReturned = len(json.loads(responseDf))
    log.info(
        f"Successfully sent requested rows {lowerLimit}:{upperLimit} for {personaSplit}"
    )
    return JSONResponse(
        {
            "dataset": responseDf,
            "rowsReturned": rowsReturned,
            "rowsRequested": requestedRows,
        }
    )


# TODO: persona updating
@app.post("/persona_hub/{personaSplit}")
def addPersonaToSplit(personaSplit: personaSplits, persona: str):
    """Add a new persona to a specific persona split file.

    Args:
        personaSplit: Name of the persona split to add to
        persona: Persona text to add

    Returns:
        dict: Success message confirming persona was added

    Raises:
        HTTPException: If persona folder not found
    """
    fileLocation = PERSONA_FOLDER + f"persona_{personaSplit}.csv"
    if not os.path.exists(PERSONA_FOLDER):
        log.error(
            f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}"
        )
        raise HTTPException(
            status_code=404, detail=f"personaSplit folder not found at {PERSONA_FOLDER}"
        )

    # row to add to the file
    personaInput = persona + "," + "user"
    with open(fileLocation, "a") as f:
        log.info(f"writing persona in to split:{personaSplit}")
        f.write(personaInput)
    log.info(f"Successfully written persona into split:{personaSplit}")
    return {"message": f"Successfully written persona into split:{personaSplit}"}


# general csv endpoints
@app.get("/csv")
def getNumberOfRows(fileName: str, dataType: Literal["dataset", "persona"]):
    """Get the number of rows in a CSV file (dataset or persona).

    Args:
        fileName: Name of the CSV file
        dataType: Type of data ('dataset' or 'persona')

    Returns:
        dict: Number of rows in the specified file

    Raises:
        HTTPException: If folder not found, file not found, or invalid file format
    """
    if dataType == "dataset":
        if not os.path.exists(DATASET_FOLDER):
            log.error(f"dataset folder not found create it:{DATASET_FOLDER}")
            raise HTTPException(
                status_code=404, detail=f"dataset folder not found at {DATASET_FOLDER}"
            )
        fileLocation = DATASET_FOLDER + fileName

    else:
        if not os.path.exists(PERSONA_FOLDER):
            log.error(
                f"personaSplit folder not found create it or run setup.py:{PERSONA_FOLDER}"
            )
            raise HTTPException(
                status_code=404,
                detail=f"personaSplit folder not found at {PERSONA_FOLDER}",
            )
        if fileName == "general":
            fileLocation = PERSONA_FOLDER + "persona.csv"
        else:
            fileLocation = PERSONA_FOLDER + f"persona_{fileName}.csv"
    try:
        df = pd.read_csv(fileLocation)
        log.info(f"Successfully loaded file :{fileName}")
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise HTTPException(
            status_code=404, detail=f"Invalid filename '{fileName}': {e}"
        ) from e
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found at {fileLocation}")
    return {"NoOfRows": df.shape[0]}


# supabase endpoints
