import { useEffect, useRef } from "react";

type MathJaxApi = {
  typesetPromise?: (elements?: HTMLElement[]) => Promise<unknown>;
  typesetClear?: (elements?: HTMLElement[]) => void;
  tex?: {
    inlineMath: string[][];
    displayMath: string[][];
  };
  startup?: {
    typeset: boolean;
  };
};

type MathJaxWindow = Window & {
  MathJax?: MathJaxApi;
  __mathJaxPromise?: Promise<void>;
};

async function ensureMathJaxFromPackage() {
  const mathWindow = window as MathJaxWindow;

  if (mathWindow.MathJax?.typesetPromise) {
    return;
  }

  if (!mathWindow.__mathJaxPromise) {
    mathWindow.MathJax = {
      tex: {
        inlineMath: [
          ["\\(", "\\)"],
          ["$", "$"],
        ],
        displayMath: [
          ["\\[", "\\]"],
          ["$$", "$$"],
        ],
      },
      startup: { typeset: false },
    };

    mathWindow.__mathJaxPromise = import("mathjax/es5/tex-chtml.js")
      .then(() => undefined)
      .catch(() => {
        throw new Error("Failed to load MathJax from package.");
      });
  }

  await mathWindow.__mathJaxPromise;
}

export function LatexText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const containerReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    ensureMathJaxFromPackage()
      .then(() => {
        if (isCancelled || !containerReference.current) {
          return;
        }

        const mathWindow = window as MathJaxWindow;
        mathWindow.MathJax?.typesetClear?.([containerReference.current]);
        return mathWindow.MathJax?.typesetPromise?.([
          containerReference.current,
        ]);
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [text]);

  return (
    <div ref={containerReference} className={className}>
      {text}
    </div>
  );
}
