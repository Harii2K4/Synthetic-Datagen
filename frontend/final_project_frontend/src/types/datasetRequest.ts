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
  route?: string[]
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
