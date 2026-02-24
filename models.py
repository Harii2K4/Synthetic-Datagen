"""
file:models.py
description: Used to define the pydantic models used for type checking
"""

from pydantic import BaseModel,Field,model_validator
from typing import List ,Literal,Optional,Self,Dict,Any

from langchain_openrouter import ChatOpenRouter

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


class ModelConfig(BaseModel):
    modelId:str
    temperature:float=0
    reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=Field(default='none',description="for choosing reasoning effort affects tokens out")
    reasoningSummary:Literal['auto', 'concise', 'detailed']=Field(default='auto',description="for choosing reasoning summary length affects tokens out")
    providerPriority:Optional[List[str]]=Field(default=None,description="used for specifying order of providers to use")
    route:Optional[str]=Field(default=None,description="used to route the model if providers list is wrong or unavailable")



    @model_validator(mode="after")  #runs after the model is initialized so the self are no longer dict but model arguements
    def checkConstraints(self)->Self:
        """checks if the temperature is valid between 0.0 and 2 and clips it if not"""
        if self.temperature <0:
            self.temperature=0
        if self.temperature >2:
            self.temperature=2
        return self


    def createModelInstance(self)->ChatOpenRouter:
        #create the model configuration
        modelConfig={
                "model":self.modelId,
                "temperature":self.temperature,
                "reasoning":{"effort":self.reasoningEffort,"summary":self.reasoningSummary},
                "openrouter_provider":{"order":self.providerPriority},
                "route":self.route
                }

        model=ChatOpenRouter(**modelConfig)
        return model



class generationModelConfig(ModelConfig):
    reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=Field(default='none',description="for choosing reasoning effort affects tokens out")

class teacherModelConfig(ModelConfig):
    reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=Field(default='medium',description="for choosing reasoning effort affects tokens out")

class personaSplitsChoices(BaseModel):
    split:personaSplits=Field(default="general",description="the csv file to use for personas")
    selectionMethod:Literal["random","sequence","selected"]=Field(default="sequence",description="the method to choose the personas")
    selectionList:Optional[List[int]]=Field(default=None,description="the list of indexes to use for selecting personas")
    seed:int=42
    generationModel:Optional[generationModelConfig]=None
    teacherModel:Optional[teacherModelConfig]=None
    size:int

    def returnSplitConfig(self)->Dict[str,Any]:
        return {
                "split":self.split,
                "selectionMethod":self.selectionMethod,
                "selectionList":self.selectionList,
                "seed":self.seed,
                "size":self.size,
            }






