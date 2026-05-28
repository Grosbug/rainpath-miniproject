import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { relativeFromNow } from '@/lib/format-date'
import { queryKeys } from '@/api/query-keys'
import { listPatientProfiles, deletePatientProfile, type PatientProfile } from '@/api/patient-profiles'
import { ProfileFormDialog } from './ProfileFormDialog'
import { DeleteProfileConfirm } from './DeleteProfileConfirm'

export default function PatientProfilesList() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PatientProfile | null>(null)
  const [toDelete, setToDelete] = useState<PatientProfile | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles
  })

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Profils patients</h1>
        <Button variant="primary" onClick={handleNew}>
          <Icon name="Plus" size={16} />
          Nouveau profil
        </Button>
      </header>

      <div className="mt-8">
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
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3 text-right">Modifié</th>
                  <th className="w-10 px-2 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map(p => (
                  <tr key={p.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium text-fg">{p.name}</td>
                    <td className="px-4 py-3 text-fg-muted">{p.email ?? '—'}</td>
                    <td className="px-4 py-3 text-fg-muted">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-fg-muted tabular-nums">{relativeFromNow(p.updatedAt)}</td>
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <IconButton icon="EllipsisVertical" aria-label={`Actions sur ${p.name}`} size="sm" />
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon="Pencil" onSelect={() => handleEdit(p)}>Éditer</DropdownItem>
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
    </div>
  )
}
