import { Link, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { relativeFromNow } from '@/lib/format-date'
import type { WorkflowSummary } from '@/api/workflows'

function ValidityBadge({ isValid }: { isValid: boolean | undefined }) {
  // Undefined means the backend didn't compute it (older response / cache miss) — show
  // a neutral "—" rather than guessing. Once the new endpoint has been hit once the
  // cached row carries the flag.
  if (isValid === undefined) {
    return <span className='text-xs text-fg-subtle'>—</span>
  }
  if (isValid) {
    return (
      <span
        className='inline-flex items-center gap-1 rounded-full border border-success/30 bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-medium text-success'
        title='Workflow valide — utilisable pour démarrer un parcours patient'
      >
        <Icon name='CircleCheck' size={16} />
        Valide
      </span>
    )
  }
  return (
    <span
      className='inline-flex items-center gap-1 rounded-full border border-danger/30 bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-danger'
      title='Workflow invalide — corriger les erreurs avant de démarrer un parcours'
    >
      <Icon name='CircleAlert' size={16} />
      Invalide
    </span>
  )
}

interface Props {
  rows: WorkflowSummary[]
  onDuplicate: (id: string) => void
  onDelete: (row: WorkflowSummary) => void
}

export function WorkflowsTable({ rows, onDuplicate, onDelete }: Props) {
  const navigate = useNavigate()
  return (
    <div className='overflow-hidden rounded-lg border border-border bg-surface'>
      {/*
        Explicit `<colgroup>` so the browser doesn't redistribute widths based on cell content
        (the relative-time string "il y a moins d'une minute" was forcing a two-line wrap inside
        the previous w-32 / 8rem `Modifié` cell). Fixed widths on État, Modifié and Actions;
        Nom takes a hard 28% and Description absorbs the remainder.
      */}
      <table className='w-full table-fixed text-sm'>
        <colgroup>
          <col style={{ width: '28%' }} />
          <col />
          <col style={{ width: '7rem' }} />
          <col style={{ width: '11rem' }} />
          <col style={{ width: '6rem' }} />
        </colgroup>
        <thead className='bg-surface-muted text-xs font-medium uppercase tracking-wide text-fg-muted'>
          <tr>
            <th className='whitespace-nowrap px-4 py-3 text-left'>Nom</th>
            <th className='whitespace-nowrap px-4 py-3 text-left'>Description</th>
            <th className='whitespace-nowrap px-4 py-3 text-center'>État</th>
            <th className='whitespace-nowrap px-4 py-3 text-left tabular-nums'>Modifié</th>
            <th className='px-2 py-3' aria-label='Actions' />
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {rows.map(r => (
            <tr
              key={r.id}
              onClick={() => navigate(`/workflows/${r.id}`)}
              role='button'
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/workflows/${r.id}`)
                }
              }}
              aria-label={`Ouvrir le workflow ${r.name}`}
              className='cursor-pointer hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none'
            >
              <td className='truncate px-4 py-3'>
                <Link
                  to={`/workflows/${r.id}`}
                  onClick={e => e.stopPropagation()}
                  title={r.name}
                  className='font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline'
                >
                  {r.name}
                </Link>
              </td>
              <td className='px-4 py-3 text-fg-muted'>
                <span className='line-clamp-1' title={r.description ?? undefined}>{r.description ?? '—'}</span>
              </td>
              <td className='px-4 py-3 text-center'>
                <ValidityBadge isValid={r.isValid} />
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-left text-fg-muted tabular-nums'>
                {relativeFromNow(r.updatedAt)}
              </td>
              {/* Action buttons live in a cell that swallows clicks so the row's onClick
                  doesn't fire when the user interacts with the menu or the Play button. */}
              <td className='px-2 py-2 text-right' onClick={e => e.stopPropagation()}>
                <div className='inline-flex items-center gap-1'>
                  <IconButton
                    icon='Play'
                    aria-label={`Voir les parcours patients de ${r.name}`}
                    data-rp-tooltip='Voir les parcours patients'
                    onClick={() => navigate(`/workflows/${r.id}/patient-runs`)}
                  />
                  <DropdownMenu>
                    <DropdownTrigger asChild>
                      <IconButton icon='EllipsisVertical' aria-label={`Actions sur ${r.name}`} />
                    </DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem icon='Pencil' onSelect={() => navigate(`/workflows/${r.id}`)}>Ouvrir l’éditeur</DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem icon='Copy' onSelect={() => onDuplicate(r.id)}>Dupliquer</DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem icon='Trash2' danger onSelect={() => onDelete(r)}>Supprimer</DropdownItem>
                    </DropdownContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
