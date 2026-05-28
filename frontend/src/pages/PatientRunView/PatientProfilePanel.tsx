import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { updatePatientProfile } from '@/api/patient-profiles'
import { ApiError } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

interface PatientShape {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  deletedAt: string | null
}

interface Props {
  patient: PatientShape
  runId: string
}

type DraftKey = 'name' | 'email' | 'phone' | 'whatsapp' | 'address'

export function PatientProfilePanel({ patient, runId }: Props) {
  const [draft, setDraft] = useState<Record<DraftKey, string>>({
    name: patient.name,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    whatsapp: patient.whatsapp ?? '',
    address: patient.address ?? ''
  })

  useEffect(() => {
    setDraft({
      name: patient.name,
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      whatsapp: patient.whatsapp ?? '',
      address: patient.address ?? ''
    })
  }, [patient])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qc = useQueryClient()

  const saveMut = useMutation({
    mutationFn: (next: Record<DraftKey, string>) =>
      updatePatientProfile(patient.id, {
        name: next.name.trim() || patient.name,
        email: next.email.trim() ? next.email.trim() : null,
        phone: next.phone.trim() ? next.phone.trim() : null,
        whatsapp: next.whatsapp.trim() ? next.whatsapp.trim() : null,
        address: next.address.trim() ? next.address.trim() : null
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
    },
    onError: e => {
      const msg = e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur'
      toast.error(`Échec : ${msg}`)
    }
  })

  const setField = (key: DraftKey, value: string) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveMut.mutate(next), 500)
  }

  if (patient.deletedAt) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">
        Patient supprimé. Le profil n'est plus modifiable.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Profil patient</h2>
        {saveMut.isPending ? (
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
            <Icon name="LoaderCircle" size={16} className="animate-spin" />
            Enregistrement…
          </span>
        ) : null}
      </div>

      <p className="text-xs text-fg-muted">
        Modifier ces données change immédiatement les chemins disponibles dans le workflow.
      </p>

      <PanelField label="Nom"      value={draft.name}     onChange={v => setField('name', v)} />
      <PanelField label="Email"    value={draft.email}    onChange={v => setField('email', v)}    placeholder="alice@example.com" />
      <PanelField label="Téléphone" value={draft.phone}   onChange={v => setField('phone', v)}    placeholder="+33 …" />
      <PanelField label="WhatsApp" value={draft.whatsapp} onChange={v => setField('whatsapp', v)} placeholder="+33 …" />
      <PanelField label="Adresse"  value={draft.address}  onChange={v => setField('address', v)} placeholder="123 rue …" />
    </div>
  )
}

function PanelField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const id = `pp-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-muted">{label}</label>
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
