import { useMemo, useState } from "react";
import type { SummaryTabContentProps } from "./types";

function formatMetricValue(value: number, fractionDigits = 4) {
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

export function SummaryTabContent({
  selectedSummaryId,
  onSelectedSummaryChange,
  summaryArtifacts,
  activeSummary,
  selectedSummaryLabel,
}: SummaryTabContentProps) {
  const [openDatasetId, setOpenDatasetId] = useState<string | null>(null);

  const totalSamples = useMemo(
    () =>
      activeSummary?.metricsTable.reduce(
        (sum, dataset) => sum + dataset.sampleCount,
        0,
      ) ?? 0,
    [activeSummary],
  );

  const openDataset = useMemo(
    () => activeSummary?.datasets.find((dataset) => dataset.datasetId === openDatasetId) ?? null,
    [activeSummary, openDatasetId],
  );

  if (!activeSummary) {
    return (
      <section className="view-stack">
        <section className="panel empty-state large-empty">
          <strong>No dataset summary files were found.</strong>
          <span>
            Add JSON outputs under <code>research/results/summary</code> to populate this tab.
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
            <p className="eyebrow">Dataset Summary</p>
            <h2>Read corpus-wide metrics in a paper-style table.</h2>
            <p>
              Switch between summary artifacts, inspect total sample size, and open
              topic distributions for each dataset.
            </p>
          </div>
          <div className="field-row">
            <label className="field-group">
              <span>Summary artifact</span>
              <select
                className="field-select"
                value={selectedSummaryId}
                onChange={(event) => onSelectedSummaryChange(event.target.value)}
              >
                {summaryArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="summary-ribbon">
          <span className="pill">{activeSummary.datasetCount} datasets</span>
          <span className="pill">{totalSamples} total samples</span>
          <span className="pill">Generated {formatGeneratedAt(activeSummary.generatedAt)}</span>
        </div>
      </section>

      <section className="metric-overview-grid">
        <article className="panel compact-panel">
          <p className="eyebrow">Selection</p>
          <h2>{selectedSummaryLabel ?? "Summary Artifact"}</h2>
          <p>{activeSummary.datasetCount} dataset entries included in this artifact.</p>
        </article>
        <article className="panel compact-panel">
          <p className="eyebrow">Sample Size</p>
          <h2>{totalSamples}</h2>
          <p>Aggregated across all datasets listed in the active summary file.</p>
        </article>
        <article className="panel compact-panel">
          <p className="eyebrow">Embedding Dim.</p>
          <h2>{activeSummary.metricsTable[0]?.embeddingDimension ?? "—"}</h2>
          <p>Reported embedding dimension for the active summary artifact.</p>
        </article>
      </section>

      <section className="panel table-panel summary-paper-panel">
        <div className="panel-header panel-header-stack">
          <div>
            <p className="eyebrow">Table 1</p>
            <h2>Dataset-level diversity and similarity metrics</h2>
          </div>
          <p className="table-note summary-table-note">
            Lower similarity and higher entropy or distinctness generally indicate a
            more diverse synthetic corpus. Use the topic popup to inspect topic mass
            concentration for each dataset.
          </p>
        </div>

        <div className="topic-table-wrapper summary-table-wrapper">
          <table className="topic-table summary-metrics-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>N</th>
                <th>Emb.</th>
                <th>Mean Pairwise</th>
                <th>P90 Pairwise</th>
                <th>Mean NN</th>
                <th>Entropy</th>
                <th>Topics</th>
                <th>Distinct-2</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {activeSummary.metricsTable.map((row) => (
                <tr key={row.datasetId}>
                  <td>
                    <div className="summary-dataset-cell">
                      <strong>{row.datasetLabel}</strong>
                      <span>{row.datasetId}</span>
                    </div>
                  </td>
                  <td>{row.sampleCount}</td>
                  <td>{row.embeddingDimension}</td>
                  <td>{formatMetricValue(row.meanPairwiseCosineSimilarity)}</td>
                  <td>{formatMetricValue(row.p90PairwiseSimilarity)}</td>
                  <td>{formatMetricValue(row.meanNearestNeighborSimilarity)}</td>
                  <td>{formatMetricValue(row.topicEntropy)}</td>
                  <td>{row.uniqueTopicCount}</td>
                  <td>{formatMetricValue(row.distinct2)}</td>
                  <td>
                    <button
                      type="button"
                      className="table-link-button"
                      onClick={() => setOpenDatasetId(row.datasetId)}
                    >
                      View topics
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openDataset ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setOpenDatasetId(null)}
        >
          <section
            className="panel modal-sheet summary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-topic-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Topic Distribution</p>
                <h2 id="summary-topic-modal-title">{openDataset.datasetLabel}</h2>
                <p>{openDataset.metrics.sampleCount} samples in this dataset.</p>
              </div>
              <button
                type="button"
                className="pill-toggle"
                onClick={() => setOpenDatasetId(null)}
              >
                Close
              </button>
            </div>

            <div className="summary-ribbon">
              <span className="pill">{openDataset.topicDistribution.length} topics</span>
              <span className="pill">N = {openDataset.metrics.sampleCount}</span>
            </div>

            <div className="topic-table-wrapper summary-modal-table-wrapper">
              <table className="topic-table summary-topic-distribution-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {openDataset.topicDistribution.map((item) => (
                    <tr key={`${openDataset.datasetId}-${item.topic}`}>
                      <td>{item.topic}</td>
                      <td>{item.count}</td>
                      <td>{formatMetricValue(item.percentage, 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
