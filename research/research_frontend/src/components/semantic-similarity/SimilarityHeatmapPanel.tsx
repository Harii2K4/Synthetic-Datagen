import { useMemo, useState } from "react";
import { LatexText } from "../LatexText";
import type { DatasetKind, SemanticSimilarityData } from "./types";
import { formatMetricValue, getDatasetLabel, getHeatmapColor } from "./utils";

type SimilarityHeatmapPanelProps = {
  data: SemanticSimilarityData;
};

type SelectedCell = {
  rowIndex: number;
  columnIndex: number;
};

function buildDefaultSelectedCell(matrix: number[][]): SelectedCell {
  if (matrix.length > 1) {
    return { rowIndex: 0, columnIndex: 1 };
  }
  return { rowIndex: 0, columnIndex: 0 };
}

export function SimilarityHeatmapPanel({ data }: SimilarityHeatmapPanelProps) {
  const [activeDataset, setActiveDataset] = useState<DatasetKind>("baseline");
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(() =>
    buildDefaultSelectedCell(data.matrices.baseline),
  );

  const activeMatrix = data.matrices[activeDataset];
  const activeQuestions = data.datasets[activeDataset].questions;
  const selectedValue =
    activeMatrix[selectedCell.rowIndex]?.[selectedCell.columnIndex] ?? 0;
  const selectedRowQuestion = activeQuestions[selectedCell.rowIndex];
  const selectedColumnQuestion = activeQuestions[selectedCell.columnIndex];

  const offDiagonalRange = useMemo(() => {
    const values = activeMatrix.flatMap((row, rowIndex) =>
      row.filter((_, columnIndex) => columnIndex !== rowIndex),
    );
    if (!values.length) {
      return { min: 0, max: 1 };
    }
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [activeMatrix]);

  return (
    <section className="similarity-subview-grid heatmap-layout">
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Heatmaps</p>
            <h2>Matrix-level redundancy landscape</h2>
            <p>
              Inspect where each dataset clusters tightly or spreads out across
              the full question set.
            </p>
          </div>
          <div className="summary-ribbon">
            {(["baseline", "persona"] as DatasetKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`pill-toggle ${activeDataset === kind ? "is-active" : ""}`}
                onClick={() => {
                  setActiveDataset(kind);
                  setSelectedCell(
                    buildDefaultSelectedCell(data.matrices[kind]),
                  );
                }}
              >
                {getDatasetLabel(kind)} Matrix
              </button>
            ))}
          </div>
        </div>

        <div className="heatmap-legend-row">
          <span className="pill">
            {data.datasets[activeDataset].questions.length} rows
          </span>
          <span className="pill">
            Min {formatMetricValue(offDiagonalRange.min, 3)}
          </span>
          <span className="pill">
            Max {formatMetricValue(offDiagonalRange.max, 3)}
          </span>
        </div>

        <div className="heatmap-scroll-frame">
          <div
            className="similarity-heatmap"
            style={{
              gridTemplateColumns: `repeat(${activeMatrix.length || 1}, minmax(10px, 1fr))`,
            }}
          >
            {activeMatrix.flatMap((row, rowIndex) =>
              row.map((value, columnIndex) => {
                const isDiagonal = rowIndex === columnIndex;
                const isSelected =
                  selectedCell.rowIndex === rowIndex &&
                  selectedCell.columnIndex === columnIndex;
                return (
                  <button
                    key={`${rowIndex}-${columnIndex}`}
                    type="button"
                    className={`heatmap-cell ${isSelected ? "is-selected" : ""}`}
                    style={{
                      backgroundColor: getHeatmapColor(
                        activeDataset,
                        value,
                        isDiagonal,
                      ),
                    }}
                    onClick={() => setSelectedCell({ rowIndex, columnIndex })}
                    aria-label={`Similarity from question ${rowIndex + 1} to question ${columnIndex + 1}: ${value}`}
                  />
                );
              }),
            )}
          </div>
        </div>
      </section>

      <aside className="panel similarity-detail-card">
        <p className="eyebrow">Selected Pair</p>
        <h2>{formatMetricValue(selectedValue, 3)}</h2>
        <div className="stat-pills">
          <span className="pill">Row #{selectedCell.rowIndex + 1}</span>
          <span className="pill">Column #{selectedCell.columnIndex + 1}</span>
          <span className="pill">{getDatasetLabel(activeDataset)}</span>
        </div>

        <div className="similarity-question-pair">
          <article className="similarity-question-card">
            <h3>{selectedRowQuestion?.topicName ?? "Unknown"}</h3>
            <LatexText
              className="similarity-question-copy similarity-question-preview similarity-question-preview-clamp"
              text={selectedRowQuestion?.questionText ?? ""}
            />
          </article>
          <article className="similarity-question-card">
            <h3>{selectedColumnQuestion?.topicName ?? "Unknown"}</h3>
            <LatexText
              className="similarity-question-copy similarity-question-preview similarity-question-preview-clamp"
              text={selectedColumnQuestion?.questionText ?? ""}
            />
          </article>
        </div>
      </aside>
    </section>
  );
}
