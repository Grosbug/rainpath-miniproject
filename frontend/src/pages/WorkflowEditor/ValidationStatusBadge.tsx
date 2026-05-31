import { useState, useRef, useEffect } from 'react'
import { Icon } from '@/components/Icon'
import { useEditorStore } from './store'
import { friendlyValidationMessage } from './validation-messages'
import { formatNodeLabel } from './format-node-label'
import type { ValidationError } from './store'
import type { GraphNode } from './snapshot'

/** Build the final user-facing string for a validation entry: optional node label prefix +
 *  friendly translation. `incomplete_status_coverage` uses the raw message instead of the
 *  generic friendly one because the raw already enumerates the missing statuses. */
function formatEntry(e: ValidationError, nodes: ReadonlyArray<GraphNode>): string {
  const label = formatNodeLabel(e.nodeId, nodes)
  const useRaw = e.code === 'incomplete_status_coverage' || e.code === 'status_not_in_channel'
  const body = useRaw ? e.message : friendlyValidationMessage(e.code, e.message)
  return label ? `${label} — ${body}` : body
}

/**
 * Live validity indicator for the editor's top bar — sits next to the SaveStatusBadge.
 * Shows three states:
 *   • valid   → green check, "Workflow valide", click opens a confirmation tooltip
 *   • invalid → red triangle with the error count, click opens a list of friendly
 *     error messages so the user can jump to each
 *   • warning → amber circle when only warnings exist (incomplete coverage,
 *     unreachable nodes, …) — workflow is still usable but worth attention.
 *
 * The detailed list is rendered inline as a popover anchored under the badge so the
 * top bar stays compact at rest and the user opts into the noise.
 */
export function ValidationStatusBadge() {
  const errors = useEditorStore(s => s.validationErrors)
  const warnings = useEditorStore(s => s.validationWarnings)
  const nodes = useEditorStore(s => s.nodes)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', onClick))
    document.addEventListener('keydown', onEsc)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0

  let tone: 'success' | 'danger' | 'warning' = 'success'
  let icon: 'CircleCheck' | 'CircleAlert' | 'TriangleAlert' = 'CircleCheck'
  let label = 'Workflow valide'
  if (hasErrors) {
    tone = 'danger'
    icon = 'CircleAlert'
    label = `${errors.length} erreur${errors.length > 1 ? 's' : ''}`
  } else if (hasWarnings) {
    tone = 'warning'
    icon = 'TriangleAlert'
    label = `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}`
  }

  const toneClass = {
    success: 'border-success/40 bg-[#DCFCE7] text-success hover:bg-[#BBF7D0]',
    danger:  'border-danger/40 bg-[#FEF2F2] text-danger hover:bg-[#FECACA]',
    warning: 'border-warning/40 bg-[#FFFBEB] text-warning hover:bg-[#FDE68A]'
  }[tone]

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`État du workflow : ${label}. Cliquer pour ${open ? 'fermer' : 'voir le détail'}.`}
        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-colors ${toneClass}`}
      >
        <Icon name={icon} size={16} />
        <span>{label}</span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className='opacity-70' />
      </button>

      {open ? (
        <div
          role='dialog'
          aria-label="Détail de l'état du workflow"
          className='absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-md border border-border bg-surface p-3 shadow-elev-2'
        >
          {!hasErrors && !hasWarnings ? (
            <div className='space-y-2 text-xs'>
              <p className='flex items-center gap-2 font-medium text-success'>
                <Icon name='CircleCheck' size={16} />
                Workflow valide
              </p>
              <p className='text-fg-muted'>
                Tous les contrôles sont passés : structure (Départ unique, au moins une Fin atteignable),
                cohérence des handles, et configuration des sorties. Le workflow peut être utilisé pour
                démarrer un parcours patient.
              </p>
            </div>
          ) : (
            <div className='space-y-3 text-xs'>
              {hasErrors ? (
                <section>
                  <p className='mb-1 flex items-center gap-2 font-semibold text-danger'>
                    <Icon name='CircleAlert' size={16} />
                    Erreurs ({errors.length})
                  </p>
                  <p className='mb-2 text-fg-muted'>
                    Tant qu'au moins une erreur subsiste, le workflow ne peut pas démarrer de parcours patient.
                  </p>
                  <ul className='space-y-1'>
                    {errors.map((e, ix) => (
                      <li key={`e-${ix}`} className='flex items-start gap-2 rounded border border-danger/30 bg-[#FEF2F2] p-2'>
                        <Icon name='CircleAlert' size={16} className='mt-0.5 shrink-0 text-danger' />
                        <span className='text-fg'>
                          <span className='font-mono text-[10px] text-fg-muted'>[{e.code}]</span>{' '}
                          {formatEntry(e, nodes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {hasWarnings ? (
                <section>
                  <p className='mb-1 flex items-center gap-2 font-semibold text-warning'>
                    <Icon name='TriangleAlert' size={16} />
                    Avertissements ({warnings.length})
                  </p>
                  <p className='mb-2 text-fg-muted'>
                    Le workflow reste utilisable, mais des cas peuvent rester non couverts à l'exécution.
                  </p>
                  <ul className='space-y-1'>
                    {warnings.map((w, ix) => (
                      <li key={`w-${ix}`} className='flex items-start gap-2 rounded border border-warning/30 bg-[#FFFBEB] p-2'>
                        <Icon name='TriangleAlert' size={16} className='mt-0.5 shrink-0 text-warning' />
                        <span className='text-fg'>
                          <span className='font-mono text-[10px] text-fg-muted'>[{w.code}]</span>{' '}
                          {formatEntry(w, nodes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
