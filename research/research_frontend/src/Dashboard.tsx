import { useMemo, useState } from "react";
import "./Dashboard.css";
import { LatexText } from "./components/LatexText";
import {
  ALL_TOPIC_ANALYSES_ID,
  ALL_TOPICS_FILTER,
  DASHBOARD_TABS,
  DATASET_MODULES,
  DEFAULT_ENABLED_PANELS,
  METRIC_PANEL_LABELS,
  TOPIC_METRIC_MODULES,
} from "./components/dashboard-tabs/constants";
import { MetricsTabContent } from "./components/dashboard-tabs/MetricsTabContent";
import { QuestionsTabContent } from "./components/dashboard-tabs/QuestionsTabContent";
import type {
  MetricPanelId,
  QuestionRecord,
  TabId,
  TopicAnalysisOption,
  TopicAnalysisResult,
  TopicDatasetMetrics,
} from "./components/dashboard-tabs/types";
import { SemanticSimilarityTab } from "./components/semantic-similarity/SemanticSimilarityTab";

function formatTitle(input: string) {
  return input
    .replace(/\.json$|\.csv$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFileName(filePath: string) {
  return filePath.split("/").at(-1) ?? filePath;
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

function buildQuestionDatasets() {
  return Object.entries(DATASET_MODULES)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, csvText]) => {
      const datasetId = getFileName(filePath).replace(/\.csv$/i, "");
      const datasetLabel = formatTitle(datasetId);
      const rows = parseCsvText(csvText);

      return {
        id: datasetId,
        label: datasetLabel,
        questions: rows.map((row, index) => ({
          id: `${datasetId}-${index + 1}`,
          datasetId,
          datasetLabel,
          persona: row.persona ?? "",
          domain: row.domain ?? "",
          question: row.Question ?? "",
          topic: row.topic ?? "Unknown",
        })),
      };
    });
}

function normalizeTopicAnalysis(result: TopicAnalysisResult) {
  return {
    ...result,
    topicUniverse: result.topicUniverse ?? [],
    baselineMetrics: result.baselineMetrics,
    personaMetrics: result.personaMetrics,
    comparison: result.comparison,
  };
}

function buildTopicAnalyses() {
  return Object.entries(TOPIC_METRIC_MODULES)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, result]) => {
      const fileName = getFileName(filePath);
      return {
        id: fileName,
        label: formatTitle(fileName),
        result: normalizeTopicAnalysis(result),
      };
    });
}

