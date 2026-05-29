/**
 * Phone number helpers — recognize French national (10 digits, leading 0) and
 * E.164 international (leading +) formats. Validation is lenient on whitespace
 * / dashes so the user can paste in any common notation.
 *
 * Two layers:
 *   `stripPhone` — canonical storage form: digits only, with an optional leading +.
 *   `formatPhone` — display form with grouped spacing.
 *   `isValidPhone` — empty (optional field) or matches one of the accepted shapes.
 */

const FR_NATIONAL = /^0[1-9]\d{8}$/
const E164 = /^\+[1-9]\d{7,14}$/

export function stripPhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const sign = trimmed.startsWith('+') ? '+' : ''
  return sign + trimmed.replace(/[^\d]/g, '')
}

export function isValidPhone(raw: string): boolean {
  if (!raw.trim()) return true
  const s = stripPhone(raw)
  return FR_NATIONAL.test(s) || E164.test(s)
}

/**
 * Beautify a stored phone number for display. Supports:
 *   - French national   "0612345678"   → "06 12 34 56 78"
 *   - French E.164      "+33612345678" → "+33 6 12 34 56 78"
 *   - Other E.164       "+15551234567" → "+1 555 123 4567"  (best-effort 3-3-4 split)
 * Unknown shapes fall back to the canonical stripped form so the user at least sees
 * something readable.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = stripPhone(raw)
  if (FR_NATIONAL.test(s)) {
    return `${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 6)} ${s.slice(6, 8)} ${s.slice(8, 10)}`
  }
  if (s.startsWith('+33') && s.length === 12) {
    const rest = s.slice(3)
    return `+33 ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`
  }
  if (E164.test(s)) {
    // Generic country: split off the country code (up to 3 digits) then 3-3-rest.
    const m = s.match(/^\+(\d{1,3})(\d+)$/)
    if (m) {
      const [, cc, rest] = m
      if (rest && rest.length > 6) return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`
      if (rest && rest.length > 3) return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3)}`
      return `+${cc} ${rest ?? ''}`.trim()
    }
  }
  return s
}

/** Accept the same set of inputs as `isValidPhone`. Returned to the HTML `pattern`
 *  attribute for native browser hint. JS validation in the form is the source of truth. */
export const PHONE_PATTERN = '(?:\\+[1-9]\\d{7,14}|0[1-9]\\d{8})'

/** Generous on input; we strip non-digits in JS so 25 chars covers "+33 6 12 34 56 78". */
export const PHONE_MAX_INPUT = 25
