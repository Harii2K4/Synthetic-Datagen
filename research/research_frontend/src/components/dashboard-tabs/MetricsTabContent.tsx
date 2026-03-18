import { ALL_TOPIC_ANALYSES_ID, METRIC_PANEL_IDS } from "./constants";
import type { MetricsTabContentProps } from "./types";

function formatPercentage(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function MetricsTabContent({
  selectedAnalysisId,
  onSelectedAnalysisChange,
  topicAnalyses,
  showEmptyTopics,
  onShowEmptyTopicsChange,
  enabledPanels,
  panelLabels,
  onTogglePanel,
  hasActiveAnalysis,
  selectedAnalysisLabel,
  selectedAnalysesCount,
  coverageGapPercentagePoints,
  sharedTopicsCount,
  topicUniverseCount,
  sharedTopics,
  baselineOnlyTopics,
  personaOnlyTopics,
  baselinePanel,
  personaPanel,
  combinedPanel,
  topicRows,
}: MetricsTabContentProps) {
  return (
    <section className="view-stack">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Topic Metrics</p>
            <h2>
              Switch between one result file or a combined view of all topic
              analyses.
            </h2>
          </div>
          <div className="field-row">
            <label className="field-group">
              <span>Result source</span>
              <select
                className="field-select"
                value={selectedAnalysisId}
                onChange={(event) =>
                  onSelectedAnalysisChange(event.target.value)
                }
              >
                <option value="__all__">All available topic analyses</option>
                {topicAnalyses.map((analysis) => (
                  <option key={analysis.id} value={analysis.id}>
                    {analysis.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={showEmptyTopics}
                onChange={(event) =>
                  onShowEmptyTopicsChange(event.target.checked)
                }
              />
              <span>Show uncovered topics</span>
            </label>
          </div>
        </div>

        <div className="summary-ribbon summary-ribbon-wrap">
          {METRIC_PANEL_IDS.map((panelId) => (
            <button
              key={panelId}
              type="button"
              className={`pill-toggle ${enabledPanels[panelId] ? "is-active" : ""}`}
              onClick={() => onTogglePanel(panelId)}
            >
              {panelLabels[panelId]}
            </button>
          ))}
        </div>
      </section>

      {hasActiveAnalysis ? (
        <>
          <section className="metric-overview-grid">
            <article className="panel compact-panel">
              <p className="eyebrow">Selection</p>
              <h2>
                {selectedAnalysisId === ALL_TOPIC_ANALYSES_ID
                  ? "All Topic Analyses"
                  : selectedAnalysisLabel}
              </h2>
              <p>
                {selectedAnalysesCount} artifact(s) contributing to this view.
              </p>
            </article>
            <article className="panel compact-panel">
              <p className="eyebrow">Coverage Gap</p>
              <h2>{formatPercentage(Math.abs(coverageGapPercentagePoints))}</h2>
              <p>
                Persona coverage is{" "}
                {coverageGapPercentagePoints >= 0 ? "ahead of" : "behind"}{" "}
                baseline.
              </p>
            </article>
            <article className="panel compact-panel">
              <p className="eyebrow">Shared Topics</p>
              <h2>{sharedTopicsCount}</h2>
              <p>{topicUniverseCount} topics in the reference universe.</p>
            </article>
          </section>

          <section className="metric-grid">
            {baselinePanel}
            {personaPanel}
            {combinedPanel}

            {enabledPanels.comparison ? (
              <section className="panel comparison-panel">
                <div className="panel-header panel-header-stack">
                  <div>
                    <p className="eyebrow">Comparison</p>
                    <h2>Coverage overlap and exclusivity</h2>
                  </div>
                  <div className="stat-pills">
                    <span className="pill">{sharedTopicsCount} shared</span>
                    <span className="pill">
                      {baselineOnlyTopics.length} baseline only
                    </span>
                    <span className="pill">
                      {personaOnlyTopics.length} persona only
                    </span>
                  </div>
                </div>

                <div className="comparison-groups">
                  <div>
                    <h3>Shared</h3>
                    <div className="pill-cloud">
                      {sharedTopics.map((topicName) => (
                        <span
                          key={`shared-${topicName}`}
                          className="pill subtle-pill"
                        >
                          {topicName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Baseline only</h3>
                    <div className="pill-cloud">
                      {baselineOnlyTopics.map((topicName) => (
                        <span
                          key={`baseline-${topicName}`}
                          className="pill subtle-pill"
                        >
                          {topicName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Persona only</h3>
                    <div className="pill-cloud">
                      {personaOnlyTopics.map((topicName) => (
                        <span
                          key={`persona-${topicName}`}
                          className="pill subtle-pill"
                        >
                          {topicName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <section className="panel table-panel">
            <div className="panel-header panel-header-stack">
              <div>
                <p className="eyebrow">Topic Matrix</p>
                <h2>Individual and combined topic counts</h2>
              </div>
              <p className="table-note">
                This matrix is filtered to active results only and can include
                uncovered topics on demand.
              </p>
            </div>

            <div className="topic-table-wrapper">
              <table className="topic-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Baseline</th>
                    <th>Persona</th>
                    <th>Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {topicRows.map((row) => (
                    <tr key={row.topicName}>
                      <td>{row.topicName}</td>
                      <td>
                        <span className="pill subtle-pill">{row.status}</span>
                      </td>
                      <td>
                        {row.baselineCount}{" "}
                        <span>{formatPercentage(row.baselinePercentage)}</span>
                      </td>
                      <td>
                        {row.personaCount}{" "}
                        <span>{formatPercentage(row.personaPercentage)}</span>
                      </td>
                      <td>
                        {row.combinedCount}{" "}
                        <span>{formatPercentage(row.combinedPercentage)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="panel empty-state large-empty">
          <strong>No topic analysis files were found.</strong>
          <span>
            Add JSON outputs under <code>research/results/topic</code> to
            populate this tab.
          </span>
        </section>
      )}
    </section>
  );
}
