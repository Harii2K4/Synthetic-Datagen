import { useMemo, useState } from 'react'
import type { PersonaOption } from '../../types/generation'

type PersonaSplitDropdownProps = {
  options: PersonaOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
  loading: boolean
}

function PersonaSplitDropdown({ options, selectedIds, onToggle, loading }: PersonaSplitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds])

  return (
    <div className="multi-select">
      <button
        type="button"
        className="multi-select-trigger"
        onClick={() => setIsOpen((value) => !value)}
      >
        {loading ? 'Loading persona splits...' : `Select Persona Splits (${selectedCount})`}
      </button>

      {isOpen ? (
        <div className="multi-select-menu" role="listbox" aria-multiselectable="true">
          {options.map((option) => (
            <label key={option.id} className="multi-select-option">
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { PersonaSplitDropdown }
