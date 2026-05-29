import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { queryKeys } from '@/api/query-keys'
import {
  deleteWorkflow,
  duplicateWorkflow,
  listWorkflows,
  type WorkflowSummary
} from '@/api/workflows'
import { WorkflowsTable } from './WorkflowsTable'
import { CreateWorkflowDialog } from './CreateWorkflowDialog'
import { DeleteWorkflowConfirm } from './DeleteWorkflowConfirm'

type SortBy =
  | 'name-asc' | 'name-desc'
  | 'updated-desc' | 'updated-asc'
  | 'valid-first' | 'invalid-first'

const SORT_LABEL: Record<SortBy, string> = {
  'name-asc':       'Nom (A → Z)',
  'name-desc':      'Nom (Z → A)',
  'updated-desc':   'Modifié — récent d\'abord',
  'updated-asc':    'Modifié — ancien d\'abord',
  'valid-first':    'Valide d\'abord',
  'invalid-first':  'Invalide d\'abord'
}

type ValidityFilter = 'all' | 'valid' | 'invalid'

const cmp = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' })

function sortFn(by: SortBy): (a: WorkflowSummary, b: WorkflowSummary) => number {
  switch (by) {
    case 'name-asc':      return (a, b) => cmp(a.name, b.name)
    case 'name-desc':     return (a, b) => cmp(b.name, a.name)
    case 'updated-desc':  return (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    case 'updated-asc':   return (a, b) => a.updatedAt.localeCompare(b.updatedAt)
    // Undefined isValid sorts to the end either way (treat as neither valid nor invalid).
    case 'valid-first':   return (a, b) => Number(b.isValid === true) - Number(a.isValid === true) || cmp(a.name, b.name)
    case 'invalid-first': return (a, b) => Number(b.isValid === false) - Number(a.isValid === false) || cmp(a.name, b.name)
  }
}

const DEFAULT_SORT: SortBy = 'updated-desc'

export default function WorkflowsList() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT)
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.workflows.list(),
    queryFn: listWorkflows
  })

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.description?.toLowerCase().includes(q) ?? false)
      )
    }
    if (validityFilter === 'valid')   rows = rows.filter(w => w.isValid === true)
    if (validityFilter === 'invalid') rows = rows.filter(w => w.isValid === false)
    return [...rows].sort(sortFn(sortBy))
  }, [data, search, sortBy, validityFilter])

  const activeFilters = validityFilter !== 'all' ? 1 : 0
  const hasAnyControl = search.trim() !== '' || activeFilters > 0 || sortBy !== DEFAULT_SORT

  const duplicateMut = useMutation({
    mutationFn: (id: string) => duplicateWorkflow(id, {}),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success(`Workflow dupliqué : « ${wf.name} »`)
    },
    onError: () => toast.error('Échec de la duplication')
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      const name = data?.find(w => w.id === id)?.name ?? 'le workflow'
      toast.success(`« ${name} » supprimé`)
      setToDelete(null)
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const resetControls = () => {
    setSearch('')
    setSortBy(DEFAULT_SORT)
    setValidityFilter('all')
  }

  return (
    <div className='mx-auto max-w-6xl px-6 py-8'>
      <PageHeader
        title={
          <h1 className='text-2xl font-semibold tracking-tight text-fg'>
            Workflows
            {data ? (
              <span className='ml-2 text-base font-normal text-fg-muted tabular-nums'>
                ({filtered.length}{filtered.length !== data.length ? ` / ${data.length}` : ''})
              </span>
            ) : null}
          </h1>
        }
        actions={
          <Button variant='primary' onClick={() => setCreateOpen(true)}>
            <Icon name='Plus' size={16} />
            Nouveau workflow
          </Button>
        }
      />

      {data && data.length > 0 ? (
        <div className='mt-6 flex flex-wrap items-center gap-2'>
          <div className='relative min-w-[260px] flex-1 max-w-md'>
            <Icon
              name='Search'
              size={16}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted'
            />
            <input
              type='search'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Rechercher (nom, description)…'
              aria-label='Rechercher un workflow'
              className='h-9 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            />
            {search ? (
              <button
                type='button'
                onClick={() => setSearch('')}
                aria-label='Effacer la recherche'
                className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:bg-surface-muted hover:text-fg'
              >
                <Icon name='X' size={16} />
              </button>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant='secondary' size='sm'>
                <Icon name='ArrowUpDown' size={16} />
                Tri : {SORT_LABEL[sortBy]}
                <Icon name='ChevronDown' size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              {(Object.keys(SORT_LABEL) as SortBy[]).map(key => (
                <DropdownItem
                  key={key}
                  icon={sortBy === key ? 'Check' : undefined}
                  onSelect={() => setSortBy(key)}
                >
                  {SORT_LABEL[key]}
                </DropdownItem>
              ))}
            </DropdownContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant='secondary' size='sm'>
                <Icon name='ListFilter' size={16} />
                Filtres
                {activeFilters > 0 ? (
                  <span className='ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-on-primary'>
                    {activeFilters}
                  </span>
                ) : null}
                <Icon name='ChevronDown' size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <FilterGroupLabel>Validité</FilterGroupLabel>
              <DropdownItem icon={validityFilter === 'all' ? 'Check' : undefined} onSelect={() => setValidityFilter('all')}>
                Tous
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={validityFilter === 'valid' ? 'Check' : undefined} onSelect={() => setValidityFilter('valid')}>
                Valides uniquement
              </DropdownItem>
              <DropdownItem icon={validityFilter === 'invalid' ? 'Check' : undefined} onSelect={() => setValidityFilter('invalid')}>
                Invalides uniquement
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>

          {hasAnyControl ? (
            <Button variant='ghost' size='sm' onClick={resetControls}>
              <Icon name='RotateCcw' size={16} />
              Réinitialiser
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className='mt-4'>
        {isLoading ? (
          <div role="status" aria-live="polite" className='rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted'>
            Chargement…
          </div>
        ) : error ? (
          <div role="alert" className='rounded-lg border border-border bg-surface p-8 text-center'>
            <p className='text-sm text-fg'>Impossible de charger les workflows.</p>
            <Button variant='secondary' className='mt-4' onClick={() => refetch()}>
              <Icon name='RotateCw' size={16} />
              Réessayer
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className='mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center'>
            <Icon name='ListPlus' size={24} className='mx-auto text-fg-muted' />
            <p className='mt-4 text-sm text-fg'>Aucun workflow créé pour le moment.</p>
            <Button variant='primary' className='mt-4' onClick={() => setCreateOpen(true)}>
              Créer mon premier workflow
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className='rounded-lg border border-border bg-surface p-8 text-center'>
            <Icon name='SearchX' size={24} className='mx-auto text-fg-muted' />
            <p className='mt-3 text-sm text-fg'>Aucun workflow ne correspond à ces critères.</p>
            <Button variant='secondary' className='mt-4' onClick={resetControls}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <WorkflowsTable
            rows={filtered}
            onDuplicate={id => duplicateMut.mutate(id)}
            onDelete={row => setToDelete(row)}
          />
        )}
      </div>

      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteWorkflowConfirm
        open={!!toDelete}
        target={toDelete}
        loading={deleteMut.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  )
}

function FilterGroupLabel({ children }: { children: string }) {
  return (
    <div className='px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted'>
      {children}
    </div>
  )
}
