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

export type SelectionMethod = 'random' | 'sequence' | 'selected'

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
