import { useEffect, useMemo, useState } from 'react'
import { CsvPreviewTable } from '../components/csv-preview/CsvPreviewTable'
import { fetchPersonaRowCount, fetchPersonaSplits } from '../lib/api'
import { createPersonaCsvDataSource } from '../lib/csvPreviewSources'
import type { CsvPreviewMethod } from '../types/csvPreview'
import type { PersonaOption } from '../types/generation'

const DEFAULT_WINDOW_SIZE = 50

function coerceNonNegativeInteger(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(0, Math.trunc(parsed))
}

function PersonaHubPage() {
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([])
  const [selectedSplit, setSelectedSplit] = useState('')
  const [previewMode, setPreviewMode] = useState<CsvPreviewMethod>('range')
  const [lowerLimitText, setLowerLimitText] = useState('0')
  const [upperLimitText, setUpperLimitText] = useState(String(DEFAULT_WINDOW_SIZE))
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [splitRowCount, setSplitRowCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    const loadSplits = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const options = await fetchPersonaSplits()
        if (!active) {
          return
        }
        setPersonaOptions(options)
        if (options.length > 0) {
          setSelectedSplit((current) =>
            current && options.some((option) => option.id === current) ? current : options[0].id,
          )
        }
      } catch (error) {
        if (!active) {
          return
        }
        const message = error instanceof Error ? error.message : 'Failed to load persona splits.'
        setLoadError(message)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadSplits()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedSplit) {
      setSplitRowCount(null)
      return
    }

    let active = true
    void fetchPersonaRowCount(selectedSplit)
      .then((rows) => {
        if (!active) {
          return
        }
        setSplitRowCount(rows)
      })
      .catch(() => {
        if (active) {
          setSplitRowCount(null)
        }
      })

    return () => {
      active = false
    }
  }, [selectedSplit])

  const previewSource = useMemo(
    () => (selectedSplit ? createPersonaCsvDataSource(selectedSplit) : null),
    [selectedSplit],
  )

  const lowerLimit = useMemo(
    () => coerceNonNegativeInteger(lowerLimitText, 0),
    [lowerLimitText],
  )

  const upperLimit = useMemo(() => {
    const parsedUpper = coerceNonNegativeInteger(upperLimitText, lowerLimit + DEFAULT_WINDOW_SIZE)
    return Math.max(lowerLimit + 1, parsedUpper)
  }, [lowerLimit, upperLimitText])

  const usesBounds = previewMode !== 'filter'

  return (
    <section className="generate-page">
      <div className="split-header-row">
        <h2>Persona Hub</h2>
        <button
          type="button"
          onClick={() => {
            setLowerLimitText('0')
            setUpperLimitText(String(DEFAULT_WINDOW_SIZE))
            setPreviewMode('range')
          }}
        >
          Reset View
        </button>
      </div>

      <section className="generate-section">
        <h3>Preview Controls</h3>
        {loadError ? <p className="validation-error">{loadError}</p> : null}
        <div className="field-grid">
          <label>
            <span className="field-label">Persona Split</span>
            <select
              value={selectedSplit}
              onChange={(event) => setSelectedSplit(event.target.value)}
              disabled={isLoading || personaOptions.length === 0}
            >
              {personaOptions.length === 0 ? (
                <option value="">No splits available</option>
              ) : (
                personaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span className="field-label">Preview Mode</span>
            <select
              value={previewMode}
              onChange={(event) => setPreviewMode(event.target.value as CsvPreviewMethod)}
            >
              <option value="range">range</option>
              <option value="filter">filter</option>
              <option value="hybrid">hybrid</option>
            </select>
          </label>

          <label>
            <span className="field-label">Lower Limit</span>
            <input
              type="number"
              min={0}
              value={lowerLimitText}
              onChange={(event) => setLowerLimitText(event.target.value)}
              disabled={!usesBounds}
            />
          </label>

          <label>
            <span className="field-label">Upper Limit</span>
            <input
              type="number"
              min={1}
              value={upperLimitText}
              onChange={(event) => setUpperLimitText(event.target.value)}
              disabled={!usesBounds}
            />
          </label>
        </div>

        <p className="muted-text">
          {splitRowCount === null
            ? 'Row count unavailable for this split.'
            : `Rows available in ${selectedSplit}: ${splitRowCount}`}
        </p>
        {previewMode !== 'range' ? (
          <p className="muted-text">Origin filter (system/user) is available in the table toolbar.</p>
        ) : null}
      </section>

      <section className="generate-section">
        <h3>Split Preview</h3>
        {!previewSource ? (
          <p className="muted-text">Select a persona split to load preview rows.</p>
        ) : (
          <CsvPreviewTable
            source={previewSource}
            initialPageSize={25}
            height={560}
            mode={previewMode}
            enableOriginFilter={previewMode !== 'range'}
            defaultFilter={previewMode === 'range' ? null : 'system'}
            lowerLimit={usesBounds ? lowerLimit : undefined}
            upperLimit={usesBounds ? upperLimit : undefined}
          />
        )}
      </section>
    </section>
  )
}

export { PersonaHubPage }