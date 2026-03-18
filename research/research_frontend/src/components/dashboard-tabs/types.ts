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
