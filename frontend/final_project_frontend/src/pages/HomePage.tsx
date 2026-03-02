import { useMemo, useState } from 'react'
import { MainContent } from '../components/MainContent'
import { Sidebar } from '../components/Sidebar'
import { navigationTabs } from '../data/navigation'

type HomePageProps = {
  onBackToLanding: () => void
}

function HomePage({ onBackToLanding }: HomePageProps) {
  const [activeTabId, setActiveTabId] = useState(navigationTabs[0].id)

  const activeTab = useMemo(
    () => navigationTabs.find((tab) => tab.id === activeTabId) ?? navigationTabs[0],
    [activeTabId],
  )

  return (
    <main className="home-page">
      <Sidebar
        tabs={navigationTabs}
        activeTabId={activeTab.id}
        onTabSelect={setActiveTabId}
      />
      <div className="home-workspace">
        <header className="home-header">
          <h1>Home</h1>
          <button type="button" onClick={onBackToLanding}>
            Back To Landing
          </button>
        </header>
        <MainContent activeTab={activeTab} />
      </div>
    </main>
  )
}

export { HomePage }
