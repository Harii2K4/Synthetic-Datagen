import { useEffect, useMemo, useRef, useState } from 'react'
import { ModelConfigForm } from '../components/generate-datasets/ModelConfigForm'
import { PersonaSplitDropdown } from '../components/generate-datasets/PersonaSplitDropdown'
import { fetchPersonaSplits, generateDataset } from '../lib/api'
import { openRouterModels } from '../lib/openrouterModels'
import { SplitConfigStepperPage } from './SplitConfigStepperPage'
import type {
  DatasetGenerationMetricsPayload,
  DatasetGenerationRequestPayload,
  Domain,
  ModelConfigPayload,
  PersonaConfigEntry,
  PersonaSplitsChoicesPayload,
  SplitConfigCompletion,
  SplitConfigDraft,
} from '../types/datasetRequest'
import type { PersonaOption, UIModelConfig } from '../types/generation'

const DOMAIN_SPLITS: Domain[] = ['math', 'instruction', 'knowledge', 'reasoning', 'tool', 'npc']
const STORAGE_KEY = 'generate_datasets_saved_payload'
const STATS_STORAGE_KEY = 'generate_datasets_latest_stats'

const defaultGenerationConfig: UIModelConfig = {
  modelId: '',
  temperature: 0,
  reasoningEffort: 'none',
  reasoningSummary: 'auto',
  providerPriority: [],
  route: [],
}

const defaultTeacherConfig: UIModelConfig = {
  modelId: '',
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

function toUIModelConfig(config: ModelConfigPayload): UIModelConfig {
  return {
    modelId: config.modelId,
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort,
    reasoningSummary: config.reasoningSummary,
    providerPriority: config.providerPriority ?? [],
    route: config.route ?? [],
  }
}

function buildPersonaConfigFromDrafts(
  selectedSplits: string[],
  splitConfigDrafts: SplitConfigDraft[],
): PersonaConfigEntry[] {
  const fallbackConfigs = selectedSplits.filter(isDomainSplit).map((split) => {
    const splitConfig: PersonaSplitsChoicesPayload = {
      split,
      selectionMethod: 'sequence',
      selectionList: null,
      seed: 42,
      size: 0,
    }

    return { [split]: splitConfig }
  })

  if (splitConfigDrafts.length === 0) {
    return fallbackConfigs
  }

  return splitConfigDrafts.map((draft) => {
    const selectionListForPayload =
      draft.selectionMethod === 'selected'
        ? draft.selectionList
        : draft.selectionMethod === 'ranged'
          ? [draft.lowerLimit, draft.upperLimit]
          : null

    const splitConfig: PersonaSplitsChoicesPayload = {
      split: draft.split,
      selectionMethod: draft.selectionMethod,
      selectionList: selectionListForPayload,
      seed: draft.seed,
      size:
        draft.selectionMethod === 'ranged'
          ? Math.max(0, draft.upperLimit - draft.lowerLimit)
          : draft.selectionMethod === 'selected'
            ? draft.selectionList.length
            : draft.size,
      ...(draft.generationModel ? { generationModel: draft.generationModel } : {}),
      ...(draft.teacherModel ? { teacherModel: draft.teacherModel } : {}),
    }

    return {
      [draft.domain]: splitConfig,
    }
  })
}

function createJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `job-${Date.now()}`
}

function validateSplitDraft(draft: SplitConfigDraft): string | null {
  if (!draft.domain) {
    return 'Each split must have a domain.'
  }

  if (draft.selectionMethod === 'sequence' || draft.selectionMethod === 'random') {
    if (!Number.isFinite(draft.size) || draft.size <= 0) {
      return `Split "${draft.split}" requires a size greater than 0 for ${draft.selectionMethod} selection.`
    }
  }

  if (draft.selectionMethod === 'random' && !Number.isFinite(draft.seed)) {
    return `Split "${draft.split}" requires a valid seed for random selection.`
  }

  if (draft.selectionMethod === 'ranged') {
    if (!Number.isFinite(draft.lowerLimit) || !Number.isFinite(draft.upperLimit)) {
      return `Split "${draft.split}" needs both lower and upper limits.`
    }
    if (draft.lowerLimit < 0) {
      return `Split "${draft.split}" lower limit must be 0 or greater.`
    }
    if (draft.upperLimit <= draft.lowerLimit) {
      return `Split "${draft.split}" upper limit must be greater than lower limit.`
    }
  }

  if (draft.selectionMethod === 'selected') {
    if (draft.selectionList.length === 0) {
      return `Split "${draft.split}" requires at least one selected row index.`
    }
    if (draft.selectionList.some((index) => !Number.isInteger(index) || index < 0)) {
      return `Split "${draft.split}" has invalid selected row indexes.`
    }
  }

  if (draft.generationModel && !draft.generationModel.modelId.trim()) {
    return `Split "${draft.split}" generation model override must have a model ID.`
  }

  if (draft.teacherModel && !draft.teacherModel.modelId.trim()) {
    return `Split "${draft.split}" teacher model override must have a model ID.`
  }

  return null
}

