import { useMemo, useState } from "react";
import type { SimilarityTopicMetrics, SemanticSimilarityData } from "./types";
import { formatMetricValue } from "./utils";

type SimilarityTopicPanelProps = {
  data: SemanticSimilarityData;
};

type TopicSortMode = "gap" | "baseline" | "persona" | "diversity";
type TopicMetricMode = "meanPairSimilarity" | "diversityScore" | "meanNearestNeighborSimilarity";

type TopicRow = {
  topicName: string;
  baseline: SimilarityTopicMetrics | null;
  persona: SimilarityTopicMetrics | null;
  gap: number;
  diversityGap: number;
};

function getMetricValue(
  metrics: SimilarityTopicMetrics | null,
  metric: TopicMetricMode,
) {
  return metrics?.[metric] ?? null;
}

export function SimilarityTopicPanel({ data }: SimilarityTopicPanelProps) {
  const [metricMode, setMetricMode] = useState<TopicMetricMode>("meanPairSimilarity");
  const [sortMode, setSortMode] = useState<TopicSortMode>("gap");

  const topicRows = useMemo(() => {
    const baselineMap = new Map(
      data.result.baselineMetrics.topicMetrics.map((metrics) => [
        metrics.topicName,
        metrics,
      ]),
    );
    const personaMap = new Map(
      data.result.personaMetrics.topicMetrics.map((metrics) => [
        metrics.topicName,
        metrics,
      ]),
    );

    const topicNames = Array.from(
      new Set([...baselineMap.keys(), ...personaMap.keys()]),
    );

    const rows: TopicRow[] = topicNames.map((topicName) => {
      const baseline = baselineMap.get(topicName) ?? null;
      const persona = personaMap.get(topicName) ?? null;
      return {
        topicName,
        baseline,
        persona,
        gap:
          (getMetricValue(persona, metricMode) ?? 0) -
          (getMetricValue(baseline, metricMode) ?? 0),
        diversityGap:
          (persona?.diversityScore ?? 0) - (baseline?.diversityScore ?? 0),
      };
    });

    return rows.sort((left, right) => {
      if (sortMode === "baseline") {
        return (
          (getMetricValue(right.baseline, metricMode) ?? -1) -
            (getMetricValue(left.baseline, metricMode) ?? -1) ||
          left.topicName.localeCompare(right.topicName)
        );
      }
      if (sortMode === "persona") {
        return (
          (getMetricValue(right.persona, metricMode) ?? -1) -
            (getMetricValue(left.persona, metricMode) ?? -1) ||
          left.topicName.localeCompare(right.topicName)
        );
      }
      if (sortMode === "diversity") {
        return (
          Math.abs(right.diversityGap) - Math.abs(left.diversityGap) ||
          left.topicName.localeCompare(right.topicName)
        );
      }
      return (
        Math.abs(right.gap) - Math.abs(left.gap) ||
        left.topicName.localeCompare(right.topicName)
      );
    });
  }, [data.result.baselineMetrics.topicMetrics, data.result.personaMetrics.topicMetrics, metricMode, sortMode]);

  const maxMetricValue = useMemo(() => {
    const values = topicRows.flatMap((row) => [
      getMetricValue(row.baseline, metricMode) ?? 0,
      getMetricValue(row.persona, metricMode) ?? 0,
    ]);
    return Math.max(...values, 1);
  }, [metricMode, topicRows]);

  return (
    <section className="view-stack">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Topic-Wise Scores</p>
            <h2>Which mathematical fields compress and which stay varied?</h2>
            <p>
              Compare internal similarity by topic and switch between overall
              similarity, nearest-neighbor density, and diversity.
            </p>
          </div>
          <div className="field-row">
            <label className="field-group">
              <span>Metric</span>
              <select
                className="field-select"
                value={metricMode}
                onChange={(event) =>
                  setMetricMode(event.target.value as TopicMetricMode)
                }
              >
                <option value="meanPairSimilarity">Mean pair similarity</option>
                <option value="diversityScore">Diversity score</option>
                <option value="meanNearestNeighborSimilarity">
                  Mean nearest-neighbor similarity
                </option>
              </select>
            </label>
            <label className="field-group">
              <span>Sort by</span>
              <select
                className="field-select"
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as TopicSortMode)
                }
              >
                <option value="gap">Largest gap</option>
                <option value="diversity">Diversity gap</option>
                <option value="baseline">Baseline score</option>
                <option value="persona">Persona score</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="topic-score-list">
          {topicRows.map((row) => {
            const baselineValue = getMetricValue(row.baseline, metricMode) ?? 0;
            const personaValue = getMetricValue(row.persona, metricMode) ?? 0;
            return (
              <article key={row.topicName} className="topic-score-card">
                <div className="topic-score-header">
                  <div>
                    <h3>{row.topicName}</h3>
                    <p>
                      Baseline {row.baseline?.sampleCount ?? 0} samples · Persona{" "}
                      {row.persona?.sampleCount ?? 0} samples
                    </p>
                  </div>
                  <span className="pill">
                    Gap {formatMetricValue(row.gap, 3)}
                  </span>
                </div>

                <div className="topic-score-bars">
                  <div className="topic-bar-row">
                    <div className="metric-bar-meta">
                      <span>Baseline</span>
                      <strong>{formatMetricValue(row.baseline?.[metricMode] ?? null, 3)}</strong>
                    </div>
                    <div className="metric-track topic-track baseline-track">
                      <div
                        className="metric-fill metric-fill-baseline"
                        style={{ width: `${(baselineValue / maxMetricValue) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="topic-bar-row">
                    <div className="metric-bar-meta">
                      <span>Persona</span>
                      <strong>{formatMetricValue(row.persona?.[metricMode] ?? null, 3)}</strong>
                    </div>
                    <div className="metric-track topic-track persona-track">
                      <div
                        className="metric-fill metric-fill-persona"
                        style={{ width: `${(personaValue / maxMetricValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
