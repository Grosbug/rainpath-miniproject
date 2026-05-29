import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon, type IconName } from '@/components/Icon'
import { updatePatientProfile } from '@/api/patient-profiles'
import { describeError } from '@/api/error-messages'
import { queryKeys } from '@/api/query-keys'
import { useSidebarCollapsed } from './use-sidebar-collapsed'
import { isValidPhone, stripPhone, formatPhone, PHONE_MAX_INPUT } from '@/lib/phone'

interface PatientShape {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  /** Structured postal address — same shape as the API model. */
  address: { street: string; postalCode: string; city: string; country?: string | null } | null
  deletedAt: string | null
}

interface Props {
  patient: PatientShape
  runId: string
}

type DraftKey = 'email' | 'phone' | 'whatsapp' | 'street' | 'postalCode' | 'city'

export function PatientProfilePanel({ patient, runId }: Props) {
  const [draft, setDraft] = useState<Record<DraftKey, string>>({
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    whatsapp: patient.whatsapp ?? '',
    street: patient.address?.street ?? '',
    postalCode: patient.address?.postalCode ?? '',
    city: patient.address?.city ?? ''
  })

  useEffect(() => {
    setDraft({
      email: patient.email ?? '',
      // Pretty-print phones for display; the saver re-canonicalizes via stripPhone.
      phone: formatPhone(patient.phone),
      whatsapp: formatPhone(patient.whatsapp),
      street: patient.address?.street ?? '',
      postalCode: patient.address?.postalCode ?? '',
      city: patient.address?.city ?? ''
    })
  }, [patient])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qc = useQueryClient()

  const saveMut = useMutation({
    mutationFn: (next: Record<DraftKey, string>) => {
      // Address is sent as a structured object when at least one address field is filled,
      // null otherwise. Postal code must match the 5-digit pattern to be persisted;
      // partial input is held client-side until valid.
      const s = next.street.trim(), p = next.postalCode.trim(), c = next.city.trim()
      const anyAddr = s || p || c
      let address: { street: string; postalCode: string; city: string; country: string } | null = null
      if (anyAddr && s && /^\d{5}$/.test(p) && c) {
        address = { street: s, postalCode: p, city: c, country: patient.address?.country ?? 'France' }
      }
      // Phone fields validated client-side; only push to the API once they're empty
      // OR they match a recognized format. A half-typed number stays local until valid
      // (same all-or-nothing strategy as the address fields).
      const phoneOk = isValidPhone(next.phone)
      const whatsappOk = isValidPhone(next.whatsapp)
      return updatePatientProfile(patient.id, {
        email: next.email.trim() ? next.email.trim() : null,
        ...(phoneOk ? { phone: next.phone.trim() ? stripPhone(next.phone) : null } : {}),
        ...(whatsappOk ? { whatsapp: next.whatsapp.trim() ? stripPhone(next.whatsapp) : null } : {}),
        ...(address !== null || !anyAddr ? { address } : {})
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.info(
        'Profil mis à jour. Sur une étape d\'envoi en cours, le statut de succès est proposé automatiquement — vérifiez puis cliquez Prochain.'
      )
    },
    onError: e => toast.error(describeError(e, 'Échec de la sauvegarde du profil patient.'))
  })

  const setField = (key: DraftKey, value: string) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveMut.mutate(next), 500)
  }

  const [collapsed, setCollapsed] = useSidebarCollapsed('profile')

  if (patient.deletedAt) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">
        Patient supprimé. Le profil n'est plus modifiable.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Profil patient</h2>
          {saveMut.isPending ? (
            <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
              <Icon name="LoaderCircle" size={16} className="animate-spin" />
              Enregistrement…
            </span>
          ) : null}
        </span>
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={16} className="text-fg-muted" />
      </button>

      {collapsed ? null : (
        <>
          <p className="text-xs text-fg-muted">
            Modifier ces données change immédiatement les chemins disponibles dans le workflow.
          </p>

          <PanelField icon="Mail" label="Email"    value={draft.email}    onChange={v => setField('email', v)}    placeholder="alice@example.com" type="email" autoComplete="email" />
          <PanelField
            icon="Phone"
            label="Téléphone"
            value={draft.phone}
            onChange={v => setField('phone', v)}
            onBlur={() => setField('phone', formatPhone(draft.phone))}
            placeholder="06 12 34 56 78"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={PHONE_MAX_INPUT}
            invalid={!isValidPhone(draft.phone)}
          />
          <PanelField
            icon="MessageCircle"
            label="WhatsApp"
            value={draft.whatsapp}
            onChange={v => setField('whatsapp', v)}
            onBlur={() => setField('whatsapp', formatPhone(draft.whatsapp))}
            placeholder="+33 6 12 34 56 78"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={PHONE_MAX_INPUT}
            invalid={!isValidPhone(draft.whatsapp)}
          />

          {/* Adresse postale — bloc commun pour que les 3 champs (rue, CP, ville) se lisent
              comme une unité. Une bordure légère + un label de section les distingue des
              contacts au-dessus, et un message d'aide explicite la règle "tout-ou-rien". */}
          <fieldset className='space-y-2 rounded-md border border-border bg-surface-muted/40 p-3'>
            <legend className='flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted'>
              <Icon name='MapPin' size={16} />
              Adresse postale
            </legend>
            <PanelField label="Rue"      value={draft.street}   onChange={v => setField('street', v)}   placeholder="123 rue …" />
            <div className='grid grid-cols-[6.5rem_1fr] gap-2'>
              <PanelField label="CP"     value={draft.postalCode} onChange={v => setField('postalCode', v)} placeholder="75001" />
              <PanelField label="Ville"  value={draft.city}     onChange={v => setField('city', v)}     placeholder="Paris" />
            </div>
            <p className='px-1 text-[11px] leading-snug text-fg-subtle'>
              Les trois champs doivent être complétés et le CP au format 5 chiffres pour que
              l'adresse soit enregistrée.
            </p>
          </fieldset>
        </>
      )}
    </div>
  )
}

function PanelField({
  icon, label, value, onChange, onBlur, placeholder,
  type = 'text', inputMode, pattern, maxLength, autoComplete, invalid
}: {
  icon?: IconName
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  pattern?: string
  maxLength?: number
  autoComplete?: string
  /** When true, paint the input in a danger tone — used by the parent to flag a
   *  syntactically invalid in-progress phone number without blocking input. */
  invalid?: boolean
}) {
  const id = `pp-${label.toLowerCase()}`
  const borderClass = invalid
    ? 'border-danger focus-visible:border-danger focus-visible:ring-danger'
    : 'border-border focus-visible:border-primary focus-visible:ring-ring'
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        className={`h-9 w-full rounded-md border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 ${borderClass}`}
      />
    </div>
  )
}
