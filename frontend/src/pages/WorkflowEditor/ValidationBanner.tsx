import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { useEditorStore } from './store'
import { friendlyValidationMessage } from './validation-messages'

const AUTO_COLLAPSE_MS = 6000

export function ValidationBanner() {
  const errors = useEditorStore(s => s.validationErrors)
  const warnings = useEditorStore(s => s.validationWarnings)
  const [collapsed, setCollapsed] = useState(false)

  // Reset the auto-collapse timer whenever errors/warnings change so a fresh
  // issue re-expands and stays visible for the full window. We deliberately
  // do NOT clear errors from the store — just hide the list visually.
  useEffect(() => {
    if (errors.length + warnings.length === 0) return
    setCollapsed(false)
    const t = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS)
    return () => clearTimeout(t)
  }, [errors, warnings])

  const total = errors.length + warnings.length
  if (total === 0) return null

  const hasErrors = errors.length > 0
  const bg = hasErrors ? 'bg-[#FEF2F2]' : 'bg-[#FFFBEB]'
  const borderTone = hasErrors ? 'border-danger' : 'border-warning'

  return (
    <div
      role="region"
      aria-label="Validation du workflow"
      className={`absolute bottom-0 left-0 right-0 max-h-[25vh] overflow-y-auto border-t-2 ${borderTone} ${bg}`}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg" aria-live="polite">
          <Icon name="CircleAlert" size={16} className={hasErrors ? 'text-danger' : 'text-warning'} />
          <span>
            {errors.length > 0
              ? `${errors.length} erreur${errors.length > 1 ? 's' : ''}`
              : null}
            {errors.length > 0 && warnings.length > 0 ? ' · ' : null}
            {warnings.length > 0
              ? `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}`
              : null}
          </span>
        </div>
        <IconButton
          icon={collapsed ? 'ChevronDown' : 'ChevronUp'}
          aria-label={collapsed ? 'Développer la bannière' : 'Réduire la bannière'}
          size="sm"
          onClick={() => setCollapsed(c => !c)}
        />
      </div>
      {collapsed ? null : (
        <ul className="space-y-1 px-4 pb-3 text-sm">
          {errors.map((e, i) => (
            <li key={`e-${i}`} className="flex items-start gap-2 text-danger">
              <Icon name="CircleAlert" size={16} />
              <span>{friendlyValidationMessage(e.code, e.message)}</span>
            </li>
          ))}
          {warnings.map((w, i) => (
            <li key={`w-${i}`} className="flex items-start gap-2 text-warning">
              <Icon name="TriangleAlert" size={16} />
              <span>{friendlyValidationMessage(w.code, w.message)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
