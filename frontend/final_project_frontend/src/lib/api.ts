import type { PersonaOption } from '../types/generation'
import type {
  DatasetGenerationMetricsPayload,
  DatasetGenerationRequestPayload,
} from '../types/datasetRequest'
import type {
  CsvPreviewQuery,
  CsvPreviewResult,
  CsvPreviewRow,
} from '../types/csvPreview'
import { CSV_PREVIEW_ROW_INDEX_FIELD } from '../types/csvPreview'

const DEFAULT_SPLITS = ['math', 'instruction', 'knowledge', 'reasoning', 'tool', 'npc', 'general']
const API_BASE_URL = 'http://localhost:8000'

function toSplitId(fileName: string): string {
  const withoutSuffix = fileName.replace('.csv', '')
  if (withoutSuffix === 'persona') {
    return 'general'
  }
  return withoutSuffix.replace(/^persona_/, '')
}

async function fetchPersonaSplits(): Promise<PersonaOption[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/persona_hub`)
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
      `${API_BASE_URL}/csv?fileName=${encodeURIComponent(split)}&dataType=persona`,
    )
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { NoOfRows?: number | string }
    const rows = payload.NoOfRows
    if (typeof rows === 'number' && Number.isFinite(rows)) {
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

async function fetchDatasetRowCount(datasetName: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/csv?fileName=${encodeURIComponent(datasetName)}&dataType=dataset`,
    )
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { NoOfRows?: number | string }
    const rows = payload.NoOfRows
    if (typeof rows === 'number' && Number.isFinite(rows)) {
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

function parseCsvRows(rawDataset: unknown): CsvPreviewRow[] {
  if (Array.isArray(rawDataset)) {
    return rawDataset.filter((row): row is CsvPreviewRow => row !== null && typeof row === 'object')
  }

  if (typeof rawDataset !== 'string') {
    throw new Error('Invalid dataset payload format.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawDataset)
  } catch {
    throw new Error('Failed to parse dataset payload.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Dataset payload must be an array.')
  }

  return parsed.filter((row): row is CsvPreviewRow => row !== null && typeof row === 'object')
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function getPageWindow(query: CsvPreviewQuery): { lower: number; upper: number } {
  const safePage = Math.max(0, Math.trunc(query.page))
  const safePageSize = Math.max(1, Math.trunc(query.pageSize))

  if (query.lowerLimit !== undefined || query.upperLimit !== undefined) {
    const baseLower = Math.max(0, Math.trunc(query.lowerLimit ?? 0))
    const rawUpper = Math.max(baseLower, Math.trunc(query.upperLimit ?? baseLower + safePageSize))
    const pagedLower = baseLower + safePage * safePageSize
    const pagedUpper = Math.min(rawUpper, pagedLower + safePageSize)
    return { lower: pagedLower, upper: pagedUpper }
  }

  const lower = safePage * safePageSize
  return { lower, upper: lower + safePageSize }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
  } catch {
    // Use status fallback when body is not JSON.
  }
  return `request failed: ${response.status}`
}

async function fetchPersonaSplitPreview(
  split: string,
  query: CsvPreviewQuery,
): Promise<CsvPreviewResult<CsvPreviewRow>> {
  const totalRows = await fetchPersonaRowCount(split)
  const { lower, upper } = getPageWindow(query)
  const mode = query.mode ?? 'range'
  const safePageSize = Math.max(1, Math.trunc(query.pageSize))
  const noOfRows = mode === 'range' ? Math.max(1, upper - lower) : safePageSize
  const params = new URLSearchParams({
    noOfRows: String(noOfRows),
    method: mode,
  })

  if (mode === 'range' || mode === 'hybrid') {
    params.set('lowerLimit', String(lower))
    params.set('upperLimit', String(upper))
  }
  if ((mode === 'filter' || mode === 'hybrid') && query.filter) {
    params.set('filter', query.filter)
  }

  const response = await fetch(
    `${API_BASE_URL}/persona_hub/${encodeURIComponent(split)}?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as {
    dataset?: unknown
    rowsReturned?: unknown
    rowsRequested?: unknown
  }
  const rows = parseCsvRows(payload.dataset).map((row, index) => ({
    ...row,
    [CSV_PREVIEW_ROW_INDEX_FIELD]: lower + index,
  }))
  const rowsReturned = toFiniteNumber(payload.rowsReturned) ?? rows.length
  const rowsRequested = toFiniteNumber(payload.rowsRequested) ?? rows.length

  return {
    rows,
    rowsReturned,
    rowsRequested,
    totalRows,
  }
}

async function fetchDatasetPreview(
  datasetName: string,
  query: CsvPreviewQuery,
): Promise<CsvPreviewResult<CsvPreviewRow>> {
  const totalRows = await fetchDatasetRowCount(datasetName)
  const { lower, upper } = getPageWindow(query)
  const params = new URLSearchParams({
    lowerLimit: String(lower),
    upperLimit: String(upper),
  })
  const response = await fetch(
    `${API_BASE_URL}/dataset/${encodeURIComponent(datasetName)}?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as {
    dataset?: unknown
    rowsReturned?: unknown
    rowsRequested?: unknown
  }
  const rows = parseCsvRows(payload.dataset).map((row, index) => ({
    ...row,
    [CSV_PREVIEW_ROW_INDEX_FIELD]: lower + index,
  }))
  const rowsReturned = toFiniteNumber(payload.rowsReturned) ?? rows.length
  const rowsRequested = toFiniteNumber(payload.rowsRequested) ?? rows.length

  return {
    rows,
    rowsReturned,
    rowsRequested,
    totalRows,
  }
}

async function generateDataset(
  requestPayload: DatasetGenerationRequestPayload,
): Promise<DatasetGenerationMetricsPayload> {
  const response = await fetch(`${API_BASE_URL}/dataset`, {
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

export {
  fetchPersonaSplits,
  fetchPersonaRowCount,
  fetchDatasetRowCount,
  fetchPersonaSplitPreview,
  fetchDatasetPreview,
  generateDataset,
}