function buildValidatedPayload(
  selectedPersonaSplits: string[],
  splitConfigDrafts: SplitConfigDraft[],
  datasetName: string,
  datasetSize: number,
  generationConfig: UIModelConfig,
  teacherConfig: UIModelConfig,
): { payload?: DatasetGenerationRequestPayload; error?: string } {
  if (!generationConfig.modelId.trim() || !teacherConfig.modelId.trim()) {
    return { error: 'Select both global generation and teacher model IDs.' }
  }

  if (selectedPersonaSplits.length === 0) {
    return { error: 'Select at least one persona split before saving.' }
  }

  if (splitConfigDrafts.length === 0) {
    return { error: 'Complete split settings before saving.' }
  }

  const relevantDrafts = splitConfigDrafts.filter((draft) => selectedPersonaSplits.includes(draft.split))
  if (relevantDrafts.length !== selectedPersonaSplits.length) {
    return { error: 'Some selected persona splits are not fully configured yet.' }
  }

  for (const draft of relevantDrafts) {
    const draftError = validateSplitDraft(draft)
    if (draftError) {
      return { error: draftError }
    }
  }

  if (!datasetName.trim()) {
    return { error: 'Provide a dataset name before saving.' }
  }

  if (!Number.isFinite(datasetSize) || datasetSize <= 0) {
    return { error: 'Dataset size must be greater than zero.' }
  }

  const personaConfig = buildPersonaConfigFromDrafts(selectedPersonaSplits, relevantDrafts)
  return {
    payload: {
      jobId: createJobId(),
      config: {
        personaConfig,
        datasetSize,
        generationModel: toModelPayload(generationConfig),
        teacherModel: toModelPayload(teacherConfig),
        datasetName: datasetName.trim(),
      },
    },
  }
}

function notifyGenerationComplete(stats: DatasetGenerationMetricsPayload): void {
  const title =
    stats.status === 'success'
      ? 'Dataset generation completed'
      : stats.status === 'partial'
        ? 'Dataset generation completed with partial results'
        : 'Dataset generation failed'
  const body = `${stats.rowsGenerated}/${stats.totalRowsRequested} rows generated.`
  const fallbackAlert = (message: string) => {
    if (typeof globalThis.alert === 'function') {
      globalThis.alert(message)
    }
  }

  if (typeof globalThis.Notification === 'undefined') {
    fallbackAlert(`${title}. ${body}`)
    return
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body })
    return
  }

  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body })
      } else {
        fallbackAlert(`${title}. ${body}`)
      }
    })
    return
  }

  fallbackAlert(`${title}. ${body}`)
}

