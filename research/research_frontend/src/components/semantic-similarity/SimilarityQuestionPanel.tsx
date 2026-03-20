import { useMemo, useState } from "react";
import { LatexText } from "../LatexText";
import { ComparisonModal } from "./ComparisonModal";
import type { DatasetKind, SemanticSimilarityData } from "./types";
import {
  buildQuestionMetricRows,
  formatMetricValue,
  getDatasetLabel,
} from "./utils";

type SimilarityQuestionPanelProps = {
  data: SemanticSimilarityData;
};

type QuestionSortMode =
  | "nearestNeighborSimilarity"
  | "meanSimilarityToOthers"
  | "maxSimilarityToOthers"
  | "questionIndex";

const ALL_TOPICS_FILTER = "All topics";

export function SimilarityQuestionPanel({
  data,
}: SimilarityQuestionPanelProps) {
  const [activeDataset, setActiveDataset] = useState<DatasetKind>("baseline");
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS_FILTER);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<QuestionSortMode>(
    "nearestNeighborSimilarity",
  );
  const [modalQuestionIndex, setModalQuestionIndex] = useState<number | null>(
    null,
  );

  const activeDatasetQuestions = data.datasets[activeDataset];
  const activeDatasetMetrics =
    activeDataset === "baseline"
      ? data.result.baselineMetrics
      : data.result.personaMetrics;

  const topicOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activeDatasetQuestions.questions.map(
            (question) => question.topicName,
          ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [activeDatasetQuestions.questions],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = buildQuestionMetricRows(
      activeDatasetQuestions,
      activeDatasetMetrics.perQuestionMetrics,
    ).filter(({ question, metric }) => {
      if (!question) {
        return false;
      }
      const matchesTopic =
        topicFilter === ALL_TOPICS_FILTER || metric.topicName === topicFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        question.questionText.toLowerCase().includes(normalizedQuery);
      return matchesTopic && matchesQuery;
    });

    return rows.sort((left, right) => {
      if (sortMode === "questionIndex") {
        return left.metric.questionIndex - right.metric.questionIndex;
      }
      return (
        (right.metric[sortMode] ?? -1) - (left.metric[sortMode] ?? -1) ||
        left.metric.questionIndex - right.metric.questionIndex
      );
    });
  }, [
    activeDatasetMetrics.perQuestionMetrics,
    activeDatasetQuestions,
    query,
    sortMode,
    topicFilter,
  ]);

  const modalRow =
    modalQuestionIndex !== null
      ? (filteredRows.find(
          ({ metric }) => metric.questionIndex === modalQuestionIndex,
        ) ?? null)
      : null;

  return (
    <section className="question-insight-layout">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Question-Wise Scores</p>
            <h2>Inspect outliers, near-duplicates, and local neighborhoods</h2>
            <p>
              Filter by dataset and topic, then inspect any question with its
              nearest semantic neighbor.
            </p>
          </div>
          <div className="field-row similarity-filter-row">
            <label className="field-group">
              <span>Dataset</span>
              <select
                className="field-select"
                value={activeDataset}
                onChange={(event) => {
                  setActiveDataset(event.target.value as DatasetKind);
                  setModalQuestionIndex(null);
                }}
              >
                <option value="baseline">Baseline</option>
                <option value="persona">Persona</option>
              </select>
            </label>
            <label className="field-group">
              <span>Topic</span>
              <select
                className="field-select"
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value)}
              >
                <option value={ALL_TOPICS_FILTER}>{ALL_TOPICS_FILTER}</option>
                {topicOptions.map((topicName) => (
                  <option key={topicName} value={topicName}>
                    {topicName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group similarity-search-field">
              <span>Search</span>
              <input
                className="field-select similarity-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Sort</span>
              <select
                className="field-select"
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as QuestionSortMode)
                }
              >
                <option value="nearestNeighborSimilarity">
                  Nearest neighbor
                </option>
                <option value="meanSimilarityToOthers">Mean similarity</option>
                <option value="maxSimilarityToOthers">Max similarity</option>
                <option value="questionIndex">Question index</option>
              </select>
            </label>
          </div>
        </div>

        <div className="summary-ribbon">
          <span className="pill">{filteredRows.length} visible questions</span>
          <span className="pill">{getDatasetLabel(activeDataset)} dataset</span>
          <span className="pill">Sorted by {sortMode}</span>
        </div>
      </section>

      <section className="question-insight-grid question-insight-grid-full">
        <section className="panel question-score-list-panel">
          <div className="question-score-list question-score-list-full">
            {filteredRows.map(({ metric, question }) => (
              <button
                key={metric.questionIndex}
                type="button"
                className="question-score-item"
                onClick={() => setModalQuestionIndex(metric.questionIndex)}
              >
                <div className="question-score-item-topline">
                  <strong>#{metric.questionIndex + 1}</strong>
                  <span>{metric.topicName ?? "Unknown"}</span>
                </div>
                <LatexText
                  className="similarity-question-copy similarity-question-preview similarity-question-preview-clamp"
                  text={question?.questionText ?? ""}
                />
                <div className="stat-pills">
                  <span className="pill">
                    NN {formatMetricValue(metric.nearestNeighborSimilarity, 3)}
                  </span>
                  <span className="pill">
                    Mean {formatMetricValue(metric.meanSimilarityToOthers, 3)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </section>

      {modalRow && (
        <ComparisonModal
          isOpen={modalQuestionIndex !== null}
          onClose={() => setModalQuestionIndex(null)}
          metric={modalRow.metric}
          question={modalRow.question}
          nearestNeighborQuestion={modalRow.nearestNeighborQuestion}
        />
      )}
    </section>
  );
}
