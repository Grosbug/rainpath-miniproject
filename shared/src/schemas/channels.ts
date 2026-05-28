export const CHANNEL_STATUSES = {
  email:            ['delivered', 'bounced', 'rejected', 'opened', 'clicked', 'unopened'],
  sms:              ['sent', 'delivered', 'failed'],
  whatsapp:         ['sent', 'delivered', 'read', 'failed'],
  postal_tracked:   ['sent', 'delivered', 'returned'],
  postal_untracked: ['sent']
} as const

export type ChannelKey = keyof typeof CHANNEL_STATUSES
export type ChannelStatus<K extends ChannelKey> = (typeof CHANNEL_STATUSES)[K][number]
