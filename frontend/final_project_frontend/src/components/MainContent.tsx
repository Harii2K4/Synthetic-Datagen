import type { NavigationTab } from '../data/navigation'
import { DashboardPage } from '../pages/DashboardPage'
import { GenerateDatasetsPage } from '../pages/GenerateDatasetsPage'

type MainContentProps = {
  activeTab: NavigationTab
}

function MainContent({ activeTab }: MainContentProps) {
  if (activeTab.id === 'dashboard') {
    return <DashboardPage />
  }

  if (activeTab.id === 'generate-datasets') {
    return <GenerateDatasetsPage />
  }

  return (
    <section className="home-content" aria-live="polite">
      <h2>{activeTab.label}</h2>
      <p>TODO: Build the {activeTab.label} page.</p>
    </section>
  )
}

export { MainContent }
