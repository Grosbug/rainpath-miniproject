import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Dialog } from '@/components/ui/Dialog'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { relativeFromNow } from '@/lib/format-date'
import { formatFirstName, formatLastName, formatPatientFullName } from '@/lib/format-person-name'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/api/query-keys'
import { listPatientProfiles, deletePatientProfile, type PatientProfile } from '@/api/patient-profiles'
import { listPatientRunsForPatient, deletePatientRun } from '@/api/patient-runs'
import { ProfileFormDialog } from './ProfileFormDialog'
import { DeleteProfileConfirm } from './DeleteProfileConfirm'
import { CreateRunDialog } from '../PatientRunsList/CreateRunDialog'

function civility(g: PatientProfile['gender']): string {
  return g === 'female' ? 'Mme' : 'M.'
}

function formatAddress(addr: PatientProfile['address']): string | null {
  if (!addr) return null
  const parts = [addr.street, `${addr.postalCode} ${addr.city}`.trim(), addr.country]
    .map(p => (p ?? '').trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatFrDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type SortBy =
  | 'lastName-asc' | 'lastName-desc'
  | 'firstName-asc' | 'firstName-desc'
  | 'runs-desc' | 'runs-asc'
  | 'updated-desc' | 'updated-asc'

const SORT_LABEL: Record<SortBy, string> = {
  'lastName-asc':   'Nom (A → Z)',
  'lastName-desc':  'Nom (Z → A)',
  'firstName-asc':  'Prénom (A → Z)',
  'firstName-desc': 'Prénom (Z → A)',
  'runs-desc':      'Parcours (plus → moins)',
  'runs-asc':       'Parcours (moins → plus)',
  'updated-desc':   'Modifié — récent d\'abord',
  'updated-asc':    'Modifié — ancien d\'abord'
}

type GenderFilter = 'all' | 'male' | 'female'
type EmailFilter = 'all' | 'with' | 'without'
type RunsFilter = 'all' | 'with' | 'without'

const cmp = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' })

function sortFn(by: SortBy): (a: PatientProfile, b: PatientProfile) => number {
  switch (by) {
    case 'lastName-asc':   return (a, b) => cmp(a.lastName, b.lastName) || cmp(a.firstName, b.firstName)
    case 'lastName-desc':  return (a, b) => cmp(b.lastName, a.lastName) || cmp(b.firstName, a.firstName)
    case 'firstName-asc':  return (a, b) => cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName)
    case 'firstName-desc': return (a, b) => cmp(b.firstName, a.firstName) || cmp(b.lastName, a.lastName)
    case 'runs-desc':      return (a, b) => (b.runsCount ?? 0) - (a.runsCount ?? 0) || cmp(a.lastName, b.lastName)
    case 'runs-asc':       return (a, b) => (a.runsCount ?? 0) - (b.runsCount ?? 0) || cmp(a.lastName, b.lastName)
    case 'updated-desc':   return (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    case 'updated-asc':    return (a, b) => a.updatedAt.localeCompare(b.updatedAt)
  }
}

export default function PatientProfilesList() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PatientProfile | null>(null)
  const [toDelete, setToDelete] = useState<PatientProfile | null>(null)
  const [detailFor, setDetailFor] = useState<PatientProfile | null>(null)
  const [runDialogPatient, setRunDialogPatient] = useState<PatientProfile | null>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('lastName-asc')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [emailFilter, setEmailFilter] = useState<EmailFilter>('all')
  const [runsFilter, setRunsFilter] = useState<RunsFilter>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles
  })

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(p =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false)
      )
    }
    if (genderFilter !== 'all') rows = rows.filter(p => p.gender === genderFilter)
    if (emailFilter === 'with')    rows = rows.filter(p => !!p.email)
    if (emailFilter === 'without') rows = rows.filter(p => !p.email)
    if (runsFilter === 'with')     rows = rows.filter(p => (p.runsCount ?? 0) > 0)
    if (runsFilter === 'without')  rows = rows.filter(p => (p.runsCount ?? 0) === 0)
    return [...rows].sort(sortFn(sortBy))
  }, [data, search, sortBy, genderFilter, emailFilter, runsFilter])

  const activeFilters =
    (genderFilter !== 'all' ? 1 : 0) +
    (emailFilter !== 'all' ? 1 : 0) +
    (runsFilter !== 'all' ? 1 : 0)
  const hasAnyControl = search.trim() !== '' || activeFilters > 0 || sortBy !== 'lastName-asc'

  const delMut = useMutation({
    mutationFn: (id: string) => deletePatientProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil supprimé')
      setToDelete(null)
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const handleNew = () => { setEditing(null); setFormOpen(true) }
  const handleEdit = (p: PatientProfile) => { setEditing(p); setFormOpen(true) }
  const handleOpenDetails = (p: PatientProfile) => { setDetailFor(p) }
  const handleCreateRun = (p: PatientProfile) => { setRunDialogPatient(p) }
  const resetControls = () => {
    setSearch('')
    setSortBy('lastName-asc')
    setGenderFilter('all')
    setEmailFilter('all')
    setRunsFilter('all')
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Profils patients
          {data ? (
            <span className="ml-2 text-base font-normal text-fg-muted tabular-nums">
              ({filtered.length}{filtered.length !== data.length ? ` / ${data.length}` : ''})
            </span>
          ) : null}
        </h1>
        <Button variant="primary" onClick={handleNew}>
          <Icon name="Plus" size={16} />
          Nouveau profil
        </Button>
      </header>

      {data && data.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher (nom, prénom, email)…"
              aria-label="Rechercher un profil patient"
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                <Icon name="X" size={16} />
              </button>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="secondary" size="sm">
                <Icon name="ArrowUpDown" size={16} />
                Tri : {SORT_LABEL[sortBy]}
                <Icon name="ChevronDown" size={16} />
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
              <Button variant="secondary" size="sm">
                <Icon name="ListFilter" size={16} />
                Filtres
                {activeFilters > 0 ? (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-on-primary">
                    {activeFilters}
                  </span>
                ) : null}
                <Icon name="ChevronDown" size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <FilterGroupLabel>Civilité</FilterGroupLabel>
              <DropdownItem icon={genderFilter === 'all' ? 'Check' : undefined} onSelect={() => setGenderFilter('all')}>
                Toutes
              </DropdownItem>
              <DropdownItem icon={genderFilter === 'male' ? 'Check' : undefined} onSelect={() => setGenderFilter('male')}>
                M. uniquement
              </DropdownItem>
              <DropdownItem icon={genderFilter === 'female' ? 'Check' : undefined} onSelect={() => setGenderFilter('female')}>
                Mme uniquement
              </DropdownItem>
              <DropdownSeparator />
              <FilterGroupLabel>Email</FilterGroupLabel>
              <DropdownItem icon={emailFilter === 'all' ? 'Check' : undefined} onSelect={() => setEmailFilter('all')}>
                Tous
              </DropdownItem>
              <DropdownItem icon={emailFilter === 'with' ? 'Check' : undefined} onSelect={() => setEmailFilter('with')}>
                Avec email
              </DropdownItem>
              <DropdownItem icon={emailFilter === 'without' ? 'Check' : undefined} onSelect={() => setEmailFilter('without')}>
                Sans email
              </DropdownItem>
              <DropdownSeparator />
              <FilterGroupLabel>Parcours</FilterGroupLabel>
              <DropdownItem icon={runsFilter === 'all' ? 'Check' : undefined} onSelect={() => setRunsFilter('all')}>
                Tous
              </DropdownItem>
              <DropdownItem icon={runsFilter === 'with' ? 'Check' : undefined} onSelect={() => setRunsFilter('with')}>
                Avec parcours
              </DropdownItem>
              <DropdownItem icon={runsFilter === 'without' ? 'Check' : undefined} onSelect={() => setRunsFilter('without')}>
                Sans parcours
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>

          {hasAnyControl ? (
            <Button variant="ghost" size="sm" onClick={resetControls}>
              <Icon name="RotateCcw" size={16} />
              Réinitialiser
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {isLoading ? (
          <div role="status" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Chargement…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-fg">Impossible de charger les profils.</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
              <Icon name="RotateCw" size={16} />
              Réessayer
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="ListPlus" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-4 text-sm text-fg">Aucun profil patient pour le moment.</p>
            <Button variant="primary" className="mt-4" onClick={handleNew}>Créer mon premier profil</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="SearchX" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-3 text-sm text-fg">Aucun profil ne correspond à ces critères.</p>
            <Button variant="secondary" className="mt-4" onClick={resetControls}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="w-20 whitespace-nowrap px-4 py-3 text-center">Civilité</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Nom</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Prénom</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="Mail" size={16} />
                      Email
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="Phone" size={16} />
                      Téléphone
                    </span>
                  </th>
                  <th className="w-28 whitespace-nowrap px-4 py-3 text-center">Parcours</th>
                  <th className="w-10 px-2 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-surface-muted"
                    onClick={() => handleOpenDetails(p)}
                  >
                    <td className="px-4 py-3 text-center text-fg-muted">{civility(p.gender)}</td>
                    <td className="px-4 py-3 font-medium text-fg">{formatLastName(p.lastName)}</td>
                    <td className="px-4 py-3 text-fg">{formatFirstName(p.firstName)}</td>
                    <td className="px-4 py-3 text-fg-muted">{p.email ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-muted tabular-nums">{p.phone ? formatPhone(p.phone) : '—'}</td>
                    <td className="px-4 py-3 text-center"><RunsBadge count={p.runsCount ?? 0} /></td>
                    <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <IconButton icon="EllipsisVertical" aria-label={`Actions sur ${formatPatientFullName(p)}`} size="sm" />
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon="Pencil" onSelect={() => handleEdit(p)}>Éditer</DropdownItem>
                          <DropdownItem icon="Plus" onSelect={() => handleCreateRun(p)}>Créer un parcours</DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem icon="Trash2" danger onSelect={() => setToDelete(p)}>Supprimer</DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProfileFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <DeleteProfileConfirm
        open={!!toDelete}
        target={toDelete}
        loading={delMut.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && delMut.mutate(toDelete.id)}
      />
      <ProfileDetailDialog
        open={!!detailFor}
        profile={detailFor}
        onOpenChange={open => { if (!open) setDetailFor(null) }}
        onEdit={p => { setDetailFor(null); handleEdit(p) }}
        onCreateRun={p => { setDetailFor(null); handleCreateRun(p) }}
      />
      <CreateRunDialog
        open={!!runDialogPatient}
        onOpenChange={open => { if (!open) setRunDialogPatient(null) }}
        patientId={runDialogPatient?.id}
      />
    </div>
  )
}

function FilterGroupLabel({ children }: { children: string }) {
  return (
    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
      {children}
    </div>
  )
}

function RunsBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-fg-subtle">
        <Icon name="Minus" size={16} />
        Aucun
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums"
      data-rp-tooltip={`${count} parcours en cours`}
    >
      <Icon name="Play" size={16} />
      {count}
    </span>
  )
}

interface DetailProps {
  open: boolean
  profile: PatientProfile | null
  onOpenChange: (open: boolean) => void
  onEdit: (p: PatientProfile) => void
  onCreateRun: (p: PatientProfile) => void
}

function ProfileDetailDialog({ open, profile, onOpenChange, onEdit, onCreateRun }: DetailProps) {
  const qc = useQueryClient()
  const [confirmRunId, setConfirmRunId] = useState<string | null>(null)
  const runsQuery = useQuery({
    queryKey: profile ? [...queryKeys.patientRuns.all, 'patient', profile.id] : ['patient-runs', 'patient', 'none'],
    queryFn: () => listPatientRunsForPatient(profile!.id),
    enabled: open && !!profile
  })

  const delRunMut = useMutation({
    mutationFn: (id: string) => deletePatientRun(id),
    onSuccess: () => {
      // Invalidate both the per-patient list (this dialog) and the workflow-scoped
      // lists + the profile list (whose runsCount aggregate changes). Cheap fan-out.
      if (profile) qc.invalidateQueries({ queryKey: [...queryKeys.patientRuns.all, 'patient', profile.id] })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Parcours supprimé')
      setConfirmRunId(null)
    },
    onError: () => toast.error('Échec de la suppression du parcours')
  })

  if (!profile) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Détails du profil" size="lg">
      <div className="space-y-5">
        <section>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-fg">
                {civility(profile.gender)} {formatPatientFullName(profile)}
              </h2>
              <p className="text-sm text-fg-muted">{profile.gender === 'female' ? 'Féminin' : 'Masculin'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onEdit(profile)}>
                <Icon name="Pencil" size={16} />
                Éditer
              </Button>
              <Button variant="primary" onClick={() => onCreateRun(profile)}>
                <Icon name="Plus" size={16} />
                Créer un parcours
              </Button>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Téléphone" value={profile.phone ? formatPhone(profile.phone) : null} />
            <InfoRow label="WhatsApp" value={profile.whatsapp ? formatPhone(profile.whatsapp) : null} />
            <InfoRow label="Adresse" value={formatAddress(profile.address)} span2 />
          </dl>
        </section>

        <div className="h-px bg-border" />

        <section>
          <h3 className="mb-3 text-sm font-semibold text-fg">Parcours patients</h3>
          {runsQuery.isLoading ? (
            <p className="text-sm text-fg-muted">Chargement…</p>
          ) : runsQuery.error ? (
            <p className="text-sm text-danger">Impossible de charger les parcours.</p>
          ) : !runsQuery.data || runsQuery.data.length === 0 ? (
            <p className="text-sm text-fg-muted">Aucun parcours pour ce patient.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {runsQuery.data.map(r => {
                const confirming = confirmRunId === r.id
                const deleting = delRunMut.isPending && delRunMut.variables === r.id
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    {confirming ? (
                      // Inline 2-step confirm — avoids nesting a second Radix Dialog inside the
                      // detail dialog (which causes focus-trap conflicts). The row morphs into
                      // a confirm prompt; cancel reverts.
                      <>
                        <span className="min-w-0 flex-1 text-sm text-fg">
                          Supprimer le parcours sur <strong>{r.workflow.name}</strong> ?
                          <span className="ml-1 text-xs text-fg-muted">(suppression douce, archivage)</span>
                        </span>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmRunId(null)}
                            disabled={deleting}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            loading={deleting}
                            onClick={() => delRunMut.mutate(r.id)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/workflows/${r.workflow.id}/patient-runs/${r.id}`}
                          className="min-w-0 flex-1 text-sm text-fg hover:text-primary"
                          onClick={() => onOpenChange(false)}
                        >
                          <span className="truncate font-medium">{r.workflow.name}</span>
                          <span className="ml-2 text-xs text-fg-muted">Début {formatFrDate(r.startDate)}</span>
                        </Link>
                        <span className="shrink-0 text-xs text-fg-muted tabular-nums">{relativeFromNow(r.updatedAt)}</span>
                        <IconButton
                          icon="Trash2"
                          size="sm"
                          aria-label={`Supprimer le parcours sur ${r.workflow.name}`}
                          onClick={() => setConfirmRunId(r.id)}
                          className="text-fg-muted hover:text-danger"
                        />
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}

function InfoRow({ label, value, span2 }: { label: string; value: string | null; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : undefined}>
      <dt className="text-xs uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg">{value ?? '—'}</dd>
    </div>
  )
}
