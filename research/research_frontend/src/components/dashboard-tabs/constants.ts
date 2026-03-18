import type { MetricPanelId, TabItem, TopicAnalysisResult } from "./types";

export const ALL_TOPICS_FILTER = "All topics";
export const ALL_TOPIC_ANALYSES_ID = "__all__";

export const DASHBOARD_TABS: TabItem[] = [
  { id: "questions", label: "Question Comparison", eyebrow: "01" },
  { id: "metrics", label: "Topic Metrics", eyebrow: "02" },
  { id: "tab-3", label: "Semantic Similarity", eyebrow: "03" },
  { id: "tab-4", label: "Tab Four", eyebrow: "04" },
  { id: "tab-5", label: "Tab Five", eyebrow: "05" },
];

export const METRIC_PANEL_LABELS: Record<MetricPanelId, string> = {
  baseline: "Baseline",
  persona: "Persona",
  combined: "Combined",
  comparison: "Comparison",
};

export const METRIC_PANEL_IDS: MetricPanelId[] = [
  "baseline",
  "persona",
  "combined",
  "comparison",
];

export const DEFAULT_ENABLED_PANELS: Record<MetricPanelId, boolean> = {
  baseline: true,
  persona: true,
  combined: true,
  comparison: true,
};

export const DATASET_MODULES = import.meta.glob(
  "../../../../../data/datasets/research_datasets/*.csv",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;

export const TOPIC_METRIC_MODULES = import.meta.glob(
  "../../../../results/topic/*.json",
  {
    eager: true,
    import: "default",
  },
) as Record<string, TopicAnalysisResult>;