function uniqueTopicList(topicNames: string[]) {
  return Array.from(new Set(topicNames.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function mergeDatasetMetrics(
  metricsCollection: TopicDatasetMetrics[],
  topicUniverse: string[],
) {
  const topicCountMap = metricsCollection.reduce<Record<string, number>>(
    (accumulator, metrics) => {
      Object.entries(metrics.topicCountMap).forEach(([topicName, count]) => {
        accumulator[topicName] = (accumulator[topicName] ?? 0) + count;
      });
      return accumulator;
    },
    {},
  );

  const totalSamples = Object.values(topicCountMap).reduce(
    (sum, value) => sum + value,
    0,
  );
  const sortedDistribution = Object.entries(topicCountMap)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([topicName, count]) => ({
      topicName,
      count,
      percentage: totalSamples
        ? Number(((count / totalSamples) * 100).toFixed(4))
        : 0,
    }));

  const observedTopics = sortedDistribution.map((item) => item.topicName);
  const coverageTopicSet = new Set(topicUniverse);
  const coveredTopics = observedTopics.filter((topicName) =>
    coverageTopicSet.has(topicName),
  );
  const missingTopics = topicUniverse.filter(
    (topicName) => !topicCountMap[topicName],
  );
  const unexpectedTopics = observedTopics.filter(
    (topicName) => !coverageTopicSet.has(topicName),
  );
  const dominantTopic = sortedDistribution[0];

  return {
    totalSamples,
    uniqueTopicsCount: observedTopics.length,
    observedTopics,
    dominantTopicName: dominantTopic?.topicName ?? null,
    dominantTopicCount: dominantTopic?.count ?? 0,
    dominantTopicPercentage: dominantTopic?.percentage ?? 0,
    topicCountMap,
    topicPercentageMap: Object.fromEntries(
      sortedDistribution.map((item) => [item.topicName, item.percentage]),
    ),
    topicDistribution: sortedDistribution,
    topicCoverage: {
      coveredTopicsCount: coveredTopics.length,
      totalTopicsCount: topicUniverse.length,
      coveragePercentage: topicUniverse.length
        ? Number(
            ((coveredTopics.length / topicUniverse.length) * 100).toFixed(4),
          )
        : 0,
      coveredTopics,
      missingTopics,
      unexpectedTopics,
    },
  };
}

function mergeTopicAnalyses(analyses: TopicAnalysisOption[]) {
  if (analyses.length === 0) {
    return null;
  }

  if (analyses.length === 1) {
    return analyses[0].result;
  }

  const topicUniverse = uniqueTopicList(
    analyses.flatMap((analysis) => analysis.result.topicUniverse),
  );
  const baselineMetrics = mergeDatasetMetrics(
    analyses.map((analysis) => analysis.result.baselineMetrics),
    topicUniverse,
  );
  const personaMetrics = mergeDatasetMetrics(
    analyses.map((analysis) => analysis.result.personaMetrics),
    topicUniverse,
  );
  const baselineCoveredTopics = new Set(
    baselineMetrics.topicCoverage.coveredTopics,
  );
  const personaCoveredTopics = new Set(
    personaMetrics.topicCoverage.coveredTopics,
  );
  const sharedTopics = uniqueTopicList(
    Array.from(baselineCoveredTopics).filter((topicName) =>
      personaCoveredTopics.has(topicName),
    ),
  );
  const baselineOnlyTopics = uniqueTopicList(
    Array.from(baselineCoveredTopics).filter(
      (topicName) => !personaCoveredTopics.has(topicName),
    ),
  );
  const personaOnlyTopics = uniqueTopicList(
    Array.from(personaCoveredTopics).filter(
      (topicName) => !baselineCoveredTopics.has(topicName),
    ),
  );

  return {
    metricName: analyses[0].result.metricName,
    topicUniverse,
    baselineMetrics,
    personaMetrics,
    comparison: {
      sharedTopicsCount: sharedTopics.length,
      sharedTopics,
      baselineOnlyTopics,
      personaOnlyTopics,
      coverageGapPercentagePoints: Number(
        (
          personaMetrics.topicCoverage.coveragePercentage -
          baselineMetrics.topicCoverage.coveragePercentage
        ).toFixed(4),
      ),
    },
  };
}

function buildCombinedMetrics(result: TopicAnalysisResult) {
  const topicUniverse = uniqueTopicList([
    ...result.topicUniverse,
    ...result.baselineMetrics.observedTopics,
    ...result.personaMetrics.observedTopics,
  ]);

  return mergeDatasetMetrics(
    [result.baselineMetrics, result.personaMetrics],
    topicUniverse,
  );
}

function buildTopicRows(result: TopicAnalysisResult) {
  const combinedMetrics = buildCombinedMetrics(result);
  const allTopics = uniqueTopicList([
    ...result.topicUniverse,
    ...result.baselineMetrics.observedTopics,
    ...result.personaMetrics.observedTopics,
  ]);
  const baselineCoveredTopics = new Set(
    result.baselineMetrics.topicCoverage.coveredTopics,
  );
  const personaCoveredTopics = new Set(
    result.personaMetrics.topicCoverage.coveredTopics,
  );

  return allTopics
    .map((topicName) => {
      const baselineCount =
        result.baselineMetrics.topicCountMap[topicName] ?? 0;
      const personaCount = result.personaMetrics.topicCountMap[topicName] ?? 0;
      const combinedCount = combinedMetrics.topicCountMap[topicName] ?? 0;
      const status =
        baselineCoveredTopics.has(topicName) &&
        personaCoveredTopics.has(topicName)
          ? "Shared"
          : baselineCoveredTopics.has(topicName)
            ? "Baseline only"
            : personaCoveredTopics.has(topicName)
              ? "Persona only"
              : combinedCount > 0
                ? "Unexpected"
                : "Uncovered";

      return {
        topicName,
        status,
        baselineCount,
        baselinePercentage:
          result.baselineMetrics.topicPercentageMap[topicName] ?? 0,
        personaCount,
        personaPercentage:
          result.personaMetrics.topicPercentageMap[topicName] ?? 0,
        combinedCount,
        combinedPercentage: combinedMetrics.topicPercentageMap[topicName] ?? 0,
      };
    })
    .sort(
      (left, right) =>
        right.combinedCount - left.combinedCount ||
        left.topicName.localeCompare(right.topicName),
    );
}

function extractQuestionPreview(question: string) {
  return question
    .replace(/^Math problem:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function shouldShowPersona(question: QuestionRecord) {
  return (
    !/baseline/i.test(question.datasetId) && question.persona.trim().length > 0
  );
}

function formatPercentage(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function QuestionColumn({
  heading,
  datasetOptions,
  selectedDatasetId,
  onDatasetChange,
  selectedQuestionId,
  onQuestionChange,
  questions,
  selectedQuestion,
}: {
  heading: string;
  datasetOptions: Array<{ id: string; label: string }>;
  selectedDatasetId: string;
  onDatasetChange: (datasetId: string) => void;
  selectedQuestionId: string;
  onQuestionChange: (questionId: string) => void;
  questions: QuestionRecord[];
  selectedQuestion?: QuestionRecord;
}) {
  return (
    <section className="question-column panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{heading}</p>
          <h2>
            {datasetOptions.find((dataset) => dataset.id === selectedDatasetId)
              ?.label ?? heading}
          </h2>
        </div>
        <select
          className="field-select"
          value={selectedDatasetId}
          onChange={(event) => onDatasetChange(event.target.value)}
        >
          {datasetOptions.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="question-column-body">
        <div className="question-list">
          {questions.length > 0 ? (
            questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                className={`question-list-item ${selectedQuestionId === question.id ? "is-active" : ""}`}
                onClick={() => onQuestionChange(question.id)}
              >
                <span className="question-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="question-list-copy">
                  <strong>{question.topic || "Unknown topic"}</strong>
                  <span>{extractQuestionPreview(question.question)}...</span>
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state compact-empty">
              <strong>No questions match this topic filter.</strong>
              <span>
                Try switching topics or changing the selected dataset.
              </span>
            </div>
          )}
        </div>

        <article className="question-display">
          {selectedQuestion ? (
            <>
              <div className="question-meta">
                <span className="pill subtle-pill">
                  {selectedQuestion.topic || "Unknown topic"}
                </span>
                {shouldShowPersona(selectedQuestion) ? (
                  <span className="meta-copy">{selectedQuestion.persona}</span>
                ) : null}
              </div>
              <LatexText
                className="math-copy"
                text={selectedQuestion.question}
              />
            </>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No question selected.</strong>
              <span>
                Choose a row from the list to inspect the full prompt.
              </span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function MetricsPanel({
  tone,
  title,
  metrics,
}: {
  tone: "baseline" | "persona" | "combined";
  title: string;
  metrics: TopicDatasetMetrics;
}) {
  const maxCount = Math.max(
    ...metrics.topicDistribution.map((item) => item.count),
    1,
  );

  return (
    <section className={`panel metric-panel metric-panel-${tone}`}>
      <div className="panel-header panel-header-stack">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{metrics.dominantTopicName ?? "No dominant topic yet"}</h2>
        </div>
        <div className="stat-pills">
          <span className="pill">{metrics.totalSamples} samples</span>
          <span className="pill">
            {metrics.uniqueTopicsCount} observed topics
          </span>
          <span className="pill">
            {formatPercentage(metrics.topicCoverage.coveragePercentage)}{" "}
            coverage
          </span>
        </div>
      </div>

      <div className="metric-bar-list">
        {metrics.topicDistribution.slice(0, 8).map((item) => (
          <div key={`${tone}-${item.topicName}`} className="metric-bar-row">
            <div className="metric-bar-meta">
              <span>{item.topicName}</span>
              <span>
                {item.count} · {formatPercentage(item.percentage)}
              </span>
            </div>
            <div className="metric-track">
              <div
                className={`metric-fill metric-fill-${tone}`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlaceholderTab({ index }: { index: number }) {
  return (
    <section className="panel placeholder-panel">
      <p className="eyebrow">Coming Soon</p>
      <h2>Tab {index} is reserved for the next research view.</h2>
      <p>
        The dashboard scaffolding is already in place, so this tab can be
        connected to a new result artifact whenever you are ready.
      </p>
    </section>
  );
}

function Dashboard() {
  const datasets = useMemo(() => buildQuestionDatasets(), []);
  const topicAnalyses = useMemo(() => buildTopicAnalyses(), []);
  const allQuestions = useMemo(
    () => datasets.flatMap((dataset) => dataset.questions),
    [datasets],
  );
  const allTopics = useMemo(
    () =>
      uniqueTopicList([
        ...allQuestions.map((question) => question.topic),
        ...topicAnalyses.flatMap((analysis) => analysis.result.topicUniverse),
      ]),
    [allQuestions, topicAnalyses],
  );
  const datasetOptions = useMemo(
    () => datasets.map((dataset) => ({ id: dataset.id, label: dataset.label })),
    [datasets],
  );
  const defaultLeftDataset = datasetOptions.find((dataset) =>
    /baseline/i.test(dataset.id),
  );
  const defaultRightDataset = datasetOptions.find((dataset) =>
    /persona/i.test(dataset.id),
  );

  const [activeTab, setActiveTab] = useState<TabId>("questions");
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS_FILTER);
  const [leftDatasetId, setLeftDatasetId] = useState(
    defaultLeftDataset?.id ?? datasetOptions[0]?.id ?? "",
  );
  const [rightDatasetId, setRightDatasetId] = useState(
    defaultRightDataset?.id ??
      datasetOptions[1]?.id ??
      datasetOptions[0]?.id ??
      "",
  );
  const [leftQuestionId, setLeftQuestionId] = useState("");
  const [rightQuestionId, setRightQuestionId] = useState("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(
    ALL_TOPIC_ANALYSES_ID,
  );
  const [showEmptyTopics, setShowEmptyTopics] = useState(false);
  const [enabledPanels, setEnabledPanels] = useState<
    Record<MetricPanelId, boolean>
  >(DEFAULT_ENABLED_PANELS);

  const leftQuestions = useMemo(() => {
    const dataset = datasets.find((item) => item.id === leftDatasetId);
    if (!dataset) {
      return [];
    }

    return dataset.questions.filter(
      (question) =>
        topicFilter === ALL_TOPICS_FILTER || question.topic === topicFilter,
    );
  }, [datasets, leftDatasetId, topicFilter]);

  const rightQuestions = useMemo(() => {
    const dataset = datasets.find((item) => item.id === rightDatasetId);
    if (!dataset) {
      return [];
    }

    return dataset.questions.filter(
      (question) =>
        topicFilter === ALL_TOPICS_FILTER || question.topic === topicFilter,
    );
  }, [datasets, rightDatasetId, topicFilter]);

  const leftActiveQuestionId = leftQuestions.some(
    (question) => question.id === leftQuestionId,
  )
    ? leftQuestionId
    : (leftQuestions[0]?.id ?? "");
  const rightActiveQuestionId = rightQuestions.some(
    (question) => question.id === rightQuestionId,
  )
    ? rightQuestionId
    : (rightQuestions[0]?.id ?? "");

  const leftSelectedQuestion = leftQuestions.find(
    (question) => question.id === leftActiveQuestionId,
  );
  const rightSelectedQuestion = rightQuestions.find(
    (question) => question.id === rightActiveQuestionId,
  );

  const selectedAnalyses = useMemo(() => {
    if (selectedAnalysisId === ALL_TOPIC_ANALYSES_ID) {
      return topicAnalyses;
    }

    return topicAnalyses.filter(
      (analysis) => analysis.id === selectedAnalysisId,
    );
  }, [selectedAnalysisId, topicAnalyses]);

  const activeAnalysisResult = useMemo(
    () => mergeTopicAnalyses(selectedAnalyses),
    [selectedAnalyses],
  );
  const combinedMetrics = useMemo(
    () =>
      activeAnalysisResult ? buildCombinedMetrics(activeAnalysisResult) : null,
    [activeAnalysisResult],
  );
  const topicRows = useMemo(() => {
    if (!activeAnalysisResult) {
      return [];
    }

    return buildTopicRows(activeAnalysisResult).filter(
      (row) => showEmptyTopics || row.combinedCount > 0,
    );
  }, [activeAnalysisResult, showEmptyTopics]);

  const togglePanel = (panelId: MetricPanelId) => {
    setEnabledPanels((currentState) => ({
      ...currentState,
      [panelId]: !currentState[panelId],
    }));
  };

  return (
    <main className="app-shell">
      <section className="masthead panel">
        <div className="masthead-copy">
          <p className="eyebrow">Synthetic Datagen Research Console</p>
          <h1>Inspect dataset prompts and topic behavior side by side.</h1>
          <p className="lead-copy">
            The first tab compares generated math questions across datasets with
            LaTeX rendering. The second tab reads the topic analysis artifacts
            and lets you switch between individual result files or a combined
            overview of everything available.
          </p>
        </div>
        <div className="masthead-stats">
          <div>
            <strong>{datasets.length}</strong>
            <span>datasets loaded</span>
          </div>
          <div>
            <strong>{allQuestions.length}</strong>
            <span>questions indexed</span>
          </div>
          <div>
            <strong>{topicAnalyses.length}</strong>
            <span>topic analyses</span>
          </div>
        </div>
      </section>

      <nav className="tab-strip" aria-label="Research views">
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.eyebrow}</span>
            <strong>{tab.label}</strong>
          </button>
        ))}
      </nav>

      {activeTab === "questions" ? (
        <QuestionsTabContent
          topicFilter={topicFilter}
          onTopicFilterChange={setTopicFilter}
          allTopics={allTopics}
          leftMatchesCount={leftQuestions.length}
          rightMatchesCount={rightQuestions.length}
          leftColumn={
            <QuestionColumn
              heading="Left Panel"
              datasetOptions={datasetOptions}
              selectedDatasetId={leftDatasetId}
              onDatasetChange={setLeftDatasetId}
              selectedQuestionId={leftActiveQuestionId}
              onQuestionChange={setLeftQuestionId}
              questions={leftQuestions}
              selectedQuestion={leftSelectedQuestion}
            />
          }
          rightColumn={
            <QuestionColumn
              heading="Right Panel"
              datasetOptions={datasetOptions}
              selectedDatasetId={rightDatasetId}
              onDatasetChange={setRightDatasetId}
              selectedQuestionId={rightActiveQuestionId}
              onQuestionChange={setRightQuestionId}
              questions={rightQuestions}
              selectedQuestion={rightSelectedQuestion}
            />
          }
        />
      ) : null}

      {activeTab === "metrics" ? (
        <MetricsTabContent
          selectedAnalysisId={selectedAnalysisId}
          onSelectedAnalysisChange={setSelectedAnalysisId}
          topicAnalyses={topicAnalyses}
          showEmptyTopics={showEmptyTopics}
          onShowEmptyTopicsChange={setShowEmptyTopics}
          enabledPanels={enabledPanels}
          panelLabels={METRIC_PANEL_LABELS}
          onTogglePanel={togglePanel}
          hasActiveAnalysis={Boolean(activeAnalysisResult)}
          selectedAnalysisLabel={selectedAnalyses[0]?.label}
          selectedAnalysesCount={selectedAnalyses.length}
          coverageGapPercentagePoints={
            activeAnalysisResult?.comparison.coverageGapPercentagePoints ?? 0
          }
          sharedTopicsCount={
            activeAnalysisResult?.comparison.sharedTopicsCount ?? 0
          }
          topicUniverseCount={activeAnalysisResult?.topicUniverse.length ?? 0}
          sharedTopics={activeAnalysisResult?.comparison.sharedTopics ?? []}
          baselineOnlyTopics={
            activeAnalysisResult?.comparison.baselineOnlyTopics ?? []
          }
          personaOnlyTopics={
            activeAnalysisResult?.comparison.personaOnlyTopics ?? []
          }
          baselinePanel={
            enabledPanels.baseline && activeAnalysisResult ? (
              <MetricsPanel
                tone="baseline"
                title="Baseline distribution"
                metrics={activeAnalysisResult.baselineMetrics}
              />
            ) : null
          }
          personaPanel={
            enabledPanels.persona && activeAnalysisResult ? (
              <MetricsPanel
                tone="persona"
                title="Persona distribution"
                metrics={activeAnalysisResult.personaMetrics}
              />
            ) : null
          }
          combinedPanel={
            enabledPanels.combined && combinedMetrics ? (
              <MetricsPanel
                tone="combined"
                title="Combined distribution"
                metrics={combinedMetrics}
              />
            ) : null
          }
          topicRows={topicRows}
        />
      ) : null}

      {activeTab === "tab-3" ? <SemanticSimilarityTab /> : null}
      {activeTab === "tab-4" ? <PlaceholderTab index={4} /> : null}
      {activeTab === "tab-5" ? <PlaceholderTab index={5} /> : null}
    </main>
  );
}

export default Dashboard;
