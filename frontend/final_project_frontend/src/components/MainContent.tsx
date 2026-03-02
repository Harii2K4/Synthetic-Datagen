import type { NavigationTab } from '../data/navigation'

type MainContentProps = {
  activeTab: NavigationTab
}

function MainContent({ activeTab }: MainContentProps) {
  return (
    <section className="home-content" aria-live="polite">
      <h2>{activeTab.label}</h2>
      <p>TODO: Build the {activeTab.label} page.</p>
    </section>
  )
}

export { MainContent }
