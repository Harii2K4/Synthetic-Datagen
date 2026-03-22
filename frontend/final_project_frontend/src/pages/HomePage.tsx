import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { GalaxyBackground } from '../components/GalaxyBackground'
import { MainContent } from '../components/MainContent'
import { Sidebar } from '../components/Sidebar'
import { navigationTabs } from '../data/navigation'

type HomePageProps = {
  onBackToLanding: () => void
  initialTabId?: string
}

const ACTIVE_TAB_STORAGE_KEY = 'home_active_tab'

function formatWorkspaceTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isTextFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function HomePage({ onBackToLanding, initialTabId }: HomePageProps) {
  const [activeTabId, setActiveTabId] = useState(() => {
    if (initialTabId && navigationTabs.some((tab) => tab.id === initialTabId)) {
      return initialTabId
    }
    const savedTabId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
    return navigationTabs.some((tab) => tab.id === savedTabId) ? savedTabId! : navigationTabs[0].id
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [workspaceTime, setWorkspaceTime] = useState(() => formatWorkspaceTime(new Date()))

  const activeTab = useMemo(
    () => navigationTabs.find((tab) => tab.id === activeTabId) ?? navigationTabs[0],
    [activeTabId],
  )

  const filteredTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return navigationTabs
    }
    return navigationTabs.filter((tab) => tab.label.toLowerCase().includes(query))
  }, [searchQuery])

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab.id)
  }, [activeTab.id])

  useEffect(() => {
    if (initialTabId && navigationTabs.some((tab) => tab.id === initialTabId)) {
      setActiveTabId(initialTabId)
    }
  }, [initialTabId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWorkspaceTime(formatWorkspaceTime(new Date()))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextFieldTarget(event.target)) {
        return
      }

      if (event.key === '[' && event.altKey) {
        event.preventDefault()
        const currentIndex = navigationTabs.findIndex((tab) => tab.id === activeTab.id)
        const nextIndex = (currentIndex - 1 + navigationTabs.length) % navigationTabs.length
        setActiveTabId(navigationTabs[nextIndex].id)
      }

      if (event.key === ']' && event.altKey) {
        event.preventDefault()
        const currentIndex = navigationTabs.findIndex((tab) => tab.id === activeTab.id)
        const nextIndex = (currentIndex + 1) % navigationTabs.length
        setActiveTabId(navigationTabs[nextIndex].id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTab.id])

  const quickActions = navigationTabs.slice(0, 3)

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white"
      style={{ fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif' }}
    >
      <GalaxyBackground starCount={90} />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        tabs={filteredTabs}
        activeTabId={activeTab.id}
        onTabSelect={setActiveTabId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onBackToLanding={onBackToLanding}
      />

      <div className="flex-1 px-5 pb-8 pt-6 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-6 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.45em] text-white/45">Workspace</p>
            <h1
              className="text-4xl leading-[0.9] tracking-tight text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Bodoni Moda", serif' }}
            >
              Build Datasets
              <span className="ml-3 italic text-white/55">Precisely.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-white/45">
            <span>{workspaceTime}</span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem]">
              Alt + [ / ]
            </span>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3 lg:mb-8">
          {quickActions.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/35 hover:bg-white/[0.08]"
            >
              <div>
                <p className="mb-2 text-[0.62rem] uppercase tracking-[0.35em] text-white/45">Quick Action</p>
                <p className="text-sm text-white/85">{tab.label}</p>
              </div>
              <span className="text-xs text-white/35 transition group-hover:text-white/75">Open</span>
            </motion.button>
          ))}
        </section>

        <MainContent activeTab={activeTab} onTabSelect={setActiveTabId} />
      </div>
      </div>
    </main>
  )
}

export { HomePage }
