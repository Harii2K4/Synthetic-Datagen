import { useEffect, useMemo, useState } from 'react'
import {
  fetchDashboardHistoryDetails,
  fetchDashboardHistory,
  fetchDashboardSummary,
  retryDatasetGeneration,
} from '../lib/api'
import type {
  DashboardHistoryDetailsPayload,
  DashboardHistoryItemPayload,
  DashboardSummaryPayload,
} from '../types/datasetRequest'

const DEFAULT_SUMMARY: DashboardSummaryPayload = {
  totalJobs: 0,
  successJobs: 0,
  partialJobs: 0,
  failedJobs: 0,
  retryableJobs: 0,
  totalRowsRequested: 0,
  totalRowsGenerated: 0,
  totalRowsFailed: 0,
}

function formatDate(isoValue: string): string {
  if (!isoValue) {
    return 'N/A'
  }
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) {
    return isoValue
  }
  return date.toLocaleString()
}

function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryPayload>(DEFAULT_SUMMARY)
  const [history, setHistory] = useState<DashboardHistoryItemPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [detailsLoadingJobId, setDetailsLoadingJobId] = useState<string | null>(null)
  const [detailsModal, setDetailsModal] = useState<DashboardHistoryDetailsPayload | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryPayload, historyPayload] = await Promise.all([
        fetchDashboardSummary(500),
        fetchDashboardHistory(2000, 0),
      ])
      setSummary(summaryPayload)
      setHistory(historyPayload.history)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load dashboard data.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const successRate = useMemo(() => {
    if (summary.totalRowsRequested <= 0) {
      return '0.00%'
    }
    const value = (summary.totalRowsGenerated / summary.totalRowsRequested) * 100
    return `${value.toFixed(2)}%`
  }, [summary.totalRowsGenerated, summary.totalRowsRequested])

  const onRetry = async (jobId: string) => {
    setRetryingJobId(jobId)
    setError('')
    try {
      await retryDatasetGeneration(jobId)
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Retry failed.'
      setError(message)
    } finally {
      setRetryingJobId(null)
    }
  }

  const onViewDetails = async (jobId: string) => {
    setDetailsLoadingJobId(jobId)
    setError('')
    try {
      const details = await fetchDashboardHistoryDetails(jobId)
      setDetailsModal(details)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load row details.'
      setError(message)
    } finally {
      setDetailsLoadingJobId(null)
    }
  }

  return (
    <section className="generate-page">
      <div className="split-header-row">
        <h2>Dashboard</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <p className="validation-error">{error}</p> : null}

      <section className="generate-section">
        <h3>Summary Metrics</h3>
        <div className="summary-grid">
          <div className="summary-stat-card">
            <p className="muted-text">Total Jobs</p>
            <strong>{summary.totalJobs}</strong>
          </div>
          <div className="summary-stat-card">
            <p className="muted-text">Success / Partial / Failed</p>
            <strong>
              {summary.successJobs} / {summary.partialJobs} / {summary.failedJobs}
            </strong>
          </div>
          <div className="summary-stat-card">
            <p className="muted-text">Retryable Jobs</p>
            <strong>{summary.retryableJobs}</strong>
          </div>
          <div className="summary-stat-card">
            <p className="muted-text">Rows Generated / Requested</p>
            <strong>
              {summary.totalRowsGenerated} / {summary.totalRowsRequested}
            </strong>
          </div>
          <div className="summary-stat-card">
            <p className="muted-text">Rows Failed</p>
            <strong>{summary.totalRowsFailed}</strong>
          </div>
          <div className="summary-stat-card">
            <p className="muted-text">Generation Success Rate</p>
            <strong>{successRate}</strong>
          </div>
        </div>
      </section>

      <section className="generate-section">
        <h3>Generation History</h3>
        <p className="muted-text">Showing all available history entries. Use View Details for full DB record.</p>
        {loading ? <p className="muted-text">Loading history...</p> : null}
        {!loading && history.length === 0 ? <p className="muted-text">No generation runs found.</p> : null}

        {!loading && history.length > 0 ? (
          <div className="history-table-shell">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Created At</th>
                  <th>Job ID</th>
                  <th>Dataset</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Saved Location</th>
                  <th>Details</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const rowsInfo = `${item.rows_generated}/${item.total_rows_requested}`
                  const retryDisabled = !item.retryable || retryingJobId !== null
                  return (
                    <tr key={item.job_id}>
                      <td>{formatDate(item.created_at)}</td>
                      <td>{item.job_id}</td>
                      <td>{item.dataset_name || 'N/A'}</td>
                      <td>{item.status}</td>
                      <td>{rowsInfo}</td>
                      <td>{item.dataset_save_location || 'N/A'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void onViewDetails(item.job_id)}
                          disabled={detailsLoadingJobId !== null}
                        >
                          {detailsLoadingJobId === item.job_id ? 'Loading...' : 'View Details'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={retryDisabled}
                          onClick={() => void onRetry(item.job_id)}
                        >
                          {retryingJobId === item.job_id ? 'Retrying...' : 'Retry'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {detailsModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Generation History Details"
        >
          <div className="modal-card history-details-modal">
            <div className="split-header-row">
              <h3>Generation Details</h3>
              <button type="button" onClick={() => setDetailsModal(null)}>
                Close
              </button>
            </div>

            <div className="details-grid">
              <div className="details-card">
                <p className="field-label">Job ID</p>
                <p>{detailsModal.job_id}</p>
              </div>
              <div className="details-card">
                <p className="field-label">Status</p>
                <p>{detailsModal.status ?? 'N/A'}</p>
              </div>
              <div className="details-card">
                <p className="field-label">Retryable</p>
                <p>{String(detailsModal.retryable ?? false)}</p>
              </div>
            </div>

            <section className="generate-section">
              <h4>Request Payload</h4>
              <pre className="json-panel">{JSON.stringify(detailsModal.request_payload ?? {}, null, 2)}</pre>
            </section>

            <section className="generate-section">
              <h4>Metrics Payload</h4>
              <pre className="json-panel">{JSON.stringify(detailsModal.metrics_payload ?? {}, null, 2)}</pre>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export { DashboardPage }
