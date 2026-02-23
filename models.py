"""
file:models.py
description: Used to define the pydantic models used for type checking
"""

from pydantic import BaseModel,Field
from typing import List ,Literal,Optional


personaSplits = Literal[
    "math",
    "instruction",
    "knowledge",
    "reasoning",
    "tool",
    "npc",
    "general",
]
Domain = Literal[
    "math",
    "instruction",
    "knowledge",
    "reasoning",
    "tool",
    "npc",
]
class personaSplitsChoices(BaseModel):
    split:personaSplits=Field(default="general",description="the csv file to use for personas")
    selectionMethod:Literal["random","sequence","selected"]=Field(default="sequence",description="the method to choose the personas")
    selectionList:Optional[List[int]]=Field(default=None,description="the list of indexes to use for selecting personas")
    seed:int=42
    size:int







