import type { NavigationTab } from "../data/navigation";

import { DashboardPage } from "../pages/DashboardPage";
import { GenerateDatasetsPage } from "../pages/GenerateDatasetsPage";
import { PersonaHubPage } from "../pages/PersonaHubPage";
import { ViewDatasetPage } from "../pages/ViewDatasetPage";

type MainContentProps = {
  activeTab: NavigationTab;
  onTabSelect: (tabId: string) => void;
};

function MainContent({ activeTab, onTabSelect }: MainContentProps) {
  const pageMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    "generate-datasets": <GenerateDatasetsPage />,
    "persona-hub": <PersonaHubPage />,
    "view-dataset": <ViewDatasetPage />,
  };

  const page = pageMap[activeTab.id];

  if (page) {
    return <div aria-live="polite">{page}</div>;
  }

  return (
    <div aria-live="polite" className="page-shell">
      <div className="page-header">
        <h2>{activeTab.label}</h2>
      </div>
      <p className="muted-text">This panel is not yet implemented.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onTabSelect("generate-datasets")}
          className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-white transition hover:bg-white/20"
        >
          Open Generator
        </button>
      </div>
    </div>
  );
}

export { MainContent };
