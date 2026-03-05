import pandas as pd
from typing import Tuple,Literal
import os,sys
#add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import Logger

log=Logger(__name__)

def filteredSelection(
    df:pd.DataFrame,
    filter:Literal["user","system"],
    noOfRows:int,

)->Tuple[pd.DataFrame,int]:
    """
    This function is used to filter the contents of the dataframe based on the wether
    the person is user or system defined.

    Args:
        df:pd.DataFrame
        filter:Literal["user","system"]
        noOfRows:int

    Returns:
        Tuple[pd.DataFrame,int]:

    """
    #filter the df
    filteredDf=df[df['origin']==filter]
    noOfRowsRetrieved=filteredDf.shape[0]

    log.info(f"retrieved {noOfRowsRetrieved} from using filter ({filter})")

    #if requested for than retrieved
    if noOfRowsRetrieved<noOfRows:
        log.warning(f"No of requested rows is greated than retrieved,returning all retrieved")
        rowsReturned=noOfRowsRetrieved
    else:
        rowsReturned=noOfRows

    df=filteredDf.iloc[:rowsReturned,:]
    requestedRows=noOfRows

    return df,requestedRows

def rangedSelection(
    df:pd.DataFrame,
    lowerLimit:int|None,
    upperLimit:int|None,

)->Tuple[pd.DataFrame,int]:
    """
    This function is used to select the rows from the dataframe based on the range
    Used for pagination in the frontend

    Args:
        df:pd.DataFrame
        lowerLimit:int
        upperLimit:int

    Returns:
        Tuple[pd.DataFrame,int]
    Raises:
        Exception: If lowerLimit or upperLimit is not provided
    """
    if  lowerLimit is None or upperLimit is None:
        raise Exception(f'''Either upperLimit({upperLimit}) or lowerLimit({lowerLimit})
                            is not provided''')
    #validate the row ranges
    if lowerLimit>upperLimit:
        log.warning(f"lowerLimit is greater than the upperLimit and will be swapped")
        temp=lowerLimit
        lowerLimit,upperLimit = upperLimit,temp
    if lowerLimit<0:
        log.warning(f"lowerLimit is negative setting to zero:{lowerLimit}")
        lowerLimit=0
    if upperLimit>df.shape[0]:
        log.warning(f"upperLimit is out of index setting to last index:{upperLimit}")
        upperLimit=df.shape[0]

    returnDf:pd.DataFrame=df.iloc[lowerLimit:upperLimit]
    requestedRows=upperLimit-lowerLimit

    return returnDf,requestedRows

