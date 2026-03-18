import { useMemo, useState } from "react";
import "./SemanticSimilarityTab.css";
import { SimilarityHeatmapPanel } from "./SimilarityHeatmapPanel";
import { SimilarityQuestionPanel } from "./SimilarityQuestionPanel";
import { SimilaritySummaryCards } from "./SimilaritySummaryCards";
import { SimilarityTopicPanel } from "./SimilarityTopicPanel";
import { loadSemanticSimilarityData } from "./similarityData";

type SemanticSubTab = "heatmaps" | "topics" | "questions";

const similaritySubTabs: Array<{ id: SemanticSubTab; label: string }> = [
  { id: "heatmaps", label: "Heatmaps" },
  { id: "topics", label: "Topic-wise Scores" },
  { id: "questions", label: "Question-wise Scores" },
];

export function SemanticSimilarityTab() {
  const [activeSubTab, setActiveSubTab] = useState<SemanticSubTab>("heatmaps");
  const data = useMemo(() => loadSemanticSimilarityData(), []);

  if (!data) {
    return (
      <section className="panel empty-state large-empty">
        <strong>No semantic similarity artifacts were found.</strong>
        <span>
          Add JSON outputs under <code>research/results/semantic_similarity</code>{" "}
          to populate this tab.
        </span>
      </section>
    );
  }

  return (
    <section className="view-stack semantic-similarity-view">
      <section className="panel control-panel semantic-hero-panel">
        <div className="panel-header semantic-hero-header">
          <div>
            <p className="eyebrow">Semantic Similarity</p>
            <h2>Read diversity, clustering, and repetition at three scales.</h2>
            <p>
              This view combines dataset summaries, full similarity matrices,
              topic-level compression, and question-level neighborhood signals.
            </p>
          </div>
          <div className="semantic-hero-note">
            <span className="pill">Metric: cosine similarity</span>
            <span className="pill">Embeddings: text-embedding-3-large</span>
            <span className="pill">Artifacts loaded: 3 JSON files</span>
          </div>
        </div>
      </section>

      <SimilaritySummaryCards result={data.result} />

      <section className="panel control-panel semantic-subtab-panel">
        <div className="panel-header semantic-subtab-header">
          <div>
            <p className="eyebrow">Exploration Modes</p>
            <h2>Switch the lens without leaving the analysis context.</h2>
          </div>
          <div className="summary-ribbon">
            {similaritySubTabs.map((subTab) => (
              <button
                key={subTab.id}
                type="button"
                className={`pill-toggle ${activeSubTab === subTab.id ? "is-active" : ""}`}
                onClick={() => setActiveSubTab(subTab.id)}
              >
                {subTab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeSubTab === "heatmaps" ? <SimilarityHeatmapPanel data={data} /> : null}
      {activeSubTab === "topics" ? <SimilarityTopicPanel data={data} /> : null}
      {activeSubTab === "questions" ? <SimilarityQuestionPanel data={data} /> : null}
    </section>
  );
}
