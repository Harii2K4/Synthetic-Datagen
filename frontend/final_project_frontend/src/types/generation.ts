export type ReasoningEffort =
  | 'xhigh'
  | 'high'
  | 'medium'
  | 'low'
  | 'minimal'
  | 'none'

export type ReasoningSummary = 'auto' | 'concise' | 'detailed'
export type RouteMode = 'none' | 'fallback'

export type PersonaOption = {
  id: string
  label: string
}

export type UIModelConfig = {
  modelId: string
  temperature: number
  reasoningEffort: ReasoningEffort
  reasoningSummary: ReasoningSummary
  providerPriority: string[]
  route: string[]
}

export type OpenRouterModel = {
  id: string
  name: string
  context_length: number
  input_price: string
  output_price: string
  provider: string
  providerKey: string
}

export type ProviderEndpoint = {
  providerName: string
  modelId: string
  quantization: string | null
  uptimeLast30m: number | null
  inputPrice: string
  outputPrice: string
}
