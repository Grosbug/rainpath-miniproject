import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Returns "il y a 2 min", "il y a 3 j", etc. — accepts ISO string or Date. */
export function relativeFromNow(input: string | Date): string {
  const date = typeof input === 'string' ? parseISO(input) : input
  return formatDistanceToNow(date, { addSuffix: true, locale: fr })
}