function GenerateDatasetsPage() {
  const isMountedRef = useRef(true)
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([])
  const [selectedPersonaSplits, setSelectedPersonaSplits] = useState<string[]>([])
  const [isPersonaLoading, setIsPersonaLoading] = useState(true)
  const [generationConfig, setGenerationConfig] = useState<UIModelConfig>(defaultGenerationConfig)
  const [teacherConfig, setTeacherConfig] = useState<UIModelConfig>(defaultTeacherConfig)
  const [splitConfigDrafts, setSplitConfigDrafts] = useState<SplitConfigDraft[]>([])
  const [datasetName, setDatasetName] = useState('')
  const [datasetSize, setDatasetSize] = useState(0)
  const [isSplitConfigView, setIsSplitConfigView] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [savedRequestPayload, setSavedRequestPayload] = useState<DatasetGenerationRequestPayload | null>(
    null,
  )
  const [isGeneratingDataset, setIsGeneratingDataset] = useState(false)
  const [generationStats, setGenerationStats] = useState<DatasetGenerationMetricsPayload | null>(null)

  useEffect(() => {
    isMountedRef.current = true

    const loadPersonaSplits = async () => {
      const options = await fetchPersonaSplits()
      if (isMountedRef.current) {
        setPersonaOptions(options)
        setIsPersonaLoading(false)
      }
    }

    void loadPersonaSplits()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY)
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as {
          selectedPersonaSplits?: string[]
          splitConfigDrafts?: SplitConfigDraft[]
          requestPayload?: DatasetGenerationRequestPayload
        }

        if (parsed.requestPayload) {
          const { requestPayload } = parsed
          setSelectedPersonaSplits(parsed.selectedPersonaSplits ?? [])
          setSplitConfigDrafts(parsed.splitConfigDrafts ?? [])
          setDatasetName(requestPayload.config.datasetName)
          setDatasetSize(requestPayload.config.datasetSize)
          setGenerationConfig(toUIModelConfig(requestPayload.config.generationModel))
          setTeacherConfig(toUIModelConfig(requestPayload.config.teacherModel))
          setSavedRequestPayload(requestPayload)
          setSaveMessage('Loaded saved configuration.')
        }
      } catch {
        setSaveMessage('Saved configuration could not be loaded. Save again to continue.')
      }
    }

    const savedStats = localStorage.getItem(STATS_STORAGE_KEY)
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats) as { stats?: DatasetGenerationMetricsPayload }
        if (parsed.stats) {
          setGenerationStats(parsed.stats)
        }
      } catch {
        // Ignore invalid stats cache.
      }
    }
  }, [])

  const selectedLabels = useMemo(
    () =>
      personaOptions
        .filter((option) => selectedPersonaSplits.includes(option.id))
        .map((option) => option.label),
    [personaOptions, selectedPersonaSplits],
  )

  const togglePersonaSplit = (id: string) => {
    setSavedRequestPayload(null)
    setSelectedPersonaSplits((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const handleOpenSplitConfig = () => {
    if (!generationConfig.modelId.trim() || !teacherConfig.modelId.trim()) {
      setSaveMessage('Select both global generation and teacher model IDs before configuring split settings.')
      return
    }

    if (selectedPersonaSplits.length === 0) {
      setSaveMessage('Select at least one persona split before configuring split settings.')
      return
    }

    setSaveMessage('')
    setIsSplitConfigView(true)
  }

  const handleSaveSelections = () => {
    const validation = buildValidatedPayload(
      selectedPersonaSplits,
      splitConfigDrafts,
      datasetName,
      datasetSize,
      generationConfig,
      teacherConfig,
    )

    if (validation.error || !validation.payload) {
      setSaveMessage(validation.error ?? 'Invalid dataset configuration.')
      return
    }

    const requestPayload = validation.payload
    const nonDomainSplits = selectedPersonaSplits.filter((split) => !isDomainSplit(split))

    const savedDraft = {
      savedAt: new Date().toISOString(),
      selectedPersonaSplits,
      splitConfigDrafts,
      nonDomainSplits,
      requestPayload,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDraft))
    setSavedRequestPayload(requestPayload)
    setSaveMessage('Saved successfully. You can now generate the dataset.')
  }

  const handleGenerateDataset = () => {
    if (!savedRequestPayload) {
      setSaveMessage('Save selections before generating the dataset.')
      return
    }

    setIsGeneratingDataset(true)
    setSaveMessage('Dataset generation started. You can continue using the app.')

    const requestPayload: DatasetGenerationRequestPayload = {
      ...savedRequestPayload,
      jobId: createJobId(),
    }

    const runGeneration = async () => {
      try {
        const stats = await generateDataset(requestPayload)
        localStorage.setItem(
          STATS_STORAGE_KEY,
          JSON.stringify({
            completedAt: new Date().toISOString(),
            stats,
          }),
        )

        notifyGenerationComplete(stats)

        if (isMountedRef.current) {
          setGenerationStats(stats)
          setSaveMessage(`Dataset generation finished with status: ${stats.status}.`)
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Dataset generation failed. Check server logs.'
        if (isMountedRef.current) {
          setSaveMessage(message)
        }
      } finally {
        if (isMountedRef.current) {
          setIsGeneratingDataset(false)
        }
      }
    }

    void runGeneration()
  }

  const handleClearSelections = () => {
    const confirmed = window.confirm(
      'Clearing will remove selected splits, model choices, split settings, saved configuration, and cached generation stats. Any running generation request on the server will continue. Do you want to proceed?',
    )

    if (!confirmed) {
      return
    }

    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STATS_STORAGE_KEY)
    setSelectedPersonaSplits([])
    setGenerationConfig(defaultGenerationConfig)
    setTeacherConfig(defaultTeacherConfig)
    setSplitConfigDrafts([])
    setDatasetName('')
    setDatasetSize(0)
    setSavedRequestPayload(null)
    setGenerationStats(null)
    setSaveMessage('Selections cleared.')
  }

  if (isSplitConfigView) {
    return (
      <SplitConfigStepperPage
        selectedSplits={selectedPersonaSplits}
        globalGenerationModel={generationConfig}
        globalTeacherModel={teacherConfig}
        initialConfigs={splitConfigDrafts}
        initialDatasetName={datasetName}
        onCancel={(configs) => {
          setSavedRequestPayload(null)
          setSplitConfigDrafts(configs)
          setIsSplitConfigView(false)
        }}
        onComplete={(result: SplitConfigCompletion) => {
          setSavedRequestPayload(null)
          setSplitConfigDrafts(result.splitConfigDrafts)
          setDatasetName(result.datasetName)
          setDatasetSize(result.datasetSize)
          setIsSplitConfigView(false)
          setSaveMessage('Split settings completed. You can now save selections.')
        }}
      />
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
            onChange={(nextConfig) => {
              setSavedRequestPayload(null)
              setGenerationConfig(nextConfig)
            }}
          />
          <ModelConfigForm
            title="Teacher Model"
            config={teacherConfig}
            models={openRouterModels}
            onChange={(nextConfig) => {
              setSavedRequestPayload(null)
              setTeacherConfig(nextConfig)
            }}
          />
        </div>
      </section>

      <section className="generate-section">
        <h3>3) Dataset Summary</h3>
        <p className="muted-text">Dataset name: {datasetName || 'Not set'}</p>
        <p className="muted-text">Dataset size: {datasetSize}</p>
      </section>

      <div className="generate-save-row">
        <button type="button" onClick={handleOpenSplitConfig}>
          Configure Split Settings
        </button>
        <button type="button" onClick={handleSaveSelections}>
          Save Selections
        </button>
        <button
          type="button"
          onClick={handleGenerateDataset}
          disabled={!savedRequestPayload || isGeneratingDataset}
        >
          {isGeneratingDataset ? 'Generating...' : 'Generate Dataset'}
        </button>
        <button type="button" className="secondary-button" onClick={handleClearSelections}>
          Clear Settings
        </button>
        {saveMessage ? <p className="save-status">{saveMessage}</p> : null}
      </div>

      {generationStats ? (
        <section className="generate-section">
          <h3>4) Latest Generation Stats</h3>
          <p className="muted-text">Job ID: {generationStats.jobId}</p>
          <p className="muted-text">Status: {generationStats.status}</p>
          <p className="muted-text">
            Splits: {generationStats.successfulSplits} success / {generationStats.failedSplits} failed /{' '}
            {generationStats.totalSplits} total
          </p>
          <p className="muted-text">
            Rows: {generationStats.rowsGenerated} generated / {generationStats.rowsFailed} failed /{' '}
            {generationStats.totalRowsRequested} requested
          </p>
          <p className="muted-text">Saved at: {generationStats.datasetSaveLocation}</p>
          {generationStats.errors.length > 0 ? (
            <div className="stats-errors">
              {generationStats.errors.map((error, index) => (
                <p key={`${error.split}-${error.stage}-${index}`} className="validation-error">
                  {error.split} [{error.stage}] {error.errorType}: {error.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="muted-text">No split-level errors reported.</p>
          )}
        </section>
      ) : null}
    </section>
  )
}

export { GenerateDatasetsPage }
