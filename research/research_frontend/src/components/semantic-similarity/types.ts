export type DatasetKind = "baseline" | "persona";

export type SimilarityPerQuestionMetrics = {
  questionIndex: number;
  topicName: string | null;
  meanSimilarityToOthers: number | null;
  medianSimilarityToOthers: number | null;
  maxSimilarityToOthers: number | null;
  nearestNeighborIndex: number | null;
  nearestNeighborSimilarity: number | null;
};

export type SimilarityTopicMetrics = {
  topicName: string;
  sampleCount: number;
  pairCount: number;
  meanPairSimilarity: number | null;
  medianPairSimilarity: number | null;
  stdPairSimilarity: number | null;
  minPairSimilarity: number | null;
  maxPairSimilarity: number | null;
  p10PairSimilarity: number | null;
  p25PairSimilarity: number | null;
  p75PairSimilarity: number | null;
  p90PairSimilarity: number | null;
  meanNearestNeighborSimilarity: number | null;
  medianNearestNeighborSimilarity: number | null;
  maxNearestNeighborSimilarity: number | null;
  diversityScore: number | null;
  nnDiversityScore: number | null;
};

export type SimilarityDatasetMetrics = {
  totalSamples: number;
  pairCount: number;
  meanPairSimilarity: number | null;
  medianPairSimilarity: number | null;
  stdPairSimilarity: number | null;
  minPairSimilarity: number | null;
  maxPairSimilarity: number | null;
  p10PairSimilarity: number | null;
  p25PairSimilarity: number | null;
  p75PairSimilarity: number | null;
  p90PairSimilarity: number | null;
  meanNearestNeighborSimilarity: number | null;
  medianNearestNeighborSimilarity: number | null;
  maxNearestNeighborSimilarity: number | null;
  diversityScore: number | null;
  nnDiversityScore: number | null;
  perQuestionMetrics: SimilarityPerQuestionMetrics[];
  topicMetrics: SimilarityTopicMetrics[];
};

export type SimilarityComparisonSummary = {
  meanPairSimilarityGap: number | null;
  medianPairSimilarityGap: number | null;
  diversityScoreGap: number | null;
  meanNearestNeighborSimilarityGap: number | null;
  nnDiversityScoreGap: number | null;
};

export type SimilarityAnalysisResult = {
  metricName: string;
  baselineMetrics: SimilarityDatasetMetrics;
  personaMetrics: SimilarityDatasetMetrics;
  comparison: SimilarityComparisonSummary;
};

export type SimilarityQuestionRecord = {
  questionIndex: number;
  questionId: string;
  datasetId: string;
  datasetLabel: string;
  questionText: string;
  topicName: string;
};

export type SimilarityDatasetQuestions = {
  id: string;
  label: string;
  questions: SimilarityQuestionRecord[];
};

export type SemanticSimilarityData = {
  result: SimilarityAnalysisResult;
  matrices: Record<DatasetKind, number[][]>;
  datasets: Record<DatasetKind, SimilarityDatasetQuestions>;
};
