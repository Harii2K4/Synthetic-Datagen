import { useCallback, useEffect, useRef } from "react";
import { LatexText } from "../LatexText";
import type {
  SimilarityPerQuestionMetrics,
  SimilarityQuestionRecord,
} from "./types";
import { formatMetricValue } from "./utils";

type ComparisonModalProps = {
  isOpen: boolean;
  onClose: () => void;
  metric: SimilarityPerQuestionMetrics;
  question: SimilarityQuestionRecord | null;
  nearestNeighborQuestion: SimilarityQuestionRecord | null;
};

export function ComparisonModal({
  isOpen,
  onClose,
  metric,
  question,
  nearestNeighborQuestion,
}: ComparisonModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="comparison-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="comparison-modal">
        <div className="comparison-modal-header">
          <div className="comparison-modal-title">
            <p className="eyebrow">Question Comparison</p>
            <h3>#{metric.questionIndex + 1} — {metric.topicName ?? "Unknown"}</h3>
          </div>
          <button
            type="button"
            className="question-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="comparison-modal-metrics">
          <span className="pill">
            NN Similarity: {formatMetricValue(metric.nearestNeighborSimilarity, 3)}
          </span>
          <span className="pill">
            Mean: {formatMetricValue(metric.meanSimilarityToOthers, 3)}
          </span>
          <span className="pill">
            Median: {formatMetricValue(metric.medianSimilarityToOthers, 3)}
          </span>
          <span className="pill">
            Max: {formatMetricValue(metric.maxSimilarityToOthers, 3)}
          </span>
          <span className="pill">
            NN Index: {metric.nearestNeighborIndex !== null ? `#${metric.nearestNeighborIndex + 1}` : "—"}
          </span>
        </div>

        <div className="comparison-modal-body">
          <div className="comparison-column">
            <div className="comparison-column-header">
              <h4>Selected Question · #{metric.questionIndex + 1}</h4>
            </div>
            <div className="comparison-column-scroll">
              <LatexText
                className="similarity-question-copy"
                text={question?.questionText ?? "Not available"}
              />
            </div>
          </div>

          <div className="comparison-divider" />

          <div className="comparison-column comparison-column-neighbor">
            <div className="comparison-column-header">
              <h4>
                Nearest Neighbor
                {metric.nearestNeighborIndex !== null
                  ? ` · #${metric.nearestNeighborIndex + 1}`
                  : ""}
              </h4>
            </div>
            <div className="comparison-column-scroll">
              <LatexText
                className="similarity-question-copy"
                text={nearestNeighborQuestion?.questionText ?? "Not available"}
              />
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
