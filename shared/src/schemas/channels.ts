export const CHANNEL_STATUSES = {
  email:            ['delivered', 'bounced', 'rejected', 'opened', 'clicked', 'unopened'],
  sms:              ['sent', 'delivered', 'failed'],
  whatsapp:         ['sent', 'delivered', 'read', 'failed'],
  postal_tracked:   ['sent', 'delivered', 'returned'],
  postal_untracked: ['sent']
} as const

/** Terminal failure statuses — never selectable as "success" in simple mode. */
export const CHANNEL_FAILURE_STATUSES = {
  email:            ['bounced', 'rejected'],
  sms:              ['failed'],
  whatsapp:         ['failed'],
  postal_tracked:   ['returned'],
  postal_untracked: []
} as const satisfies { [K in keyof typeof CHANNEL_STATUSES]: readonly (typeof CHANNEL_STATUSES)[K][number][] }

export type ChannelKey = keyof typeof CHANNEL_STATUSES
export type ChannelStatus<K extends ChannelKey> = (typeof CHANNEL_STATUSES)[K][number]
