import { useEffect, useMemo, useState } from 'react'
import { CsvPreviewTable } from '../components/csv-preview/CsvPreviewTable'
import { fetchDatasetList, fetchDatasetRowCount } from '../lib/api'
import { createDatasetCsvDataSource } from '../lib/csvPreviewSources'

const DEFAULT_WINDOW_SIZE = 100

function toSafeNonNegativeInteger(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(0, Math.trunc(parsed))
}

function ViewDatasetPage() {
  const [datasets, setDatasets] = useState<string[]>([])
  const [selectedDataset, setSelectedDataset] = useState('')
  const [lowerLimitText, setLowerLimitText] = useState('0')
  const [upperLimitText, setUpperLimitText] = useState(String(DEFAULT_WINDOW_SIZE))
  const [datasetRowCount, setDatasetRowCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadDatasets = async () => {
      setIsLoading(true)
      setError('')
      const list = await fetchDatasetList()

      if (!active) {
        return
      }

      setDatasets(list)
      if (list.length > 0) {
        setSelectedDataset((current) =>
          current && list.includes(current) ? current : list[0],
        )
      } else {
        setSelectedDataset('')
        setError('No datasets found in data/datasets.')
      }
      setIsLoading(false)
    }

    void loadDatasets()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedDataset) {
      setDatasetRowCount(null)
      return
    }

    let active = true
    void fetchDatasetRowCount(selectedDataset)
      .then((rows) => {
        if (active) {
          setDatasetRowCount(rows)
        }
      })
      .catch(() => {
        if (active) {
          setDatasetRowCount(null)
        }
      })

    return () => {
      active = false
    }
  }, [selectedDataset])

  const lowerLimit = useMemo(
    () => toSafeNonNegativeInteger(lowerLimitText, 0),
    [lowerLimitText],
  )
  const upperLimit = useMemo(() => {
    const candidate = toSafeNonNegativeInteger(upperLimitText, lowerLimit + DEFAULT_WINDOW_SIZE)
    return Math.max(lowerLimit + 1, candidate)
  }, [lowerLimit, upperLimitText])

  const previewSource = useMemo(
    () => (selectedDataset ? createDatasetCsvDataSource(selectedDataset) : null),
    [selectedDataset],
  )

  return (
    <section className="generate-page">
      <div className="split-header-row">
        <h2>View Dataset</h2>
        <button
          type="button"
          onClick={() => {
            setLowerLimitText('0')
            setUpperLimitText(String(DEFAULT_WINDOW_SIZE))
          }}
          disabled={!selectedDataset}
        >
          Reset Range
        </button>
      </div>

      <section className="generate-section">
        <h3>Dataset Controls</h3>
        {error ? <p className="validation-error">{error}</p> : null}
        <div className="field-grid">
          <label>
            <span className="field-label">Dataset</span>
            <select
              value={selectedDataset}
              onChange={(event) => setSelectedDataset(event.target.value)}
              disabled={isLoading || datasets.length === 0}
            >
              {datasets.length === 0 ? (
                <option value="">No datasets available</option>
              ) : (
                datasets.map((datasetName) => (
                  <option key={datasetName} value={datasetName}>
                    {datasetName}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span className="field-label">Lower Limit</span>
            <input
              type="number"
              min={0}
              value={lowerLimitText}
              onChange={(event) => setLowerLimitText(event.target.value)}
              disabled={!selectedDataset}
            />
          </label>

          <label>
            <span className="field-label">Upper Limit</span>
            <input
              type="number"
              min={1}
              value={upperLimitText}
              onChange={(event) => setUpperLimitText(event.target.value)}
              disabled={!selectedDataset}
            />
          </label>
        </div>

        <p className="muted-text">
          {datasetRowCount === null
            ? 'Dataset row count unavailable.'
            : `Rows available: ${datasetRowCount}`}
        </p>
      </section>

      <section className="generate-section">
        <h3>Dataset Preview</h3>
        {!previewSource ? (
          <p className="muted-text">Choose a dataset to preview rows.</p>
        ) : (
          <CsvPreviewTable
            source={previewSource}
            initialPageSize={25}
            mode="range"
            height={560}
            lowerLimit={lowerLimit}
            upperLimit={upperLimit}
          />
        )}
      </section>
    </section>
  )
}

export { ViewDatasetPage }