import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { describeError } from '@/api/error-messages'
import { createPatientProfile, updatePatientProfile, type PatientGender, type PatientProfile } from '@/api/patient-profiles'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PatientProfile | null
}

const POSTAL_CODE_PATTERN = /^\d{5}$/

export function ProfileFormDialog({ open, onOpenChange, editing }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState<PatientGender>('female')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('France')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setFirstName(editing?.firstName ?? '')
      setLastName(editing?.lastName ?? '')
      setGender(editing?.gender ?? 'female')
      setEmail(editing?.email ?? '')
      setPhone(editing?.phone ?? '')
      setWhatsapp(editing?.whatsapp ?? '')
      setStreet(editing?.address?.street ?? '')
      setPostalCode(editing?.address?.postalCode ?? '')
      setCity(editing?.address?.city ?? '')
      setCountry(editing?.address?.country ?? 'France')
      setError(null)
    }
  }, [open, editing])

  // All four address fields must be filled together — the structured PostalAddress
  // schema requires street / postalCode / city. Country defaults to France but is
  // optional. An "all empty" set is interpreted as "no address" (sent as null).
  const buildAddress = () => {
    const s = street.trim(), p = postalCode.trim(), c = city.trim(), co = country.trim()
    if (!s && !p && !c) return null
    return { street: s, postalCode: p, city: c, country: co || null }
  }

  const buildPayload = () => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    gender,
    email: email.trim() || null,
    phone: phone.trim() || null,
    whatsapp: whatsapp.trim() || null,
    address: buildAddress()
  })

  const createMut = useMutation({
    mutationFn: () => createPatientProfile(buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil créé')
      onOpenChange(false)
    },
    onError: e => setError(describeError(e, 'Impossible de créer le profil patient.'))
  })

  const updateMut = useMutation({
    mutationFn: () => updatePatientProfile(editing!.id, buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil mis à jour')
      onOpenChange(false)
    },
    onError: e => setError(describeError(e, 'Impossible de mettre à jour le profil patient.'))
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firstName.trim()) { setError('Le prénom est requis'); return }
    if (!lastName.trim()) { setError('Le nom est requis'); return }
    if (gender !== 'male' && gender !== 'female') { setError('Le genre est requis'); return }
    // Address fields are all-or-nothing. If any of street/postalCode/city is set, all three
    // must be valid, and the postal code must match the French 5-digit pattern.
    const anyAddrField = street.trim() || postalCode.trim() || city.trim()
    if (anyAddrField) {
      if (!street.trim()) { setError('La rue est requise pour une adresse complète'); return }
      if (!city.trim()) { setError('La ville est requise pour une adresse complète'); return }
      if (!POSTAL_CODE_PATTERN.test(postalCode.trim())) {
        setError('Code postal invalide (5 chiffres attendus)')
        return
      }
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
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prénom" required value={firstName} onChange={setFirstName} autoFocus />
          <FormField label="Nom" required value={lastName} onChange={setLastName} />
        </div>
        <div>
          <label htmlFor="pf-gender" className="mb-1 block text-sm font-medium text-fg">
            Genre <span className="text-danger">*</span>
          </label>
          <select
            id="pf-gender"
            value={gender}
            onChange={e => setGender(e.target.value as PatientGender)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="female">Féminin</option>
            <option value="male">Masculin</option>
          </select>
        </div>
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Téléphone (SMS)" value={phone} onChange={setPhone} />
        <FormField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
        <fieldset className='space-y-3 rounded-md border border-border bg-surface-muted/40 p-3'>
          <legend className='px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted'>
            Adresse postale
          </legend>
          <FormField label="Rue" value={street} onChange={setStreet} />
          <div className='grid grid-cols-[7rem_1fr] gap-3'>
            <FormField label="Code postal" value={postalCode} onChange={setPostalCode} inputMode='numeric' pattern='\d{5}' maxLength={5} />
            <FormField label="Ville" value={city} onChange={setCity} />
          </div>
          <FormField label="Pays" value={country} onChange={setCountry} />
        </fieldset>
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
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  pattern?: string
  maxLength?: number
}

function FormField({ label, value, onChange, required, type = 'text', autoFocus, inputMode, pattern, maxLength }: FieldProps) {
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
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
