import { useMemo, useState, type KeyboardEvent } from 'react'
import { filterModels } from '../../lib/fuzzy'
import type { OpenRouterModel } from '../../types/generation'

// Load all provider logos from assets/provider_logos.
const providerLogoMap = import.meta.glob('../../assets/provider_logos/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const fallbackLogo = Object.entries(providerLogoMap).find(([path]) =>
  path.endsWith('/huggingface.png'),
)?.[1]

type ModelFuzzyPickerProps = {
  selectedModelId: string
  models: OpenRouterModel[]
  onSelect: (modelId: string) => void
}

function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M tokens`
  }

  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K tokens`
  }

  return `${tokens} tokens`
}

function getProviderLogo(providerKey: string): string | undefined {
  const fileSuffix = `/${providerKey}.png`
  const match = Object.entries(providerLogoMap).find(([path]) => path.endsWith(fileSuffix))?.[1]

  return match ?? fallbackLogo
}

function ModelFuzzyPicker({ selectedModelId, models, onSelect }: ModelFuzzyPickerProps) {
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  const filteredModels = useMemo(() => filterModels(models, query), [models, query])
  const shouldShowResults = query.trim().length > 0

  const onPickModel = (modelId: string) => {
    onSelect(modelId)
    setQuery('')
    setFocusedIndex(0)
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShowResults || filteredModels.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedIndex((value) => Math.min(value + 1, filteredModels.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedIndex((value) => Math.max(value - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const model = filteredModels[focusedIndex]
      if (model) {
        onPickModel(model.id)
      }
    }
  }

  return (
    <div className="model-picker">
      <label className="field-label-row">
        <span className="field-label">Model Name (fuzzy search)</span>
        <span
          className="hint-icon"
          title="Type part of a model name or id to open the result list and select a model. Use up/down arrow keys and Enter to select."
          aria-label="Type part of a model name or id to open the result list and select a model. Use up/down arrow keys and Enter to select."
        >
          ?
        </span>
      </label>

      <input
        type="text"
        placeholder="Search model name or id"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setFocusedIndex(0)
        }}
        onKeyDown={onInputKeyDown}
      />

      {shouldShowResults ? (
        <div className="model-results" role="listbox">
          {filteredModels.length > 0 ? (
            filteredModels.map((model, index) => {
              const logo = getProviderLogo(model.providerKey)
              const isFocused = index === focusedIndex

              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-result-item ${selectedModelId === model.id ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
                  onClick={() => onPickModel(model.id)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  title={`Context: ${formatContextLength(model.context_length)}\nInput: $${model.input_price}\nOutput: $${model.output_price}`}
                  aria-label={model.name}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={`${model.provider} logo`}
                      className="model-provider-logo"
                      loading="lazy"
                    />
                  ) : null}
                  <span>{model.name}</span>
                </button>
              )
            })
          ) : (
            <p className="model-empty-text">No models matched your search.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export { ModelFuzzyPicker }
