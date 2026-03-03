import {
  fetchDatasetPreview,
  fetchDatasetRowCount,
  fetchPersonaRowCount,
  fetchPersonaSplitPreview,
} from './api'
import type { CsvDataSource, CsvPreviewRow } from '../types/csvPreview'

function createPersonaCsvDataSource(split: string): CsvDataSource<CsvPreviewRow> {
  return {
    kind: 'persona',
    id: split,
    fetch: (query) => fetchPersonaSplitPreview(split, query),
    getTotalRows: () => fetchPersonaRowCount(split),
  }
}

function createDatasetCsvDataSource(datasetName: string): CsvDataSource<CsvPreviewRow> {
  return {
    kind: 'dataset',
    id: datasetName,
    fetch: (query) => fetchDatasetPreview(datasetName, query),
    getTotalRows: () => fetchDatasetRowCount(datasetName),
  }
}

export { createPersonaCsvDataSource, createDatasetCsvDataSource }
