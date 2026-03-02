import rawModels from '../data/openrouter_models_list.json'
import type { OpenRouterModel } from '../types/generation'

const models = (rawModels as Omit<OpenRouterModel, 'provider' | 'providerKey'>[]).map((model) => {
  const provider = model.name.includes(':') ? model.name.split(':')[0].trim() : 'Unknown'
  const providerKey = model.id.includes('/') ? model.id.split('/')[0].trim().toLowerCase() : 'huggingface'

  return {
    ...model,
    provider,
    providerKey,
  }
})

const providerOptions = Array.from(new Set(models.map((model) => model.provider))).sort()

export { models as openRouterModels, providerOptions }
