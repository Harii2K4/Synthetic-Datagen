import { useEffect, useMemo, useState } from 'react'
import { ModelConfigForm } from '../components/generate-datasets/ModelConfigForm'
import { fetchPersonaRowCount } from '../lib/api'
import { openRouterModels } from '../lib/openrouterModels'
import type {
  Domain,
  ModelConfigPayload,
  PersonaSplit,
  SelectionMethod,
  SplitConfigDraft,
} from '../types/datasetRequest'
import type { UIModelConfig } from '../types/generation'

type SplitConfigStepperPageProps = {
  selectedSplits: string[]
  globalGenerationModel: UIModelConfig
  globalTeacherModel: UIModelConfig
  initialConfigs: SplitConfigDraft[]
  onBack: (configs: SplitConfigDraft[]) => void
}

type OverrideKind = 'generation' | 'teacher' | null

const DOMAIN_OPTIONS: Domain[] = ['math', 'instruction', 'knowledge', 'reasoning', 'tool', 'npc']
const SPLIT_OPTIONS: PersonaSplit[] = [
  'math',
  'instruction',
  'knowledge',
  'reasoning',
  'tool',
  'npc',
  'general',
]

function isPersonaSplit(value: string): value is PersonaSplit {
  return SPLIT_OPTIONS.includes(value as PersonaSplit)
}

function defaultDomainForSplit(split: PersonaSplit): Domain {
  if (split !== 'general' && DOMAIN_OPTIONS.includes(split as Domain)) {
    return split as Domain
  }
  return 'math'
}

