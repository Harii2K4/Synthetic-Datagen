import { useMemo } from "react";
import type { LlmJudgeDatasetStats, LlmJudgeTabContentProps } from "./types";

function formatTitle(input: string) {
  return input
    .replace(/\.json$|\.csv$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMetricValue(value: number, fractionDigits = 2) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(fractionDigits).replace(/0+$/u, "").replace(/\.$/u, "");
}

function formatGeneratedAt(value: string) {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatModelDisplayName(modelId: string) {
  const normalized = modelId.toLowerCase();

  if (normalized === "gpt-5.4-mini") {
    return "GPT 5.4 Mini";
  }

  if (normalized === "gemini-3-flash-preview") {
    return "Gemini 3 Flash";
  }

  if (normalized === "claude-haiku-4.5") {
    return "Claude Haiku 4.5";
  }

  if (normalized === "groq-4") {
    return "Groq 4";
  }

  return formatTitle(modelId);
}

function getAverageRankClassName(
  value: number,
  bestValue: number | null,
  worstValue: number | null,
) {
  if (bestValue === null || worstValue === null) {
    return "";
  }

  if (value === bestValue) {
    return " is-best";
  }

  if (value === worstValue && bestValue !== worstValue) {
    return " is-worst";
  }

  return "";
}

function getPointsClassName(
  value: number,
  bestValue: number | null,
  worstValue: number | null,
) {
  if (bestValue === null || worstValue === null) {
    return "";
  }

  if (value === bestValue) {
    return " is-best";
  }

  if (value === worstValue && bestValue !== worstValue) {
    return " is-worst";
  }

  return "";
}

function countBestAverageRankRows(
  modelId: string,
  rows: Array<{
    datasetId: string;
    statsByModel: Record<string, LlmJudgeDatasetStats | null>;
  }>,
) {
  return rows.reduce((count, row) => {
    const rankValues = Object.values(row.statsByModel)
      .map((stats) => stats?.averageRank ?? null)
      .filter((value): value is number => value !== null);
    const bestRank = rankValues.length > 0 ? Math.min(...rankValues) : null;

    if (bestRank === null) {
      return count;
    }

    return row.statsByModel[modelId]?.averageRank === bestRank
      ? count + 1
      : count;
  }, 0);
}

export function LlmJudgeTabContent({
  selectedJudgeId,
  onSelectedJudgeChange,
  judgeArtifacts,
  activeJudge,
  selectedJudgeLabel,
}: LlmJudgeTabContentProps) {
  const modelIds = useMemo(
    () =>
      activeJudge?.runMetadata.models ??
      Object.keys(activeJudge?.perModel ?? {}),
    [activeJudge],
  );

  const datasetIds = useMemo(() => {
    if (!activeJudge) {
      return [];
    }

    const datasetIdSet = new Set<string>(
      activeJudge.runMetadata.datasets ?? [],
    );

    Object.values(activeJudge.perModel).forEach((modelStats) => {
      Object.keys(modelStats.datasetStats ?? {}).forEach((datasetId) => {
        datasetIdSet.add(datasetId);
      });
    });

    return Array.from(datasetIdSet).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [activeJudge]);

  const datasetRows = useMemo(() => {
    if (!activeJudge) {
      return [];
    }

    return datasetIds.map((datasetId) => ({
      datasetId,
      datasetLabel: formatTitle(datasetId),
      statsByModel: Object.fromEntries(
        modelIds.map((modelId) => [
          modelId,
          activeJudge.perModel[modelId]?.datasetStats?.[datasetId] ?? null,
        ]),
      ) as Record<string, LlmJudgeDatasetStats | null>,
    }));
  }, [activeJudge, datasetIds, modelIds]);

  const modelSummaries = useMemo(() => {
    if (!activeJudge) {
      return [];
    }

    return modelIds.map((modelId) => {
      const modelStats = activeJudge.perModel[modelId];
      const averageRanks = Object.values(modelStats?.datasetStats ?? {}).map(
        (datasetStats) => datasetStats.averageRank,
      );
      const meanAverageRank =
        averageRanks.length > 0
          ? averageRanks.reduce((sum, value) => sum + value, 0) /
            averageRanks.length
          : null;

      return {
        id: modelId,
        label: formatModelDisplayName(modelId),
        validRoundCount: modelStats?.validRoundCount ?? 0,
        invalidResponseCount: modelStats?.invalidResponseCount ?? 0,
        meanAverageRank,
        datasetWins: countBestAverageRankRows(modelId, datasetRows),
      };
    });
  }, [activeJudge, datasetRows, modelIds]);

  const totalInvalidResponses = useMemo(
    () =>
      modelSummaries.reduce(
        (sum, modelSummary) => sum + modelSummary.invalidResponseCount,
        0,
      ),
    [modelSummaries],
  );

  const scoringLabel = activeJudge?.runMetadata.scoring?.rankMetric
    ? activeJudge.runMetadata.scoring.rankMetric.replace(/_/g, " ")
    : "lower is better";

  if (!activeJudge) {
    return (
      <section className="view-stack">
        <section className="panel empty-state large-empty">
          <strong>No LLM judge summary files were found.</strong>
          <span>
            Add JSON outputs under <code>research/results/llm_judge</code> to
            populate this tab.
          </span>
        </section>
      </section>
    );
  }

  return (
    <section className="view-stack">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">LLM Judge Summary</p>
            <h2>Compare dataset rankings across evaluator models.</h2>
            <p>
              Rows correspond to datasets and columns correspond to judge
              models. Average rank is the primary research signal here, with
              lower values indicating better placement. We also retain points
              and placement counts so the table reads like a compact paper
              appendix.
            </p>
          </div>
          <div className="field-row">
            <label className="field-group">
              <span>Judge artifact</span>
              <select
                className="field-select"
                value={selectedJudgeId}
                onChange={(event) => onSelectedJudgeChange(event.target.value)}
              >
                {judgeArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="summary-ribbon">
          <span className="pill">{datasetRows.length} datasets</span>
          <span className="pill">{modelIds.length} judge models</span>
          <span className="pill">
            {activeJudge.runMetadata.roundsCompleted}/
            {activeJudge.runMetadata.roundsRequested} rounds completed
          </span>
          <span className="pill">Scoring: {scoringLabel}</span>
          <span className="pill">
            Generated {formatGeneratedAt(activeJudge.runMetadata.timestamp)}
          </span>
        </div>
      </section>

      <section className="metric-overview-grid llm-judge-overview-grid">
        <article className="panel compact-panel">
          <p className="eyebrow">Selection</p>
          <h2>{selectedJudgeLabel ?? "Judge Artifact"}</h2>
          <p>
            {datasetRows.length} dataset rows are comparable in this ranking
            snapshot.
          </p>
        </article>
        <article className="panel compact-panel">
          <p className="eyebrow">Judges</p>
          <h2>{modelIds.length}</h2>
          <p>
            {totalInvalidResponses} invalid judge responses were recorded across
            models.
          </p>
        </article>
        <article className="panel compact-panel">
          <p className="eyebrow">Protocol</p>
          <h2>{activeJudge.runMetadata.roundsCompleted}</h2>
          <p>
            Completed ranking rounds using{" "}
            {formatTitle(
              activeJudge.runMetadata.sampling ?? "default sampling",
            )}
            .
          </p>
        </article>
      </section>

      <section className="panel table-panel summary-paper-panel">
        <div className="panel-header panel-header-stack">
          <div>
            <p className="eyebrow">Table 2</p>
            <h2>Dataset ranking outcomes by evaluator model</h2>
          </div>
          <p className="table-note summary-table-note">
            Lower average rank is better. Higher Borda points and higher
            first-place counts indicate stronger preference. Because some judge
            models may have fewer valid rounds, interpret raw placement counts
            alongside the model diagnostics shown below.
          </p>
        </div>

        <div className="llm-judge-model-strip">
          {modelSummaries.map((modelSummary) => (
            <article key={modelSummary.id} className="llm-judge-model-card">
              <p className="eyebrow">Model</p>
              <h3>{modelSummary.label}</h3>
              <div className="summary-ribbon">
                <span className="pill">
                  Valid rounds: {modelSummary.validRoundCount}
                </span>
                <span className="pill">
                  Invalid: {modelSummary.invalidResponseCount}
                </span>
                <span className="pill">
                  Mean avg. rank:{" "}
                  {modelSummary.meanAverageRank !== null
                    ? formatMetricValue(modelSummary.meanAverageRank)
                    : "—"}
                </span>
                <span className="pill">
                  Dataset wins: {modelSummary.datasetWins}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="topic-table-wrapper summary-table-wrapper">
          <table className="topic-table summary-metrics-table llm-judge-table">
            <thead>
              <tr>
                <th rowSpan={2}>Dataset</th>
                {modelIds.map((modelId) => {
                  const modelSummary = modelSummaries.find(
                    (summary) => summary.id === modelId,
                  );
                  const isLastModel = modelId === modelIds[modelIds.length - 1];

                  return (
                    <th
                      key={modelId}
                      colSpan={5}
                      className={`llm-judge-group-header${isLastModel ? " llm-judge-group-header-last" : ""}`}
                    >
                      <div className="llm-judge-header-cell">
                        <strong>
                          {modelSummary?.label ??
                            formatModelDisplayName(modelId)}
                        </strong>
                        <span>
                          Valid rounds:{" "}
                          {activeJudge.perModel[modelId]?.validRoundCount ?? 0}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {modelIds.flatMap((modelId) => [
                  <th
                    key={`${modelId}-averageRank`}
                    className="llm-judge-group-start"
                  >
                    Avg. Rank
                  </th>,
                  <th key={`${modelId}-pointsTotal`}>Points</th>,
                  <th key={`${modelId}-firstPlaceCount`}>1st</th>,
                  <th key={`${modelId}-secondPlaceCount`}>2nd</th>,
                  <th
                    key={`${modelId}-thirdPlaceCount`}
                    className="llm-judge-group-end"
                  >
                    3rd
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {datasetRows.map((row) => {
                const averageRankValues = Object.values(row.statsByModel)
                  .map((stats) => stats?.averageRank ?? null)
                  .filter((value): value is number => value !== null);
                const pointValues = Object.values(row.statsByModel)
                  .map((stats) => stats?.pointsTotal ?? null)
                  .filter((value): value is number => value !== null);
                const bestAverageRank =
                  averageRankValues.length > 0
                    ? Math.min(...averageRankValues)
                    : null;
                const worstAverageRank =
                  averageRankValues.length > 0
                    ? Math.max(...averageRankValues)
                    : null;
                const bestPoints =
                  pointValues.length > 0 ? Math.max(...pointValues) : null;
                const worstPoints =
                  pointValues.length > 0 ? Math.min(...pointValues) : null;

                return (
                  <tr key={row.datasetId}>
                    <td>
                      <div className="summary-dataset-cell">
                        <strong>{row.datasetLabel}</strong>
                        <span>{row.datasetId}</span>
                      </div>
                    </td>
                    {modelIds.flatMap((modelId) => {
                      const stats = row.statsByModel[modelId];

                      if (!stats) {
                        return [
                          <td
                            key={`${row.datasetId}-${modelId}-averageRank`}
                            className="llm-judge-group-start"
                          >
                            —
                          </td>,
                          <td key={`${row.datasetId}-${modelId}-pointsTotal`}>
                            —
                          </td>,
                          <td
                            key={`${row.datasetId}-${modelId}-firstPlaceCount`}
                          >
                            —
                          </td>,
                          <td
                            key={`${row.datasetId}-${modelId}-secondPlaceCount`}
                          >
                            —
                          </td>,
                          <td
                            key={`${row.datasetId}-${modelId}-thirdPlaceCount`}
                            className="llm-judge-group-end"
                          >
                            —
                          </td>,
                        ];
                      }

                      return [
                        <td
                          key={`${row.datasetId}-${modelId}-averageRank`}
                          className={`llm-judge-metric-cell llm-judge-group-start${getAverageRankClassName(stats.averageRank, bestAverageRank, worstAverageRank)}`}
                        >
                          {formatMetricValue(stats.averageRank)}
                        </td>,
                        <td
                          key={`${row.datasetId}-${modelId}-pointsTotal`}
                          className={`llm-judge-metric-cell${getPointsClassName(stats.pointsTotal, bestPoints, worstPoints)}`}
                        >
                          {stats.pointsTotal}
                        </td>,
                        <td key={`${row.datasetId}-${modelId}-firstPlaceCount`}>
                          {stats.firstPlaceCount}
                        </td>,
                        <td
                          key={`${row.datasetId}-${modelId}-secondPlaceCount`}
                        >
                          {stats.secondPlaceCount}
                        </td>,
                        <td
                          key={`${row.datasetId}-${modelId}-thirdPlaceCount`}
                          className="llm-judge-group-end"
                        >
                          {stats.thirdPlaceCount}
                        </td>,
                      ];
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
