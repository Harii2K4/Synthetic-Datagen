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
