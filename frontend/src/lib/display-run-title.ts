/** User-facing label for a patient run (intitulé). Falls back when legacy rows have no title. */
export function displayRunTitle(title: string, fallback = 'Parcours sans intitulé'): string {
  const t = title.trim()
  return t.length > 0 ? t : fallback
}
