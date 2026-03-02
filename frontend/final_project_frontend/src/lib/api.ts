import type { PersonaOption } from '../types/generation'

const DEFAULT_SPLITS = ['math', 'instruction', 'knowledge', 'reasoning', 'tool', 'npc', 'general']

function toSplitId(fileName: string): string {
  const withoutSuffix = fileName.replace('.csv', '')
  if (withoutSuffix === 'persona') {
    return 'general'
  }
  return withoutSuffix.replace(/^persona_/, '')
}

async function fetchPersonaSplits(): Promise<PersonaOption[]> {
  try {
    const response = await fetch('http://localhost:8000/persona_hub')
    if (!response.ok) {
      throw new Error(`persona_hub request failed: ${response.status}`)
    }

    const payload = (await response.json()) as { personaSplits?: string[] }
    const splits = (payload.personaSplits ?? []).map(toSplitId)
    const unique = Array.from(new Set(splits))

    return unique.map((split) => ({
      id: split,
      label: split,
    }))
  } catch {
    return DEFAULT_SPLITS.map((split) => ({
      id: split,
      label: split,
    }))
  }
}

export { fetchPersonaSplits }
