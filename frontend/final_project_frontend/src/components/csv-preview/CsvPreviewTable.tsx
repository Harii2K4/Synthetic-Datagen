import { useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import type { ColDef, RowClickedEvent, RowDoubleClickedEvent } from 'ag-grid-community'
import type {
  CsvDataSource,
  CsvPreviewFilter,
  CsvPreviewMethod,
  CsvPreviewRow,
} from '../../types/csvPreview'
import { filterCsvRows } from '../../lib/fuzzy'
import { CSV_PREVIEW_ROW_INDEX_FIELD } from '../../types/csvPreview'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

type CsvPreviewTableProps = {
  source: CsvDataSource<CsvPreviewRow>
  initialPageSize?: number
  height?: number
  mode?: CsvPreviewMethod
  enableOriginFilter?: boolean
  defaultFilter?: CsvPreviewFilter | null
  lowerLimit?: number
  upperLimit?: number
  selectable?: boolean
  selectedRowIndexes?: number[]
  onSelectedRowIndexesChange?: (rowIndexes: number[]) => void
  onError?: (message: string) => void
}

function CsvPreviewTable({
  source,
  initialPageSize = 25,
  height = 520,
  mode = 'range',
  enableOriginFilter = false,
  defaultFilter = null,
  lowerLimit,
  upperLimit,
  selectable = false,
  selectedRowIndexes = [],
  onSelectedRowIndexesChange,
  onError,
}: CsvPreviewTableProps) {
  const [rows, setRows] = useState<CsvPreviewRow[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<CsvPreviewFilter | null>(defaultFilter)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowsReturned, setRowsReturned] = useState(0)
  const [rowsRequested, setRowsRequested] = useState(0)
  const [totalRows, setTotalRows] = useState<number | null>(null)
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null)
  const hasRangeBounds = lowerLimit !== undefined || upperLimit !== undefined
  const effectiveMode: CsvPreviewMethod =
    enableOriginFilter && activeFilter
      ? (hasRangeBounds ? 'hybrid' : 'filter')
      : mode

  useEffect(() => {
    setPage(0)
    setSearchInput('')
    setSearch('')
    setActiveFilter(defaultFilter)
    setExpandedRowIndex(null)
  }, [source.id, defaultFilter, mode, lowerLimit, upperLimit, enableOriginFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0)
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    void source
      .fetch({
        page,
        pageSize,
        search: undefined,
        mode: effectiveMode,
        filter: activeFilter,
        lowerLimit,
        upperLimit,
      })
      .then((result) => {
        if (!active) {
          return
        }
        setRows(result.rows)
        setExpandedRowIndex(null)
        setRowsReturned(result.rowsReturned)
        setRowsRequested(result.rowsRequested)
        setTotalRows(result.totalRows)
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : 'Failed to load preview rows.'
        setRows([])
        setRowsReturned(0)
        setRowsRequested(0)
        setError(message)
        onError?.(message)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [activeFilter, effectiveMode, lowerLimit, onError, page, pageSize, source, upperLimit])

  const selectedIndexSet = useMemo(() => new Set(selectedRowIndexes), [selectedRowIndexes])
  const filteredRows = useMemo(() => filterCsvRows(rows, search), [rows, search])

  const columnDefs = useMemo<ColDef<CsvPreviewRow>[]>(() => {
    if (rows.length === 0) {
      return []
    }

    return Object.keys(rows[0])
      .filter((key) => key !== CSV_PREVIEW_ROW_INDEX_FIELD)
      .map((key) => ({
        field: key,
        colId: key,
        headerName: key,
        sortable: true,
        resizable: true,
        minWidth: 140,
        flex: 1,
        wrapText: false,
        autoHeight: false,
        tooltipField: key,
        valueFormatter: (params) =>
          params.value === null || params.value === undefined ? '' : String(params.value),
        cellRenderer: (params: { value: unknown; data?: CsvPreviewRow }) => {
          if (params.value === null || params.value === undefined) {
            return ''
          }
          const value = String(params.value)
          const rowIndex = params.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
          if (typeof rowIndex === 'number' && rowIndex === expandedRowIndex) {
            return value
          }
          return value.length > 220 ? `${value.slice(0, 220)}...` : value
        },
        cellClass: (params) => {
          const rowIndex = params.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
          return typeof rowIndex === 'number' && rowIndex === expandedRowIndex
            ? 'csv-preview-cell csv-preview-cell-expanded'
            : 'csv-preview-cell'
        },
      }))
  }, [expandedRowIndex, rows])

  const hasNextPage =
    totalRows === null ? rows.length === pageSize : (page + 1) * pageSize < totalRows
  const showingStart = filteredRows.length === 0 ? 0 : page * pageSize + 1
  const showingEnd = filteredRows.length === 0 ? 0 : page * pageSize + filteredRows.length

  const onRowClicked = (event: RowClickedEvent<CsvPreviewRow>) => {
    if (!selectable) {
      return
    }

    const rowIndex = event.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
    if (typeof rowIndex !== 'number') {
      return
    }

    const nextSelection = new Set(selectedRowIndexes)
    if (nextSelection.has(rowIndex)) {
      nextSelection.delete(rowIndex)
    } else {
      nextSelection.add(rowIndex)
    }

    onSelectedRowIndexesChange?.(Array.from(nextSelection).sort((a, b) => a - b))
  }

  const onRowDoubleClicked = (event: RowDoubleClickedEvent<CsvPreviewRow>) => {
    const rowIndex = event.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
    if (typeof rowIndex !== 'number') {
      return
    }
    setExpandedRowIndex((current) => (current === rowIndex ? null : rowIndex))
    event.api.resetRowHeights()
  }

  return (
    <div className="csv-preview-shell">
      <div className="csv-preview-toolbar">
        <input
          type="search"
          value={searchInput}
          placeholder="Search this split"
          onChange={(event) => setSearchInput(event.target.value)}
          title="Double-click any row to expand/collapse full text."
        />
        {enableOriginFilter ? (
          <select
            value={activeFilter ?? ''}
            onChange={(event) => {
              setPage(0)
              setActiveFilter(event.target.value === '' ? null : (event.target.value as CsvPreviewFilter))
            }}
          >
            <option value="">All origins</option>
            <option value="system">system</option>
            <option value="user">user</option>
          </select>
        ) : null}
        <select
          value={String(pageSize)}
          onChange={(event) => {
            setPage(0)
            setPageSize(Number(event.target.value))
          }}
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
      </div>

      <div
        className={`ag-theme-quartz csv-preview-grid${selectable ? ' csv-preview-grid-selectable' : ''}`}
        style={{ height }}
      >
        <AgGridReact<CsvPreviewRow>
          rowData={filteredRows}
          columnDefs={columnDefs}
          theme="legacy"
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          suppressMultiSort={true}
          onRowClicked={onRowClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          getRowHeight={(params) => {
            const rowIndex = params.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
            return typeof rowIndex === 'number' && rowIndex === expandedRowIndex ? 92 : 34
          }}
          getRowStyle={(params) => {
            const rowIndex = params.data?.[CSV_PREVIEW_ROW_INDEX_FIELD]
            if (!selectable || typeof rowIndex !== 'number' || !selectedIndexSet.has(rowIndex)) {
              return undefined
            }
            return {
              backgroundColor: '#1b3154',
              borderTop: '1px solid #406595',
              borderBottom: '1px solid #406595',
            }
          }}
        />
      </div>

      <div className="csv-preview-meta">
        <p className="muted-text">
          {loading
            ? 'Loading preview rows...'
            : error
            ? error
            : `Showing ${showingStart}-${showingEnd} | matched ${filteredRows.length} | returned ${rowsReturned} / requested ${rowsRequested}${
                totalRows !== null ? ` | total ${totalRows}` : ''
              }${selectable ? ` | selected ${selectedRowIndexes.length}` : ''}`}
        </p>
        <div className="csv-preview-pagination">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!hasNextPage}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export { CsvPreviewTable }
