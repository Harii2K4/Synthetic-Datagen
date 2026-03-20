import { useCallback, useEffect, useRef } from "react";
import { LatexText } from "../LatexText";

type QuestionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questionText: string;
};

export function QuestionModal({
  isOpen,
  onClose,
  title,
  questionText,
}: QuestionModalProps) {
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
      className="question-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="question-modal">
        <div className="question-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="question-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="question-modal-body">
          <LatexText className="similarity-question-copy" text={questionText} />
        </div>
      </div>
    </dialog>
  );
}
