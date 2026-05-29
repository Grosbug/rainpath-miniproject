const LOCALE = 'fr'

function capitalizeToken(token: string): string {
  if (!token) return token
  return token
    .split(/(['-])/)
    .map(part => {
      if (part === '-' || part === "'" || part === '') return part
      const lower = part.toLocaleLowerCase(LOCALE)
      return lower.charAt(0).toLocaleUpperCase(LOCALE) + lower.slice(1)
    })
    .join('')
}

/** Prénom affiché : initiale majuscule par mot (Jean-Marc, Anne). */
export function formatFirstName(name: string): string {
  return name.trim().split(/\s+/).map(capitalizeToken).join(' ')
}

/** Nom de famille affiché : majuscules (convention dossier patient FR). */
export function formatLastName(name: string): string {
  return name.trim().toLocaleUpperCase(LOCALE)
}

export function formatPatientFullName(profile: { firstName: string; lastName: string }): string {
  const first = formatFirstName(profile.firstName)
  const last = formatLastName(profile.lastName)
  return [first, last].filter(Boolean).join(' ')
}

/** Nom complet pré-composé (ex. champ `name` API) — dernier token = nom. */
export function formatPatientDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return formatFirstName(parts[0]!)
  const lastName = parts[parts.length - 1]!
  const firstName = parts.slice(0, -1).join(' ')
  return formatPatientFullName({ firstName, lastName })
}

/** Valeurs à enregistrer lors de la création / édition d'un profil. */
export function normalizePatientNameFields(profile: { firstName: string; lastName: string }): {
  firstName: string
  lastName: string
} {
  return {
    firstName: formatFirstName(profile.firstName),
    lastName: formatLastName(profile.lastName)
  }
}
