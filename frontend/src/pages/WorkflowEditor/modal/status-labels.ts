/**
 * Human-friendly French labels for channel-delivery statuses. The raw status codes
 * (delivered/bounced/clicked/…) stay as the canonical identifiers in the schema and
 * across the wire — this map is presentation-only.
 */
export const STATUS_LABEL_FR: Record<string, string> = {
  delivered: 'Délivré',
  bounced:   'Rejeté (bounce)',
  rejected:  'Rejeté',
  opened:    'Ouvert',
  clicked:   'Cliqué',
  unopened:  'Non ouvert',
  sent:      'Envoyé',
  failed:    'Échec',
  read:      'Lu',
  returned:  'Retourné'
}

export function frStatus(code: string): string {
  return STATUS_LABEL_FR[code] ?? code
}
