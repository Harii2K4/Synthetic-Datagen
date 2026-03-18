import type {
  DatasetKind,
  SimilarityDatasetQuestions,
  SimilarityPerQuestionMetrics,
} from "./types";

export function formatMetricValue(value: number | null, digits = 4) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function formatMetricPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDelta(value: number | null, digits = 4) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function hexToRgb(hex: string) {
  const normalizedHex = hex.replace("#", "");
  const safeHex = normalizedHex.length === 3
    ? normalizedHex
        .split("")
        .map((character) => `${character}${character}`)
        .join("")
    : normalizedHex;

  return {
    r: Number.parseInt(safeHex.slice(0, 2), 16),
    g: Number.parseInt(safeHex.slice(2, 4), 16),
    b: Number.parseInt(safeHex.slice(4, 6), 16),
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function interpolateColor(startHex: string, endHex: string, progress: number) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const weight = clamp(progress, 0, 1);
  return rgbToHex(
    start.r + (end.r - start.r) * weight,
    start.g + (end.g - start.g) * weight,
    start.b + (end.b - start.b) * weight,
  );
}

export function getHeatmapColor(kind: DatasetKind, value: number, isDiagonal: boolean) {
  if (isDiagonal) {
    return "#1f1a17";
  }

  const lowColor = kind === "baseline" ? "#efeaff" : "#e2fbf4";
  const highColor = kind === "baseline" ? "#5f53d5" : "#0d7d6f";
  return interpolateColor(lowColor, highColor, value);
}

export function getDatasetLabel(kind: DatasetKind) {
  return kind === "baseline" ? "Baseline" : "Persona";
}

export function questionPreview(questionText: string, maxLength = 150) {
  const normalizedText = questionText.replace(/\s+/g, " ").trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }
  return `${normalizedText.slice(0, maxLength - 1)}…`;
}

export function findQuestionByIndex(
  dataset: SimilarityDatasetQuestions,
  questionIndex: number | null,
) {
  if (questionIndex === null) {
    return null;
  }
  return (
    dataset.questions.find((question) => question.questionIndex === questionIndex) ??
    null
  );
}

export function buildQuestionMetricRows(
  dataset: SimilarityDatasetQuestions,
  metrics: SimilarityPerQuestionMetrics[],
) {
  return metrics.map((metric) => {
    const question = findQuestionByIndex(dataset, metric.questionIndex);
    return {
      metric,
      question,
      nearestNeighborQuestion: findQuestionByIndex(
        dataset,
        metric.nearestNeighborIndex,
      ),
    };
  });
}
