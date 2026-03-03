export type CsvPreviewRow = Record<string, unknown>
export const CSV_PREVIEW_ROW_INDEX_FIELD = '__rowIndex'

export type CsvPreviewSort = {
  field: string
  dir: 'asc' | 'desc'
}

export type CsvPreviewMethod = 'range' | 'filter' | 'hybrid'

export type CsvPreviewFilter = 'user' | 'system'

export type CsvPreviewQuery = {
  page: number
  pageSize: number
  search?: string
  sort?: CsvPreviewSort | null
  mode?: CsvPreviewMethod
  filter?: CsvPreviewFilter | null
  lowerLimit?: number
  upperLimit?: number
}

export type CsvPreviewResult<T extends CsvPreviewRow> = {
  rows: T[]
  rowsReturned: number
  rowsRequested: number
  totalRows: number | null
}

export type CsvDataSource<T extends CsvPreviewRow> = {
  kind: 'persona' | 'dataset'
  id: string
  fetch: (query: CsvPreviewQuery) => Promise<CsvPreviewResult<T>>
  getTotalRows: () => Promise<number | null>
}
