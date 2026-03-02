import { useEffect, useMemo, useState } from 'react'
import { fetchPersonaSplits } from '../lib/api'
import { openRouterModels } from '../lib/openrouterModels'
import type {
  DatasetGenerationRequestPayload,
  Domain,
  ModelConfigPayload,
  PersonaConfigEntry,
  PersonaSplitsChoicesPayload,
} from '../types/datasetRequest'
import type { PersonaOption, UIModelConfig } from '../types/generation'
import { ModelConfigForm } from '../components/generate-datasets/ModelConfigForm'
import { PersonaSplitDropdown } from '../components/generate-datasets/PersonaSplitDropdown'

const defaultModelId = openRouterModels[0]?.id ?? ''
const DOMAIN_SPLITS: Domain[] = ['math', 'instruction', 'knowledge', 'reasoning', 'tool', 'npc']
const STORAGE_KEY = 'generate_datasets_saved_payload'

const defaultGenerationConfig: UIModelConfig = {
  modelId: defaultModelId,
  temperature: 0,
  reasoningEffort: 'none',
  reasoningSummary: 'auto',
  providerPriority: [],
  route: [],
}

const defaultTeacherConfig: UIModelConfig = {
  modelId: defaultModelId,
  temperature: 0,
  reasoningEffort: 'medium',
  reasoningSummary: 'auto',
  providerPriority: [],
  route: [],
}

function isDomainSplit(split: string): split is Domain {
  return DOMAIN_SPLITS.includes(split as Domain)
}

function toModelPayload(config: UIModelConfig): ModelConfigPayload {
  return {
    modelId: config.modelId,
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort,
    reasoningSummary: config.reasoningSummary,
    ...(config.providerPriority.length > 0 ? { providerPriority: config.providerPriority } : {}),
    ...(config.route.length > 0 ? { route: config.route } : {}),
  }
}

function buildPersonaConfig(selectedSplits: string[]): PersonaConfigEntry[] {
  return selectedSplits.filter(isDomainSplit).map((split) => {
    const splitConfig: PersonaSplitsChoicesPayload = {
      split,
      selectionMethod: 'sequence',
      selectionList: null,
      seed: 42,
      size: 0,
    }

    return { [split]: splitConfig }
  })
}

function createJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `job-${Date.now()}`
}

function GenerateDatasetsPage() {
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([])
  const [selectedPersonaSplits, setSelectedPersonaSplits] = useState<string[]>([])
  const [isPersonaLoading, setIsPersonaLoading] = useState(true)
  const [generationConfig, setGenerationConfig] = useState<UIModelConfig>(defaultGenerationConfig)
  const [teacherConfig, setTeacherConfig] = useState<UIModelConfig>(defaultTeacherConfig)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    const loadPersonaSplits = async () => {
      const options = await fetchPersonaSplits()
      setPersonaOptions(options)
      setIsPersonaLoading(false)
    }

    void loadPersonaSplits()
  }, [])

  const selectedLabels = useMemo(
    () =>
      personaOptions
        .filter((option) => selectedPersonaSplits.includes(option.id))
        .map((option) => option.label),
    [personaOptions, selectedPersonaSplits],
  )

  const togglePersonaSplit = (id: string) => {
    setSelectedPersonaSplits((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const handleSaveSelections = () => {
    const personaConfig = buildPersonaConfig(selectedPersonaSplits)
    const nonDomainSplits = selectedPersonaSplits.filter((split) => !isDomainSplit(split))

    const requestPayload: DatasetGenerationRequestPayload = {
      jobId: createJobId(),
      config: {
        personaConfig,
        datasetSize: 0,
        generationModel: toModelPayload(generationConfig),
        teacherModel: toModelPayload(teacherConfig),
        datasetName: 'draft_dataset',
      },
    }

    const savedDraft = {
      savedAt: new Date().toISOString(),
      selectedPersonaSplits,
      nonDomainSplits,
      requestPayload,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDraft))
    console.log('Generate datasets draft saved:', savedDraft)

    setSaveMessage(
      nonDomainSplits.length > 0
        ? `Saved. Non-domain splits kept for future config: ${nonDomainSplits.join(', ')}`
        : 'Saved successfully.',
    )
  }

  return (
    <section className="generate-page">
      <h2>Generate Datasets</h2>

      <section className="generate-section">
        <h3>1) Persona Splits</h3>
        <PersonaSplitDropdown
          options={personaOptions}
          selectedIds={selectedPersonaSplits}
          onToggle={togglePersonaSplit}
          loading={isPersonaLoading}
        />

        <div className="selected-list">
          <p className="field-label">Selected persona splits:</p>
          {selectedLabels.length > 0 ? (
            <div className="chip-list">
              {selectedLabels.map((label) => (
                <span key={label} className="chip">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-text">None selected</p>
          )}
        </div>
      </section>

      <section className="generate-section">
        <h3>2) Model Selection</h3>
        <div className="model-sections">
          <ModelConfigForm
            title="Generation Model"
            config={generationConfig}
            models={openRouterModels}
            onChange={setGenerationConfig}
          />
          <ModelConfigForm
            title="Teacher Model"
            config={teacherConfig}
            models={openRouterModels}
            onChange={setTeacherConfig}
          />
        </div>
      </section>

      <div className="generate-save-row">
        <button type="button" onClick={handleSaveSelections}>
          Save Selections
        </button>
        {saveMessage ? <p className="save-status">{saveMessage}</p> : null}
      </div>
    </section>
  )
}

export { GenerateDatasetsPage }
