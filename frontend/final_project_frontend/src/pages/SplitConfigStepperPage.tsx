import { useEffect, useMemo, useRef, useState } from 'react'
import { ModelConfigForm } from '../components/generate-datasets/ModelConfigForm'
import { fetchPersonaRowCount } from '../lib/api'
import { openRouterModels } from '../lib/openrouterModels'
import type {
  Domain,
  ModelConfigPayload,
  PersonaSplit,
  SelectionMethod,
  SplitConfigCompletion,
  SplitConfigDraft,
} from '../types/datasetRequest'
import type { UIModelConfig } from '../types/generation'

type SplitConfigStepperPageProps = {
  selectedSplits: string[]
  globalGenerationModel: UIModelConfig
  globalTeacherModel: UIModelConfig
  initialConfigs: SplitConfigDraft[]
  initialDatasetName: string
  onCancel: (configs: SplitConfigDraft[]) => void
  onComplete: (result: SplitConfigCompletion) => void
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

function parseSelectionList(input: string): number[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value >= 0)
}

function parseNonNegativeIntInput(input: string): number | null {
  if (!/^\d*$/.test(input)) {
    return null
  }

  if (input === '') {
    return 0
  }

  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : null
}

function getSplitSize(draft: SplitConfigDraft): number {
  if (draft.selectionMethod === 'selected') {
    return draft.selectionList.length
  }
  if (draft.selectionMethod === 'ranged') {
    return Math.max(0, draft.upperLimit - draft.lowerLimit)
  }
  return Math.max(0, draft.size)
}

