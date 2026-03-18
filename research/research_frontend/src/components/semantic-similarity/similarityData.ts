import type {
  DatasetKind,
  SemanticSimilarityData,
  SimilarityAnalysisResult,
  SimilarityDatasetQuestions,
} from "./types";

const datasetModules = import.meta.glob(
  "../../../../../data/datasets/research_datasets/*.csv",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;

const similarityModules = import.meta.glob(
  "../../../../results/semantic_similarity/*.json",
  {
    eager: true,
    import: "default",
  },
) as Record<string, unknown>;

function getFileName(filePath: string) {
  return filePath.split("/").at(-1) ?? filePath;
}

function formatTitle(input: string) {
  return input
    .replace(/\.json$|\.csv$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseCsvText(source: string) {
  const rows: string[][] = [];
  const normalizedSource = source.replace(/^\uFEFF/, "");
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const character = normalizedSource[index];
    const nextCharacter = normalizedSource[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  const [headerRow = [], ...valueRows] = rows;
  return valueRows.map((row) =>
    Object.fromEntries(
      headerRow.map((header, index) => [header, row[index] ?? ""]),
    ),
  ) as Array<Record<string, string>>;
}

function resolveDatasetKind(datasetId: string): DatasetKind | null {
  if (/baseline/i.test(datasetId)) {
    return "baseline";
  }
  if (/persona/i.test(datasetId)) {
    return "persona";
  }
  return null;
}

function buildSimilarityDatasets() {
  const datasetEntries = Object.entries(datasetModules)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, csvText]) => {
      const datasetId = getFileName(filePath).replace(/\.csv$/i, "");
      const datasetKind = resolveDatasetKind(datasetId);
      if (!datasetKind) {
        return null;
      }

      const datasetLabel = formatTitle(datasetId);
      const rows = parseCsvText(csvText);
      const dataset: SimilarityDatasetQuestions = {
        id: datasetId,
        label: datasetLabel,
        questions: rows.map((row, index) => ({
          questionIndex: index,
          questionId: `${datasetId}-${index + 1}`,
          datasetId,
          datasetLabel,
          questionText: row.Question ?? "",
          topicName: row.topic ?? "Unknown",
        })),
      };

      return [datasetKind, dataset] as const;
    })
    .filter((entry): entry is readonly [DatasetKind, SimilarityDatasetQuestions] =>
      entry !== null,
    );

  return Object.fromEntries(datasetEntries) as Partial<
    Record<DatasetKind, SimilarityDatasetQuestions>
  >;
}

function findModuleByName<T>(fileName: string) {
  const moduleEntry = Object.entries(similarityModules).find(([filePath]) =>
    getFileName(filePath) === fileName,
  );
  return moduleEntry?.[1] as T | undefined;
}

function normalizeResult(result: SimilarityAnalysisResult): SimilarityAnalysisResult {
  return {
    ...result,
    baselineMetrics: {
      ...result.baselineMetrics,
      perQuestionMetrics: result.baselineMetrics.perQuestionMetrics ?? [],
      topicMetrics: result.baselineMetrics.topicMetrics ?? [],
    },
    personaMetrics: {
      ...result.personaMetrics,
      perQuestionMetrics: result.personaMetrics.perQuestionMetrics ?? [],
      topicMetrics: result.personaMetrics.topicMetrics ?? [],
    },
    comparison: result.comparison,
  };
}

export function loadSemanticSimilarityData(): SemanticSimilarityData | null {
  const result = findModuleByName<SimilarityAnalysisResult>("similarity_result.json");
  const baselineMatrix = findModuleByName<number[][]>(
    "baseline_similarity_matrix.json",
  );
  const personaMatrix = findModuleByName<number[][]>(
    "persona_similarity_matrix.json",
  );
  const datasets = buildSimilarityDatasets();

  if (!result || !baselineMatrix || !personaMatrix) {
    return null;
  }

  if (!datasets.baseline || !datasets.persona) {
    return null;
  }

  return {
    result: normalizeResult(result),
    matrices: {
      baseline: baselineMatrix,
      persona: personaMatrix,
    },
    datasets: {
      baseline: datasets.baseline,
      persona: datasets.persona,
    },
  };
}
