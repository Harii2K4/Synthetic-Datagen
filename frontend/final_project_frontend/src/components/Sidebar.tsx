import type { NavigationTab } from '../data/navigation'

type SidebarProps = {
  tabs: NavigationTab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onBackToLanding: () => void
}

function Sidebar({
  tabs,
  activeTabId,
  onTabSelect,
  searchQuery,
  onSearchQueryChange,
  onBackToLanding,
}: SidebarProps) {
  return (
    <aside
      className="w-full border-b border-white/15 bg-black/30 px-5 pb-4 pt-6 backdrop-blur-sm lg:w-80 lg:border-b-0 lg:border-r lg:px-6 lg:py-8"
      aria-label="Primary navigation"
    >
      <div className="lg:sticky lg:top-0">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-white/45">Navigation</p>
            <p className="mt-2 text-sm text-white/75">Dataset Workspace</p>
          </div>
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-xs uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
          >
            Landing
          </button>
        </div>

        <label className="mb-4 block">
          <span className="sr-only">Search tabs</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search panels"
            className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40 focus:bg-white/[0.06]"
          />
        </label>

        <nav>
          {tabs.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm text-white/70">No tab matches your search.</p>
              <button
                type="button"
                className="mt-3 text-xs uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
                onClick={() => onSearchQueryChange('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {tabs.map((tab, index) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      activeTabId === tab.id
                        ? 'border-white/40 bg-white/[0.12] text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/30 hover:bg-white/[0.08] hover:text-white'
                    }`}
                    onClick={() => onTabSelect(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{tab.label}</span>
                    <span className="text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
                      {index + 1}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
    </aside>
  )
}

export { Sidebar }
