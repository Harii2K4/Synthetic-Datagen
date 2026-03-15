import type { ReasoningEffort, ReasoningSummary } from './generation'

export type PersonaSplit =
  | 'math'
  | 'instruction'
  | 'knowledge'
  | 'reasoning'
  | 'tool'
  | 'npc'
  | 'general'

export type Domain = Exclude<PersonaSplit, 'general'>

export type SelectionMethod = 'random' | 'sequence' | 'selected' | 'ranged'

export type ModelConfigPayload = {
  modelId: string
  temperature: number
  reasoningEffort: ReasoningEffort
  reasoningSummary: ReasoningSummary
  providerPriority?: string[]
  route?: string
}

export type PersonaSplitsChoicesPayload = {
  split: PersonaSplit
  selectionMethod: SelectionMethod
  selectionList?: number[] | null
  seed: number
  size: number
  generationModel?: ModelConfigPayload
  teacherModel?: ModelConfigPayload
}

export type PersonaConfigEntry = {
  [key in Domain]?: PersonaSplitsChoicesPayload
}

export type DatasetGenerationConfigPayload = {
  personaConfig: PersonaConfigEntry[]
  datasetSize: number
  generationModel: ModelConfigPayload
  teacherModel: ModelConfigPayload
  datasetName: string
}

export type DatasetGenerationRequestPayload = {
  jobId: string
  config: DatasetGenerationConfigPayload
}

export type SplitConfigDraft = {
  split: PersonaSplit
  domain: Domain
  selectionMethod: SelectionMethod
  size: number
  seed: number
  lowerLimit: number
  upperLimit: number
  selectionList: number[]
  rowCount: number | null
  generationModel?: ModelConfigPayload
  teacherModel?: ModelConfigPayload
}

export type SplitConfigCompletion = {
  splitConfigDrafts: SplitConfigDraft[]
  datasetName: string
  datasetSize: number
}

export type SplitErrorStage =
  | 'persona_read'
  | 'question_generation'
  | 'answer_generation'
  | 'validation'
  | 'unknown'

export type SplitErrorPayload = {
  split: PersonaSplit
  stage: SplitErrorStage
  errorType: string
  message: string
  retryable: boolean
}

export type DatasetGenerationStatus = 'success' | 'partial' | 'failure'

export type DatasetGenerationMetricsPayload = {
  jobId: string
  totalSplits: number
  successfulSplits: number
  failedSplits: number
  totalRowsRequested: number
  rowsGenerated: number
  rowsFailed: number
  status: DatasetGenerationStatus
  datasetSaveLocation: string
  errors: SplitErrorPayload[]
}

export type DashboardSummaryPayload = {
  totalJobs: number
  successJobs: number
  partialJobs: number
  failedJobs: number
  retryableJobs: number
  totalRowsRequested: number
  totalRowsGenerated: number
  totalRowsFailed: number
}

export type DashboardHistoryItemPayload = {
  job_id: string
  dataset_name: string
  status: DatasetGenerationStatus
  total_rows_requested: number
  rows_generated: number
  rows_failed: number
  retryable: boolean
  dataset_save_location: string
  created_at: string
  retried_from_job_id?: string | null
}

export type DashboardHistoryResponsePayload = {
  history: DashboardHistoryItemPayload[]
  limit: number
  offset: number
}

export type DashboardHistoryDetailsPayload = {
  job_id: string
  request_payload?: DatasetGenerationRequestPayload
  metrics_payload?: DatasetGenerationMetricsPayload
  retryable?: boolean
  status?: DatasetGenerationStatus
}