function validateSplitDraft(draft: SplitConfigDraft): string | null {
  if (!draft.domain) {
    return 'Choose a domain for the split.'
  }

  if (draft.selectionMethod === 'sequence' || draft.selectionMethod === 'random') {
    if (!Number.isFinite(draft.size) || draft.size <= 0) {
      return 'Size must be greater than 0 for sequence/random selection.'
    }
    if (draft.rowCount !== null && draft.size > draft.rowCount) {
      return `Size cannot exceed available rows (${draft.rowCount}).`
    }
  }

  if (draft.selectionMethod === 'random') {
    if (!Number.isFinite(draft.seed)) {
      return 'Seed is required for random selection.'
    }
  }

  if (draft.selectionMethod === 'ranged') {
    if (!Number.isFinite(draft.lowerLimit) || !Number.isFinite(draft.upperLimit)) {
      return 'Lower and upper limits are required for ranged selection.'
    }
    if (draft.lowerLimit < 0) {
      return 'Lower limit must be 0 or greater.'
    }
    if (draft.upperLimit <= draft.lowerLimit) {
      return 'Upper limit must be greater than lower limit.'
    }
    if (draft.rowCount !== null && draft.upperLimit > draft.rowCount) {
      return `Upper limit cannot exceed available rows (${draft.rowCount}).`
    }
  }

  if (draft.selectionMethod === 'selected') {
    if (draft.selectionList.length === 0) {
      return 'Provide at least one selected row index.'
    }
    if (draft.rowCount !== null && Math.max(...draft.selectionList) >= draft.rowCount) {
      return `Selected row indexes must be less than ${draft.rowCount}.`
    }
  }

  if (draft.generationModel && !draft.generationModel.modelId.trim()) {
    return 'Local generation model override must have a model ID.'
  }
  if (draft.teacherModel && !draft.teacherModel.modelId.trim()) {
    return 'Local teacher model override must have a model ID.'
  }

  return null
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
        <ModelConfigForm
          title="Model Override"
          config={draft}
          models={openRouterModels}
          onChange={setDraft}
        />
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
  initialDatasetName,
  onCancel,
  onComplete,
}: SplitConfigStepperPageProps) {
  const validSelectedSplits = useMemo(() => selectedSplits.filter(isPersonaSplit), [selectedSplits])

  const [drafts, setDrafts] = useState<SplitConfigDraft[]>(() =>
    getConfiguredDrafts(validSelectedSplits, initialConfigs),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [overrideKind, setOverrideKind] = useState<OverrideKind>(null)
  const [stepError, setStepError] = useState('')
  const [isSummaryView, setIsSummaryView] = useState(false)
  const [datasetName, setDatasetName] = useState(initialDatasetName)
  const [summaryError, setSummaryError] = useState('')
  const requestedSplitsRef = useRef<Set<PersonaSplit>>(new Set())

  useEffect(() => {
    setDrafts(getConfiguredDrafts(validSelectedSplits, initialConfigs))
    setCurrentIndex(0)
    setStepError('')
    setIsSummaryView(false)
    setSummaryError('')
    setDatasetName(initialDatasetName)
    requestedSplitsRef.current = new Set()
  }, [validSelectedSplits, initialConfigs, initialDatasetName])

  useEffect(() => {
    const pendingSplits = drafts
      .filter((draft) => draft.rowCount === null)
      .filter((draft) => !requestedSplitsRef.current.has(draft.split))

    if (pendingSplits.length === 0) {
      return
    }

    pendingSplits.forEach((draft) => requestedSplitsRef.current.add(draft.split))

    let isCancelled = false

    const loadRows = async () => {
      const results = await Promise.all(
        pendingSplits.map(async (draft) => ({
          split: draft.split,
          rowCount: await fetchPersonaRowCount(draft.split),
        })),
      )

      if (isCancelled) {
        return
      }

      const resultMap = new Map(results.map((item) => [item.split, item.rowCount]))

      setDrafts((previous) =>
        previous.map((draft) => {
          if (!resultMap.has(draft.split)) {
            return draft
          }

          const rowCount = resultMap.get(draft.split) ?? null
          return {
            ...draft,
            rowCount,
            upperLimit: rowCount !== null && draft.upperLimit === 0 ? rowCount : draft.upperLimit,
          }
        }),
      )
    }

    void loadRows()

    return () => {
      isCancelled = true
    }
  }, [drafts])

  const currentDraft = drafts[currentIndex]

  const updateCurrentDraft = (updates: Partial<SplitConfigDraft>) => {
    setStepError('')
    setDrafts((previous) =>
      previous.map((draft, index) => (index === currentIndex ? { ...draft, ...updates } : draft)),
    )
  }

  const datasetSize = useMemo(() => drafts.reduce((sum, draft) => sum + getSplitSize(draft), 0), [drafts])

  if (validSelectedSplits.length === 0 || !currentDraft) {
    return (
      <section className="generate-page">
        <h2>Split Settings</h2>
        <p className="muted-text">No splits selected. Go back and select at least one split.</p>
        <button type="button" onClick={() => onCancel(initialConfigs)}>
          Back To Generate Datasets
        </button>
      </section>
    )
  }

  if (isSummaryView) {
    return (
      <section className="generate-page">
        <div className="split-header-row">
          <h2>Split Settings Summary</h2>
          <button type="button" onClick={() => onCancel(drafts)}>
            Back To Generate Datasets
          </button>
        </div>

        <section className="generate-section">
          <h3>Configured Splits</h3>
          <div className="summary-list">
            {drafts.map((draft) => (
              <div key={draft.split} className="summary-card">
                <p><strong>Split:</strong> {draft.split}</p>
                <p><strong>Domain:</strong> {draft.domain}</p>
                <p><strong>Selection:</strong> {draft.selectionMethod}</p>
                <p><strong>Local Size:</strong> {getSplitSize(draft)}</p>
                {draft.selectionMethod === 'random' ? <p><strong>Seed:</strong> {draft.seed}</p> : null}
                {draft.selectionMethod === 'ranged' ? (
                  <p><strong>Range:</strong> {draft.lowerLimit} to {draft.upperLimit}</p>
                ) : null}
                {draft.selectionMethod === 'selected' ? (
                  <p><strong>Selected Rows:</strong> {draft.selectionList.join(', ')}</p>
                ) : null}
                <p>
                  <strong>Local Generation Model:</strong>{' '}
                  {draft.generationModel?.modelId ?? 'Using global'}
                </p>
                <p>
                  <strong>Local Teacher Model:</strong>{' '}
                  {draft.teacherModel?.modelId ?? 'Using global'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="generate-section">
          <h3>Dataset Details</h3>
          <label>
            <span className="field-label">Dataset Name</span>
            <input
              type="text"
              value={datasetName}
              onChange={(event) => {
                setDatasetName(event.target.value)
                setSummaryError('')
              }}
            />
          </label>
          <p className="muted-text">Dataset size (sum of split sizes): {datasetSize}</p>
          {summaryError ? <p className="validation-error">{summaryError}</p> : null}
        </section>

        <div className="split-nav-row">
          <button type="button" onClick={() => setIsSummaryView(false)}>
            Back To Split Editing
          </button>
          <button
            type="button"
            onClick={() => {
              if (!datasetName.trim()) {
                setSummaryError('Dataset name is required.')
                return
              }
              if (datasetSize <= 0) {
                setSummaryError('Dataset size must be greater than zero.')
                return
              }

              onComplete({
                splitConfigDrafts: drafts,
                datasetName: datasetName.trim(),
                datasetSize,
              })
            }}
          >
            Confirm Summary And Return
          </button>
        </div>
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
        <button type="button" onClick={() => onCancel(drafts)}>
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
                type="text"
                inputMode="numeric"
                value={String(currentDraft.size)}
                onChange={(event) => {
                  const nextValue = parseNonNegativeIntInput(event.target.value)
                  if (nextValue === null) {
                    return
                  }
                  updateCurrentDraft({ size: nextValue })
                }}
              />
            </label>
          ) : null}

          {selectionMethod === 'random' ? (
            <label>
              <span className="field-label">Seed</span>
              <input
                type="text"
                inputMode="numeric"
                value={String(currentDraft.seed)}
                onChange={(event) => {
                  const nextValue = parseNonNegativeIntInput(event.target.value)
                  if (nextValue === null) {
                    return
                  }
                  updateCurrentDraft({ seed: nextValue })
                }}
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

          {selectionMethod === 'selected' ? (
            <label>
              <span className="field-label">Selection List (comma-separated row indexes)</span>
              <input
                type="text"
                value={currentDraft.selectionList.join(', ')}
                onChange={(event) =>
                  updateCurrentDraft({ selectionList: parseSelectionList(event.target.value) })
                }
                placeholder="e.g. 0, 4, 10"
              />
            </label>
          ) : null}
        </div>

        <p className="muted-text">
          Total rows in split:{' '}
          {currentDraft.rowCount !== null ? currentDraft.rowCount : 'Loading or unavailable'}
        </p>
        {stepError ? <p className="validation-error">{stepError}</p> : null}
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
          Generation model:{' '}
          {currentDraft.generationModel ? currentDraft.generationModel.modelId : 'Using global'}
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
          onClick={() => {
            setStepError('')
            setCurrentIndex((value) => Math.max(0, value - 1))
          }}
          disabled={currentIndex === 0}
        >
          Previous Split
        </button>

        {currentIndex < drafts.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              const validationError = validateSplitDraft(currentDraft)
              if (validationError) {
                setStepError(validationError)
                return
              }
              setStepError('')
              setCurrentIndex((value) => Math.min(drafts.length - 1, value + 1))
            }}
          >
            Next Split
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const validationError = validateSplitDraft(currentDraft)
              if (validationError) {
                setStepError(validationError)
                return
              }

              const firstInvalid = drafts.map(validateSplitDraft).find((message) => message !== null)
              if (firstInvalid) {
                setStepError(firstInvalid)
                return
              }

              setStepError('')
              setIsSummaryView(true)
            }}
          >
            Review Summary
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
