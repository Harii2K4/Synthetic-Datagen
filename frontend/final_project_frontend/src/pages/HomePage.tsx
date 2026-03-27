import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { GalaxyBackground } from "../components/GalaxyBackground";
import { MainContent } from "../components/MainContent";
import { navigationTabs } from "../data/navigation";

type HomePageProps = {
  onBackToLanding: () => void;
  initialTabId?: string;
};

const ACTIVE_TAB_STORAGE_KEY = "home_active_tab";

function formatWorkspaceTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isTextFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function HomePage({ onBackToLanding, initialTabId }: HomePageProps) {
  const [activeTabId, setActiveTabId] = useState(() => {
    if (initialTabId && navigationTabs.some((tab) => tab.id === initialTabId)) {
      return initialTabId;
    }
    const savedTabId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return navigationTabs.some((tab) => tab.id === savedTabId)
      ? savedTabId!
      : navigationTabs[0].id;
  });
  const [workspaceTime, setWorkspaceTime] = useState(() =>
    formatWorkspaceTime(new Date()),
  );

  const activeTab = useMemo(
    () =>
      navigationTabs.find((tab) => tab.id === activeTabId) ?? navigationTabs[0],
    [activeTabId],
  );

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab.id);
  }, [activeTab.id]);

  useEffect(() => {
    if (initialTabId && navigationTabs.some((tab) => tab.id === initialTabId)) {
      setActiveTabId(initialTabId);
    }
  }, [initialTabId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWorkspaceTime(formatWorkspaceTime(new Date()));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextFieldTarget(event.target)) {
        return;
      }

      if (event.key === "[" && event.altKey) {
        event.preventDefault();
        const currentIndex = navigationTabs.findIndex(
          (tab) => tab.id === activeTab.id,
        );
        const nextIndex =
          (currentIndex - 1 + navigationTabs.length) % navigationTabs.length;
        setActiveTabId(navigationTabs[nextIndex].id);
      }

      if (event.key === "]" && event.altKey) {
        event.preventDefault();
        const currentIndex = navigationTabs.findIndex(
          (tab) => tab.id === activeTab.id,
        );
        const nextIndex = (currentIndex + 1) % navigationTabs.length;
        setActiveTabId(navigationTabs[nextIndex].id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab.id]);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white"
      style={{
        fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
      }}
    >
      <GalaxyBackground starCount={90} />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* ── Top Bar ── */}
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1440px] items-end justify-between px-6 pb-5 pt-6 sm:px-10 lg:px-14">
            <div>
              <p className="mb-2 text-[0.6rem] uppercase tracking-[0.5em] text-white/40">
                Workspace
              </p>
              <h1
                className="text-3xl leading-[0.95] tracking-tight text-white sm:text-4xl lg:text-5xl"
                style={{ fontFamily: '"Bodoni Moda", serif' }}
              >
                Build Datasets
                <span className="ml-2 italic text-white/50">Precisely.</span>
              </h1>
            </div>
            <div className="hidden items-center gap-4 sm:flex">
              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/35">
                {workspaceTime}
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] tracking-wider text-white/30">
                Alt + [ / ]
              </span>
              <button
                type="button"
                onClick={onBackToLanding}
                className="rounded-full border border-white/20 bg-white/[0.04] px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-white/55 transition hover:border-white/40 hover:bg-white/[0.1] hover:text-white/80"
              >
                Landing
              </button>
            </div>
          </div>

          {/* ── Horizontal Tab Bar ── */}
          <nav
            className="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-14"
            aria-label="Primary navigation"
          >
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {navigationTabs.map((tab, index) => {
                const isActive = activeTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTabId(tab.id)}
                    className={`group relative flex shrink-0 items-center gap-2.5 px-5 py-3 text-sm transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-white/45 hover:text-white/75"
                    }`}
                    title={tab.label}
                    aria-label={tab.label}
                  >
                    <span className="shrink-0 opacity-70 group-hover:opacity-100">
                      {tab.icon}
                    </span>
                    <span className="whitespace-nowrap">{tab.label}</span>
                    <span className="ml-1 text-[0.6rem] text-white/25">
                      {index + 1}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="active-tab-indicator"
                        className="absolute inset-x-0 -bottom-px h-[2px]"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(104,170,224,0.9), transparent)",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 32,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        {/* ── Main Content Area ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <MainContent
                  activeTab={activeTab}
                  onTabSelect={setActiveTabId}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

export { HomePage };
