import type { OpenRouterModel } from '../types/generation'
import type { CsvPreviewRow } from '../types/csvPreview'

function fuzzyScore(source: string, query: string): number {
  if (!query) {
    return 0
  }

  let queryIndex = 0
  let score = 0

  for (let i = 0; i < source.length && queryIndex < query.length; i += 1) {
    if (source[i] === query[queryIndex]) {
      score += 2
      if (i > 0 && queryIndex > 0 && source[i - 1] === query[queryIndex - 1]) {
        score += 2
      }
      queryIndex += 1
    }
  }

  if (queryIndex !== query.length) {
    return -1
  }

  return score - (source.length - query.length) * 0.02
}

function filterModels(models: OpenRouterModel[], query: string, limit = 25): OpenRouterModel[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return models.slice(0, limit)
  }

  return models
    .map((model) => ({
      model,
      score: Math.max(
        fuzzyScore(model.name.toLowerCase(), normalizedQuery),
        fuzzyScore(model.id.toLowerCase(), normalizedQuery),
      ),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.model)
}

function filterCsvRows(rows: CsvPreviewRow[], query: string): CsvPreviewRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return rows
  }

  return rows
    .map((row) => {
      const valueText = Object.values(row)
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ')
      return {
        row,
        score: fuzzyScore(valueText, normalizedQuery),
      }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row)
}

export { filterModels, filterCsvRows }
