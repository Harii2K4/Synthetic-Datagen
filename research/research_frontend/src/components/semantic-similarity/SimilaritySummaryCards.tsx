import type { SimilarityAnalysisResult } from "./types";
import {
  formatDelta,
  formatMetricPercent,
  formatMetricValue,
} from "./utils";

type SimilaritySummaryCardsProps = {
  result: SimilarityAnalysisResult;
};

export function SimilaritySummaryCards({
  result,
}: SimilaritySummaryCardsProps) {
  const baselineMoreDiverse =
    (result.comparison.diversityScoreGap ?? 0) > 0 ? false : true;

  return (
    <section className="similarity-summary-grid">
      <article className="panel compact-panel similarity-summary-card baseline-card">
        <p className="eyebrow">Baseline Mean Pair Similarity</p>
        <h2>{formatMetricValue(result.baselineMetrics.meanPairSimilarity, 3)}</h2>
        <p>
          Diversity score {formatMetricPercent(result.baselineMetrics.diversityScore)}
        </p>
      </article>

      <article className="panel compact-panel similarity-summary-card persona-card">
        <p className="eyebrow">Persona Mean Pair Similarity</p>
        <h2>{formatMetricValue(result.personaMetrics.meanPairSimilarity, 3)}</h2>
        <p>
          Diversity score {formatMetricPercent(result.personaMetrics.diversityScore)}
        </p>
      </article>

      <article className="panel compact-panel similarity-summary-card accent-card">
        <p className="eyebrow">Diversity Gap</p>
        <h2>{formatDelta(result.comparison.diversityScoreGap, 3)}</h2>
        <p>
          {baselineMoreDiverse ? "Baseline" : "Persona"} retains the larger
          global diversity margin.
        </p>
      </article>

      <article className="panel compact-panel similarity-summary-card neutral-card">
        <p className="eyebrow">Nearest Neighbor Gap</p>
        <h2>
          {formatDelta(result.comparison.meanNearestNeighborSimilarityGap, 3)}
        </h2>
        <p>
          Lower values indicate fewer near-duplicate neighbors across the
          dataset.
        </p>
      </article>
    </section>
  );
}
