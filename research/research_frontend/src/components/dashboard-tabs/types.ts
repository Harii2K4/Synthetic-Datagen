import type { ReactNode } from "react";

export type TabId = "questions" | "metrics" | "tab-3" | "tab-4" | "tab-5";

export type QuestionRecord = {
  id: string;
  datasetId: string;
  datasetLabel: string;
  persona: string;
  domain: string;
  question: string;
  topic: string;
};

export type DatasetSummaryMetrics = {
  sampleCount: number;
  embeddingDimension: number;
  meanPairwiseCosineSimilarity: number;
  p90PairwiseSimilarity: number;
  meanNearestNeighborSimilarity: number;
  topicEntropy: number;
  uniqueTopicCount: number;
  distinct2: number;
};

export type DatasetSummaryMetricRow = DatasetSummaryMetrics & {
  datasetId: string;
  datasetLabel: string;
};

export type DatasetSummaryTopicDistributionItem = {
  topic: string;
  count: number;
  percentage: number;
};

export type DatasetSummaryRecord = {
  datasetId: string;
  datasetLabel: string;
  sourceFile: string;
  metrics: DatasetSummaryMetrics;
  topicDistribution: DatasetSummaryTopicDistributionItem[];
};

export type DatasetMetricsSummaryResult = {
  generatedAt: string;
  datasetCount: number;
  metricsTable: DatasetSummaryMetricRow[];
  datasets: DatasetSummaryRecord[];
  plots?: Record<string, string>;
};

export type SummaryArtifactOption = {
  id: string;
  label: string;
  result: DatasetMetricsSummaryResult;
};

export type LlmJudgeDatasetStats = {
  pointsTotal: number;
  averageRank: number;
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
};

export type LlmJudgeModelStats = {
  validRoundCount: number;
  invalidResponseCount: number;
  datasetStats: Record<string, LlmJudgeDatasetStats>;
};

export type LlmJudgeRunMetadata = {
  timestamp: string;
  roundsRequested: number;
  roundsCompleted: number;
  datasets: string[];
  models: string[];
  sampling?: string;
  randomSeed?: number | null;
  scoring?: {
    borda?: Record<string, number>;
    rankMetric?: string;
  };
};

export type LlmJudgeSummaryResult = {
  runMetadata: LlmJudgeRunMetadata;
  perModel: Record<string, LlmJudgeModelStats>;
};

export type LlmJudgeArtifactOption = {
  id: string;
  label: string;
  result: LlmJudgeSummaryResult;
};

export type TopicDistributionItem = {
  topicName: string;
  count: number;
  percentage: number;
};

export type TopicCoverageSummary = {
  coveredTopicsCount: number;
  totalTopicsCount: number;
  coveragePercentage: number;
  coveredTopics: string[];
  missingTopics: string[];
  unexpectedTopics: string[];
};

export type TopicDatasetMetrics = {
  totalSamples: number;
  uniqueTopicsCount: number;
  observedTopics: string[];
  dominantTopicName: string | null;
  dominantTopicCount: number;
  dominantTopicPercentage: number;
  topicCountMap: Record<string, number>;
  topicPercentageMap: Record<string, number>;
  topicDistribution: TopicDistributionItem[];
  topicCoverage: TopicCoverageSummary;
};

export type TopicComparisonSummary = {
  sharedTopicsCount: number;
  sharedTopics: string[];
  baselineOnlyTopics: string[];
  personaOnlyTopics: string[];
  coverageGapPercentagePoints: number;
};

export type TopicAnalysisResult = {
  metricName: string;
  topicUniverse: string[];
  baselineMetrics: TopicDatasetMetrics;
  personaMetrics: TopicDatasetMetrics;
  comparison: TopicComparisonSummary;
};

export type TopicAnalysisOption = {
  id: string;
  label: string;
  result: TopicAnalysisResult;
};

export type MetricPanelId = "baseline" | "persona" | "combined" | "comparison";

export type MetricPanelTone = "baseline" | "persona" | "combined";

export type TabItem = {
  id: TabId;
  label: string;
  eyebrow: string;
};

export type DatasetOption = {
  id: string;
  label: string;
};

export type TopicMatrixRow = {
  topicName: string;
  status: string;
  baselineCount: number;
  baselinePercentage: number;
  personaCount: number;
  personaPercentage: number;
  combinedCount: number;
  combinedPercentage: number;
};

export type QuestionsTabContentProps = {
  topicFilter: string;
  onTopicFilterChange: (value: string) => void;
  allTopics: string[];
  leftMatchesCount: number;
  rightMatchesCount: number;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
};

export type MetricsTabContentProps = {
  selectedAnalysisId: string;
  onSelectedAnalysisChange: (value: string) => void;
  topicAnalyses: Array<{ id: string; label: string }>;
  showEmptyTopics: boolean;
  onShowEmptyTopicsChange: (value: boolean) => void;
  enabledPanels: Record<MetricPanelId, boolean>;
  panelLabels: Record<MetricPanelId, string>;
  onTogglePanel: (panelId: MetricPanelId) => void;
  hasActiveAnalysis: boolean;
  selectedAnalysisLabel?: string;
  selectedAnalysesCount: number;
  coverageGapPercentagePoints: number;
  sharedTopicsCount: number;
  topicUniverseCount: number;
  sharedTopics: string[];
  baselineOnlyTopics: string[];
  personaOnlyTopics: string[];
  baselinePanel: ReactNode;
  personaPanel: ReactNode;
  combinedPanel: ReactNode;
  topicRows: TopicMatrixRow[];
};

export type SummaryTabContentProps = {
  selectedSummaryId: string;
  onSelectedSummaryChange: (value: string) => void;
  summaryArtifacts: Array<{ id: string; label: string }>;
  activeSummary: DatasetMetricsSummaryResult | null;
  selectedSummaryLabel?: string;
};

export type LlmJudgeTabContentProps = {
  selectedJudgeId: string;
  onSelectedJudgeChange: (value: string) => void;
  judgeArtifacts: Array<{ id: string; label: string }>;
  activeJudge: LlmJudgeSummaryResult | null;
  selectedJudgeLabel?: string;
};