function toUIModelConfig(model: ModelConfigPayload | undefined, fallback: UIModelConfig): UIModelConfig {
  if (!model) {
    return fallback
  }

  return {
    modelId: model.modelId,
    temperature: model.temperature,
    reasoningEffort: model.reasoningEffort,
    reasoningSummary: model.reasoningSummary,
    providerPriority: model.providerPriority ?? [],
    route: model.route ?? [],
  }
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

function createDefaultDraft(split: PersonaSplit): SplitConfigDraft {
  return {
    split,
    domain: defaultDomainForSplit(split),
    selectionMethod: 'sequence',
    size: 0,
    seed: 42,
    lowerLimit: 0,
    upperLimit: 0,
    selectionList: [],
    rowCount: null,
  }
}

function getConfiguredDrafts(
  selectedSplits: PersonaSplit[],
  initialConfigs: SplitConfigDraft[],
): SplitConfigDraft[] {
  return selectedSplits.map((split) => {
    const existing = initialConfigs.find((draft) => draft.split === split)
    return existing ?? createDefaultDraft(split)
  })
}

function ModelOverrideModal({
  title,
  initialConfig,
  onSave,
  onClose,
}: {
  title: string
  initialConfig: UIModelConfig
  onSave: (config: UIModelConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<UIModelConfig>(initialConfig)

  useEffect(() => {
    setDraft(initialConfig)
  }, [initialConfig])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card">
        <h3>{title}</h3>
        <ModelConfigForm title="Model Override" config={draft} models={openRouterModels} onChange={setDraft} />
        <div className="modal-actions">
          <button
            type="button"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SplitConfigStepperPage({
  selectedSplits,
  globalGenerationModel,
  globalTeacherModel,
  initialConfigs,
  onBack,
}: SplitConfigStepperPageProps) {
  const validSelectedSplits = useMemo(
    () => selectedSplits.filter(isPersonaSplit),
    [selectedSplits],
  )

  const [drafts, setDrafts] = useState<SplitConfigDraft[]>(() =>
    getConfiguredDrafts(validSelectedSplits, initialConfigs),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [overrideKind, setOverrideKind] = useState<OverrideKind>(null)

  useEffect(() => {
    setDrafts(getConfiguredDrafts(validSelectedSplits, initialConfigs))
    setCurrentIndex(0)
  }, [validSelectedSplits, initialConfigs])

  const currentDraft = drafts[currentIndex]

  useEffect(() => {
    if (!currentDraft || currentDraft.rowCount !== null) {
      return
    }

    let isCancelled = false

    const loadRowCount = async () => {
      const rowCount = await fetchPersonaRowCount(currentDraft.split)
      if (isCancelled) {
        return
      }

      setDrafts((previous) =>
        previous.map((draft, index) => {
          if (index !== currentIndex) {
            return draft
          }

          const normalizedUpper = rowCount !== null && draft.upperLimit === 0 ? rowCount : draft.upperLimit
          return {
            ...draft,
            rowCount,
            upperLimit: normalizedUpper,
          }
        }),
      )
    }

    void loadRowCount()

    return () => {
      isCancelled = true
    }
  }, [currentDraft, currentIndex])

  const updateCurrentDraft = (updates: Partial<SplitConfigDraft>) => {
    setDrafts((previous) =>
      previous.map((draft, index) => (index === currentIndex ? { ...draft, ...updates } : draft)),
    )
  }

  if (validSelectedSplits.length === 0 || !currentDraft) {
    return (
      <section className="generate-page">
        <h2>Split Settings</h2>
        <p className="muted-text">No splits selected. Go back and select at least one split.</p>
        <button type="button" onClick={() => onBack(initialConfigs)}>
          Back To Generate Datasets
        </button>
      </section>
    )
  }

  const openGenerationModal = () => setOverrideKind('generation')
  const openTeacherModal = () => setOverrideKind('teacher')

  const selectionMethod = currentDraft.selectionMethod

  return (
    <section className="generate-page">
      <div className="split-header-row">
        <h2>Split Settings</h2>
        <button type="button" onClick={() => onBack(drafts)}>
          Back To Generate Datasets
        </button>
      </div>

      <p className="muted-text">
        Split {currentIndex + 1} of {drafts.length}
      </p>

      <section className="generate-section">
        <h3>Current Split: {currentDraft.split}</h3>

        <div className="field-grid">
          <label>
            <span className="field-label">Domain (single)</span>
            <select
              value={currentDraft.domain}
              onChange={(event) => updateCurrentDraft({ domain: event.target.value as Domain })}
            >
              {DOMAIN_OPTIONS.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">Selection Method</span>
            <select
              value={currentDraft.selectionMethod}
              onChange={(event) =>
                updateCurrentDraft({ selectionMethod: event.target.value as SelectionMethod })
              }
            >
              <option value="sequence">sequence</option>
              <option value="random">random</option>
              <option value="ranged">ranged</option>
              <option value="selected">selected</option>
            </select>
          </label>

          {(selectionMethod === 'sequence' || selectionMethod === 'random') ? (
            <label>
              <span className="field-label">
                Local Size {currentDraft.rowCount !== null ? `(max ${currentDraft.rowCount})` : ''}
              </span>
              <input
                type="number"
                min={0}
                max={currentDraft.rowCount ?? undefined}
                value={currentDraft.size}
                onChange={(event) => updateCurrentDraft({ size: Number(event.target.value) })}
              />
            </label>
          ) : null}

          {selectionMethod === 'random' ? (
            <label>
              <span className="field-label">Seed</span>
              <input
                type="number"
                value={currentDraft.seed}
                onChange={(event) => updateCurrentDraft({ seed: Number(event.target.value) })}
              />
            </label>
          ) : null}

          {selectionMethod === 'ranged' ? (
            <>
              <label>
                <span className="field-label">Lower Limit</span>
                <input
                  type="number"
                  min={0}
                  max={currentDraft.rowCount ?? undefined}
                  value={currentDraft.lowerLimit}
                  onChange={(event) => updateCurrentDraft({ lowerLimit: Number(event.target.value) })}
                />
              </label>

              <label>
                <span className="field-label">Upper Limit</span>
                <input
                  type="number"
                  min={0}
                  max={currentDraft.rowCount ?? undefined}
                  value={currentDraft.upperLimit}
                  onChange={(event) => updateCurrentDraft({ upperLimit: Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}
        </div>

        {selectionMethod === 'selected' ? (
          <p className="muted-text">
            Manual row selection and CSV preview will be added next. Current selected rows: {currentDraft.selectionList.length}
          </p>
        ) : null}

        <p className="muted-text">
          Total rows in split: {currentDraft.rowCount !== null ? currentDraft.rowCount : 'Unavailable'}
        </p>
      </section>

      <section className="generate-section">
        <h3>Local Model Overrides (optional)</h3>
        <div className="split-actions-row">
          <button type="button" onClick={openGenerationModal}>
            Select Local Generation Model
          </button>
          {currentDraft.generationModel ? (
            <button type="button" onClick={() => updateCurrentDraft({ generationModel: undefined })}>
              Use Global Generation Model
            </button>
          ) : null}
        </div>

        <p className="muted-text">
          Generation model: {currentDraft.generationModel ? currentDraft.generationModel.modelId : 'Using global'}
        </p>

        <div className="split-actions-row">
          <button type="button" onClick={openTeacherModal}>
            Select Local Teacher Model
          </button>
          {currentDraft.teacherModel ? (
            <button type="button" onClick={() => updateCurrentDraft({ teacherModel: undefined })}>
              Use Global Teacher Model
            </button>
          ) : null}
        </div>

        <p className="muted-text">
          Teacher model: {currentDraft.teacherModel ? currentDraft.teacherModel.modelId : 'Using global'}
        </p>
      </section>

      <section className="generate-section">
        <h3>Split Preview</h3>
        <p className="muted-text">CSV preview for this split will be added in the next step.</p>
      </section>

      <div className="split-nav-row">
        <button
          type="button"
          onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
          disabled={currentIndex === 0}
        >
          Previous Split
        </button>

        {currentIndex < drafts.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((value) => Math.min(drafts.length - 1, value + 1))}
          >
            Next Split
          </button>
        ) : (
          <button type="button" onClick={() => onBack(drafts)}>
            Save Split Settings And Return
          </button>
        )}
      </div>

      {overrideKind === 'generation' ? (
        <ModelOverrideModal
          title="Local Generation Model"
          initialConfig={toUIModelConfig(currentDraft.generationModel, globalGenerationModel)}
          onSave={(config) => updateCurrentDraft({ generationModel: toModelPayload(config) })}
          onClose={() => setOverrideKind(null)}
        />
      ) : null}

      {overrideKind === 'teacher' ? (
        <ModelOverrideModal
          title="Local Teacher Model"
          initialConfig={toUIModelConfig(currentDraft.teacherModel, globalTeacherModel)}
          onSave={(config) => updateCurrentDraft({ teacherModel: toModelPayload(config) })}
          onClose={() => setOverrideKind(null)}
        />
      ) : null}
    </section>
  )
}

export { SplitConfigStepperPage }
