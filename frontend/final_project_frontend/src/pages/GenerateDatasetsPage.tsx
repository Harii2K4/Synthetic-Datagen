import { useEffect, useMemo, useState } from 'react'
import { fetchPersonaSplits } from '../lib/api'
import { openRouterModels } from '../lib/openrouterModels'
import type { PersonaOption, UIModelConfig } from '../types/generation'
import { ModelConfigForm } from '../components/generate-datasets/ModelConfigForm'
import { PersonaSplitDropdown } from '../components/generate-datasets/PersonaSplitDropdown'

const defaultModelId = openRouterModels[0]?.id ?? ''

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

function GenerateDatasetsPage() {
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([])
  const [selectedPersonaSplits, setSelectedPersonaSplits] = useState<string[]>([])
  const [isPersonaLoading, setIsPersonaLoading] = useState(true)
  const [generationConfig, setGenerationConfig] = useState<UIModelConfig>(defaultGenerationConfig)
  const [teacherConfig, setTeacherConfig] = useState<UIModelConfig>(defaultTeacherConfig)

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
    </section>
  )
}

export { GenerateDatasetsPage }
