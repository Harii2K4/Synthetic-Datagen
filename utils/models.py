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
    """
    The model config is used to store the configuration for the model(teacher or generation)

    Attributes:
        modelId:str
        temperature:float
        reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']
        reasoningSummary:Literal['auto', 'concise', 'detailed']
        providerPriority:Optional[List[str]]
        route:Optional[str]
    """

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
        """
         create the chatopenrouter instance based on the model configuration

        Returns:
            ChatOpenRouter

        """
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
    """
    The generation model config is used to store the configuration for the generation model

    Attributes:
        reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=none
    """
    reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=Field(default='none',description="for choosing reasoning effort affects tokens out")

class teacherModelConfig(ModelConfig):
    """
    The teacher model config is used to store the configuration for the teacher model

    Attributes:
        reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=medium
    """
    reasoningEffort:Literal['xhigh', 'high', 'medium', 'low', 'minimal', 'none']=Field(default='medium',description="for choosing reasoning effort affects tokens out")

class personaSplitsChoices(BaseModel):
    """
    The persona splits choices is used to store the configuration for the persona splits
    These are used for the genration of the dataset

    Attributes:
        split:personaSplits
        selectionMethod:Literal["random","sequence","selected","ranged"]
        selectionList:Optional[List[int]]
        seed:int
        generationModel:Optional[generationModelConfig]=None
        teacherModel:Optional[teacherModelConfig]=None
        size:int
    """
    split:personaSplits=Field(default="general",description="the csv file to use for personas")
    selectionMethod:Literal["random","sequence","selected","ranged"]=Field(default="sequence",description="the method to choose the personas")
    selectionList:Optional[List[int]]=Field(default=None,description="the list of indexes to use for selecting personas")
    seed:int=42
    generationModel:Optional[generationModelConfig]=None
    teacherModel:Optional[teacherModelConfig]=None
    size:int

    def returnSplitConfig(self)->Dict[str,Any]:
        """
        returns the config for the split used to pass into createPersonaList.

        Returns:
            Dict[str,Any]

        """
        return {
                "split":self.split,
                "selectionMethod":self.selectionMethod,
                "selectionList":self.selectionList,
                "seed":self.seed,
                "size":self.size,
            }

class splitErrors(BaseModel):
    """
    The split errors is used to store the errors for the split during generation to
    send back to the user

    Attributes:
        split:personaSplits
        stage:Literal["persona_read", "question_generation", "answer_generation","validation", "unknown"]
        errorType:str
        message:str
        retryable:bool
    """
    split:personaSplits
    stage:Literal["persona_read", "question_generation", "answer_generation","validation", "unknown"]
    errorType:str
    message:str
    retryable:bool=False

#if failedSplits == totalSplits ,then total failure
#if successfulSplits == totalSplits ,then total success
#If 0 < rowsGenerated < totalRowsRequestedor or if 0 < successfulSplits < totalSplits.
class datasetGenerationMetrics(BaseModel):
    """
    The dataset generation metrics is used to store the metrics for the dataset generation
    Sent to the user in the generation response

    Attributes:
        jobId:str
        totalSplits:int
        successfulSplits:int
        failedSplits:int
        totalRowsRequested:int
        rowsGenerated:int
        rowsFailed:int
        status:Literal["success","partial","failure"]
        datasetSaveLocation:str
        errors:List[splitErrors]
    """
    jobId:str
    totalSplits:int=Field(ge=0)
    successfulSplits:int=Field(ge=0)
    failedSplits:int=Field(ge=0)
    totalRowsRequested:int=Field(ge=0)
    rowsGenerated:int=Field(ge=0)
    rowsFailed:int=Field(ge=0)
    status:Literal["success","partial","failure"]
    datasetSaveLocation:str
    errors:List[splitErrors]=Field(default_factory=list)

    @classmethod
    def mock(cls,jobid: str = "test-job-123") :
        """Return a mocked instance of datasetGenerationMetrics."""
        return cls(
            jobId=jobid,
            totalSplits=1,
            successfulSplits=1,
            failedSplits=0,
            totalRowsRequested=25,
            rowsGenerated=25,
            rowsFailed=0,
            status="success",
            datasetSaveLocation="./data/datasets/Mock_general.csv",
            errors=[],
        )

class datasetGenerationConfig(BaseModel):
    """
    The dataset generation config is used to store parameters to pass to generateDataset

    Attributes:
        personaConfig:List[Dict[Domain,personaSplitsChoices]]
        datasetSize:int
        generationModel:generationModelConfig
        teacherModel:teacherModelConfig
        datasetName:str
    """
    personaConfig:List[Dict[Domain,personaSplitsChoices]]
    datasetSize:int
    generationModel:generationModelConfig=Field(default=generationModelConfig(modelId="nvidia/nemotron-3-nano-30b-a3b:free"))
    teacherModel:teacherModelConfig=Field(default=teacherModelConfig(modelId="nvidia/nemotron-3-nano-30b-a3b:free"))
    datasetName:str="default_gen"

class datasetGenerationRequest(BaseModel):
    """
        Used to recieve and validate the incoming request from the user

    Attributes:
        jobId:str
        config:datasetGenerationConfig
    """
    jobId:str
    config:datasetGenerationConfig

