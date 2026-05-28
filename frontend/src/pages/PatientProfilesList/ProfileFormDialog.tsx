import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { createPatientProfile, updatePatientProfile, type PatientProfile } from '@/api/patient-profiles'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PatientProfile | null
}

export function ProfileFormDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setEmail(editing?.email ?? '')
      setPhone(editing?.phone ?? '')
      setWhatsapp(editing?.whatsapp ?? '')
      setAddress(editing?.address ?? '')
      setError(null)
    }
  }, [open, editing])

  const createMut = useMutation({
    mutationFn: () => createPatientProfile({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      address: address.trim() || null
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil créé')
      onOpenChange(false)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const updateMut = useMutation({
    mutationFn: () => updatePatientProfile(editing!.id, {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      address: address.trim() || null
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil mis à jour')
      onOpenChange(false)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Modifier le profil' : 'Nouveau profil patient'}
      size="md"
    >
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Nom" required value={name} onChange={setName} autoFocus />
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Téléphone (SMS)" value={phone} onChange={setPhone} />
        <FormField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
        <FormField label="Adresse postale" value={address} onChange={setAddress} />
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
            {editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  autoFocus?: boolean
}

function FormField({ label, value, onChange, required, type = 'text', autoFocus }: FieldProps) {
  const id = `pf-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
