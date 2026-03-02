import type { NavigationTab } from '../data/navigation'

type SidebarProps = {
  tabs: NavigationTab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
}

function Sidebar({ tabs, activeTabId, onTabSelect }: SidebarProps) {
  return (
    <aside className="home-sidebar" aria-label="Primary navigation">
      <nav>
        <ul className="tab-list">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                className={`tab-button ${activeTabId === tab.id ? 'active' : ''}`}
                onClick={() => onTabSelect(tab.id)}
                title={tab.label}
                aria-label={tab.label}
              >
                {tab.icon}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export { Sidebar }
