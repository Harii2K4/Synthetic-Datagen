import { ALL_TOPICS_FILTER } from "./constants";
import type { QuestionsTabContentProps } from "./types";

export function QuestionsTabContent({
  topicFilter,
  onTopicFilterChange,
  allTopics,
  leftMatchesCount,
  rightMatchesCount,
  leftColumn,
  rightColumn,
}: QuestionsTabContentProps) {
  return (
    <section className="view-stack">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Dataset Question Comparison</p>
            <h2>Filter by topic, then compare any two prompts side by side.</h2>
          </div>
          <div className="field-row field-row-compact">
            <label className="field-group">
              <span>Topic filter</span>
              <select
                className="field-select"
                value={topicFilter}
                onChange={(event) => onTopicFilterChange(event.target.value)}
              >
                <option value={ALL_TOPICS_FILTER}>{ALL_TOPICS_FILTER}</option>
                {allTopics.map((topicName) => (
                  <option key={topicName} value={topicName}>
                    {topicName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="summary-ribbon">
          <span className="pill">{leftMatchesCount} left-side matches</span>
          <span className="pill">{rightMatchesCount} right-side matches</span>
          <span className="pill">
            {allTopics.length} unique topics available
          </span>
        </div>
      </section>

      <section className="question-grid">
        {leftColumn}
        {rightColumn}
      </section>
    </section>
  );
}
