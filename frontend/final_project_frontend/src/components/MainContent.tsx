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
  if (activeTab.id === "dashboard") {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-white/15 bg-black/35 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6 lg:p-8"
      >
        <DashboardPage />
      </section>
    );
  }

  if (activeTab.id === "generate-datasets") {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-white/15 bg-black/35 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6 lg:p-8"
      >
        <GenerateDatasetsPage />
      </section>
    );
  }

  if (activeTab.id === "persona-hub") {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-white/15 bg-black/35 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6 lg:p-8"
      >
        <PersonaHubPage />
      </section>
    );
  }

  if (activeTab.id === "view-dataset") {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-white/15 bg-black/35 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6 lg:p-8"
      >
        <ViewDatasetPage />
      </section>
    );
  }

  return (
    <section
      className="rounded-3xl border border-white/15 bg-black/35 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8"
      aria-live="polite"
    >
      <p className="mb-3 text-xs uppercase tracking-[0.45em] text-white/45">
        Selected Panel
      </p>
      <h2
        className="mb-6 text-4xl leading-[0.9] tracking-tight text-white sm:text-5xl"
        style={{ fontFamily: '"Bodoni Moda", serif' }}
      >
        {activeTab.label}
      </h2>
      <p className="max-w-2xl text-base text-white/70">
        This panel is scaffolded but not fully implemented yet. You can continue
        with the generation flow now, then return to this area once data output
        pipelines are in place.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onTabSelect("generate-datasets")}
          className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-white transition hover:bg-white/20"
        >
          Open Generator
        </button>
        <span className="rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
          Coming Soon
        </span>
      </div>
    </section>
  );
}

export { MainContent };
