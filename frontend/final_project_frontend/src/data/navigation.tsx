import type { ReactNode } from 'react'

type NavigationTab = {
  id: string
  label: string
  icon: ReactNode
}

const iconSize = 22

export const navigationTabs: NavigationTab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.4" fill="currentColor" />
        <rect x="13" y="3" width="8" height="5" rx="1.4" fill="currentColor" />
        <rect x="13" y="10" width="8" height="11" rx="1.4" fill="currentColor" />
        <rect x="3" y="13" width="8" height="8" rx="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'generate-datasets',
    label: 'Generate Datasets',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="5" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 5V12C5 13.8 8.1 15.2 12 15.2S19 13.8 19 12V5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 12V19C5 20.8 8.1 22 12 22S19 20.8 19 19V12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: 'persona-hub',
    label: 'Persona Hub',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 19C5 16.2 8.1 14 12 14C15.9 14 19 16.2 19 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'view-dataset',
    label: 'View Dataset',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4H20V20H4V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 9H20" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9V20" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
]

export type { NavigationTab }
