import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { fetchProviderEndpoints } from '../../lib/providerEndpoints'
import type {
  OpenRouterModel,
  ProviderEndpoint,
  ReasoningEffort,
  ReasoningSummary,
  RouteMode,
  UIModelConfig,
} from '../../types/generation'
import { ModelFuzzyPicker } from './ModelFuzzyPicker'

type ModelConfigFormProps = {
  title: string
  config: UIModelConfig
  models: OpenRouterModel[]
  onChange: (nextValue: UIModelConfig) => void
}

const EFFORT_OPTIONS: ReasoningEffort[] = ['xhigh', 'high', 'medium', 'low', 'minimal', 'none']
const SUMMARY_OPTIONS: ReasoningSummary[] = ['auto', 'concise', 'detailed']

function LabelWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="field-label-row">
      <span className="field-label">{label}</span>
      <span className="hint-icon" title={hint} aria-label={hint}>
        ?
      </span>
    </span>
  )
}

function formatUptime(value: number | null): string {
  if (value === null) {
    return 'N/A'
  }
  return `${value.toFixed(2)}%`
}

function endpointTooltip(endpoint: ProviderEndpoint): string {
  return [
    `Provider: ${endpoint.providerName}`,
    `Quantization: ${endpoint.quantization ?? 'N/A'}`,
    `Uptime (30m): ${formatUptime(endpoint.uptimeLast30m)}`,
    `Input: $${endpoint.inputPrice}`,
    `Output: $${endpoint.outputPrice}`,
  ].join('\n')
}

function ModelConfigForm({ title, config, models, onChange }: ModelConfigFormProps) {
  const [providerEndpoints, setProviderEndpoints] = useState<ProviderEndpoint[]>([])
  const [isProviderLoading, setIsProviderLoading] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const loadProviderOptions = async () => {
      if (!config.modelId.trim()) {
        setProviderEndpoints([])
        return
      }

      setIsProviderLoading(true)
      const endpoints = await fetchProviderEndpoints(config.modelId)

      if (!isCancelled) {
        setProviderEndpoints(endpoints)
        setIsProviderLoading(false)
      }
    }

    void loadProviderOptions()

    return () => {
      isCancelled = true
    }
  }, [config.modelId])

  const endpointMap = useMemo(() => {
    return new Map(providerEndpoints.map((endpoint) => [endpoint.providerName, endpoint]))
  }, [providerEndpoints])

  const availableProviders = useMemo(() => {
    return providerEndpoints.filter(
      (endpoint) => !config.providerPriority.includes(endpoint.providerName),
    )
  }, [providerEndpoints, config.providerPriority])

  const addProvider = (providerName: string) => {
    onChange({
      ...config,
      providerPriority: [...config.providerPriority, providerName],
    })
  }

  const removeProvider = (providerName: string) => {
    onChange({
      ...config,
      providerPriority: config.providerPriority.filter((item) => item !== providerName),
    })
  }

  const moveProvider = (providerName: string, direction: 'up' | 'down') => {
    const index = config.providerPriority.indexOf(providerName)
    if (index === -1) {
      return
    }

    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= config.providerPriority.length) {
      return
    }

    const reordered = [...config.providerPriority]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]

    onChange({
      ...config,
      providerPriority: reordered,
    })
  }

  const routeMode: RouteMode = config.route === 'fallback' ? 'fallback' : 'none'

  return (
    <section className="model-config-card">
      <h3>{title}</h3>
      <ModelFuzzyPicker
        selectedModelId={config.modelId}
        models={models}
        onSelect={(modelId) => onChange({ ...config, modelId, providerPriority: [] })}
      />

      <div className="field-grid">
        <label>
          <LabelWithHint
            label="Model ID"
            hint="Exact model identifier sent to backend, usually in author/slug format."
          />
          <input
            type="text"
            value={config.modelId}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...config, modelId: event.target.value, providerPriority: [] })
            }
          />
        </label>

        <label>
          <LabelWithHint
            label="Temperature (0-2)"
            hint="Controls randomness. Lower is more deterministic; higher is more diverse."
          />
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({
                ...config,
                temperature: Number(event.target.value),
              })
            }
          />
        </label>

        <label>
          <LabelWithHint
            label="Reasoning Effort"
            hint="Sets how much reasoning effort the model should use, impacting quality and token usage."
          />
          <select
            value={config.reasoningEffort}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...config, reasoningEffort: event.target.value as ReasoningEffort })
            }
          >
            {EFFORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          <LabelWithHint
            label="Reasoning Summary"
            hint="Controls verbosity of model reasoning summary metadata if supported."
          />
          <select
            value={config.reasoningSummary}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...config, reasoningSummary: event.target.value as ReasoningSummary })
            }
          >
            {SUMMARY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          <LabelWithHint
            label="Route (optional)"
            hint="none: OpenRouter uses only your provider list. fallback: if your provider list fails/is busy, OpenRouter can use other providers."
          />
          <select
            value={routeMode}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const mode = event.target.value as RouteMode
              onChange({
                ...config,
                route: mode === 'fallback' ? 'fallback' : null,
              })
            }}
          >
            <option value="none">none</option>
            <option value="fallback">fallback</option>
          </select>
        </label>
      </div>

      <div>
        <LabelWithHint
          label="Provider Priority (optional)"
          hint="Add providers in your preferred order. Hover provider names to inspect quantization, uptime, and pricing before ordering."
        />

        {isProviderLoading ? <p className="muted-text">Loading providers...</p> : null}
        {!isProviderLoading && providerEndpoints.length === 0 ? (
          <p className="muted-text">No provider options available for the current model.</p>
        ) : null}

        <div className="provider-panels">
          <div className="provider-panel">
            <p className="provider-panel-title">Available Providers</p>
            {availableProviders.length === 0 ? (
              <p className="muted-text">No more providers to add.</p>
            ) : (
              <div className="provider-list">
                {availableProviders.map((endpoint) => (
                  <div key={endpoint.providerName} className="provider-list-item">
                    <span title={endpointTooltip(endpoint)}>{endpoint.providerName}</span>
                    <button type="button" onClick={() => addProvider(endpoint.providerName)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="provider-panel">
            <p className="provider-panel-title">Selected Priority Order</p>
            {config.providerPriority.length === 0 ? (
              <p className="muted-text">No providers selected.</p>
            ) : (
              <div className="provider-list">
                {config.providerPriority.map((providerName, index) => {
                  const endpoint = endpointMap.get(providerName)

                  return (
                    <div key={providerName} className="provider-list-item">
                      <span title={endpoint ? endpointTooltip(endpoint) : providerName}>
                        {index + 1}. {providerName}
                      </span>
                      <div className="provider-actions">
                        <button
                          type="button"
                          onClick={() => moveProvider(providerName, 'up')}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProvider(providerName, 'down')}
                          disabled={index === config.providerPriority.length - 1}
                        >
                          Down
                        </button>
                        <button type="button" onClick={() => removeProvider(providerName)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export { ModelConfigForm }