class datasetGenerationResponse(BaseModel):
    """
        Used to send the response back to the user

    Attributes:
        jobId:str
        meterics:datasetGenerationMetrics
    """
    jobId:str
    meterics:datasetGenerationMetrics

    @classmethod
    def mock(cls,jobId:str):
        """
        Return a mocked instance of datasetGenerationResponse

        Args:
            jobId:str

        Returns:
            datasetGenerationResponse
        """
        metrics=datasetGenerationMetrics.mock(jobid=jobId)
        return cls(jobId=jobId,meterics=metrics)



class TopicDistributionItem(BaseModel):
    topicName: str
    count: int = Field(ge=0)
    percentage: float = Field(ge=0)


class TopicCoverageSummary(BaseModel):
    coveredTopicsCount: int = Field(ge=0)
    totalTopicsCount: int = Field(ge=0)
    coveragePercentage: float = Field(ge=0)
    coveredTopics: List[str] = Field(default_factory=list)
    missingTopics: List[str] = Field(default_factory=list)
    unexpectedTopics: List[str] = Field(default_factory=list)


class TopicDatasetMetrics(BaseModel):
    totalSamples: int = Field(ge=0)
    uniqueTopicsCount: int = Field(ge=0)
    observedTopics: List[str] = Field(default_factory=list)
    dominantTopicName: Optional[str] = None
    dominantTopicCount: int = Field(ge=0)
    dominantTopicPercentage: float = Field(ge=0)
    topicCountMap: Dict[str, int] = Field(default_factory=dict)
    topicPercentageMap: Dict[str, float] = Field(default_factory=dict)
    topicDistribution: List[TopicDistributionItem] = Field(default_factory=list)
    topicCoverage: TopicCoverageSummary


class TopicComparisonSummary(BaseModel):
    sharedTopicsCount: int = Field(ge=0)
    sharedTopics: List[str] = Field(default_factory=list)
    baselineOnlyTopics: List[str] = Field(default_factory=list)
    personaOnlyTopics: List[str] = Field(default_factory=list)
    coverageGapPercentagePoints: float


class TopicAnalysisResult(BaseModel):
    metricName: str = "topic"
    topicUniverse: List[str] = Field(default_factory=list)
    baselineMetrics: TopicDatasetMetrics
    personaMetrics: TopicDatasetMetrics
    comparison: TopicComparisonSummary


class SimilarityPerQuestionMetrics(BaseModel):
    questionIndex: int = Field(ge=0)
    topicName: Optional[str] = None
    meanSimilarityToOthers: Optional[float] = None
    medianSimilarityToOthers: Optional[float] = None
    maxSimilarityToOthers: Optional[float] = None
    nearestNeighborIndex: Optional[int] = None
    nearestNeighborSimilarity: Optional[float] = None


class SimilarityTopicMetrics(BaseModel):
    topicName: str
    sampleCount: int = Field(ge=0)
    pairCount: int = Field(ge=0)
    meanPairSimilarity: Optional[float] = None
    medianPairSimilarity: Optional[float] = None
    stdPairSimilarity: Optional[float] = None
    minPairSimilarity: Optional[float] = None
    maxPairSimilarity: Optional[float] = None
    p10PairSimilarity: Optional[float] = None
    p25PairSimilarity: Optional[float] = None
    p75PairSimilarity: Optional[float] = None
    p90PairSimilarity: Optional[float] = None
    meanNearestNeighborSimilarity: Optional[float] = None
    medianNearestNeighborSimilarity: Optional[float] = None
    maxNearestNeighborSimilarity: Optional[float] = None
    diversityScore: Optional[float] = None
    nnDiversityScore: Optional[float] = None


class SimilarityDatasetMetrics(BaseModel):
    totalSamples: int = Field(ge=0)
    pairCount: int = Field(ge=0)
    meanPairSimilarity: Optional[float] = None
    medianPairSimilarity: Optional[float] = None
    stdPairSimilarity: Optional[float] = None
    minPairSimilarity: Optional[float] = None
    maxPairSimilarity: Optional[float] = None
    p10PairSimilarity: Optional[float] = None
    p25PairSimilarity: Optional[float] = None
    p75PairSimilarity: Optional[float] = None
    p90PairSimilarity: Optional[float] = None
    meanNearestNeighborSimilarity: Optional[float] = None
    medianNearestNeighborSimilarity: Optional[float] = None
    maxNearestNeighborSimilarity: Optional[float] = None
    diversityScore: Optional[float] = None
    nnDiversityScore: Optional[float] = None
    perQuestionMetrics: List[SimilarityPerQuestionMetrics] = Field(default_factory=list)
    topicMetrics: List[SimilarityTopicMetrics] = Field(default_factory=list)


class SimilarityComparisonSummary(BaseModel):
    meanPairSimilarityGap: Optional[float] = None
    medianPairSimilarityGap: Optional[float] = None
    diversityScoreGap: Optional[float] = None
    meanNearestNeighborSimilarityGap: Optional[float] = None
    nnDiversityScoreGap: Optional[float] = None


class SimilarityAnalysisResult(BaseModel):
    metricName: str = "semantic_similarity"
    baselineMetrics: SimilarityDatasetMetrics
    personaMetrics: SimilarityDatasetMetrics
    comparison: SimilarityComparisonSummary
