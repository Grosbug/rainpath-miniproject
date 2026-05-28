import { Link, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { IconButton } from '@/components/ui/IconButton'
import { relativeFromNow } from '@/lib/format-date'
import type { WorkflowSummary } from '@/api/workflows'

interface Props {
  rows: WorkflowSummary[]
  onDuplicate: (id: string) => void
  onExport: (id: string) => void
  onDelete: (row: WorkflowSummary) => void
}

export function WorkflowsTable({ rows, onDuplicate, onExport, onDelete }: Props) {
  const navigate = useNavigate()
  return (
    <div className='overflow-hidden rounded-lg border border-border bg-surface'>
      <table className='w-full text-sm'>
        <thead className='bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted'>
          <tr>
            <th className='px-4 py-3'>Nom</th>
            <th className='px-4 py-3'>Description</th>
            <th className='px-4 py-3 text-right'>Modifié</th>
            <th className='w-10 px-2 py-3' aria-label='Actions' />
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {rows.map(r => (
            <tr key={r.id} className='hover:bg-surface-muted'>
              <td className='px-4 py-3'>
                <Link
                  to={`/workflows/${r.id}`}
                  className='font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline'
                >
                  {r.name}
                </Link>
              </td>
              <td className='px-4 py-3 text-fg-muted'>
                <span className='line-clamp-1'>{r.description ?? '—'}</span>
              </td>
              <td className='px-4 py-3 text-right text-fg-muted tabular-nums'>
                {relativeFromNow(r.updatedAt)}
              </td>
              <td className='px-2 py-2 text-right'>
                <DropdownMenu>
                  <DropdownTrigger asChild>
                    <IconButton icon='EllipsisVertical' aria-label={`Actions sur ${r.name}`} />
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem icon='Pencil' onSelect={() => navigate(`/workflows/${r.id}`)}>Ouvrir l’éditeur</DropdownItem>
                    <DropdownItem icon='Play' onSelect={() => navigate(`/workflows/${r.id}/patient-runs`)}>Voir les parcours patients</DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon='Copy' onSelect={() => onDuplicate(r.id)}>Dupliquer</DropdownItem>
                    <DropdownItem icon='Download' onSelect={() => onExport(r.id)}>Exporter en JSON</DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon='Trash2' danger onSelect={() => onDelete(r)}>Supprimer</DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
