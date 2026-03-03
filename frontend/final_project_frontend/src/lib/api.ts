import type { PersonaOption } from '../types/generation'
import type {
  DatasetGenerationMetricsPayload,
  DatasetGenerationRequestPayload,
} from '../types/datasetRequest'

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

async function fetchPersonaRowCount(split: string): Promise<number | null> {
  try {
    const response = await fetch(
      `http://localhost:8000/csv?fileName=${encodeURIComponent(split)}&dataType=persona`,
    )
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { NoOfRows?: number | string }
    const rows = payload.NoOfRows
    console.log("the no of rows:",rows)
    console.log(Number .isFinite(rows))

    if (typeof rows === 'number' && Number.isFinite(rows)) {
      console.log("Returning for "+split+":",rows)
      return rows
    }

    if (typeof rows === 'string') {
      const parsed = Number(rows)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  } catch {
    return null
  }
}

async function generateDataset(
  requestPayload: DatasetGenerationRequestPayload,
): Promise<DatasetGenerationMetricsPayload> {
  const response = await fetch('http://localhost:8000/dataset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    let message = `dataset generation failed: ${response.status}`

    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // keep default message when response is not JSON
    }

    throw new Error(message)
  }

  return (await response.json()) as DatasetGenerationMetricsPayload
}

export { fetchPersonaSplits, fetchPersonaRowCount, generateDataset }
