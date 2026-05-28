export const CHANNEL_FORMAT_RULES = {
  email: {
    subject: { maxLength: 78, recommendedMax: 50, format: 'plain' as const },
    body:    { maxLength: 100_000, format: 'html_or_plain' as const }
  },
  sms: {
    body: {
      maxLength: 459,
      recommendedMax: 160,
      unicodeThreshold: 70,
      format: 'plain' as const
    }
  },
  whatsapp: {
    body: {
      maxLength: 4096,
      format: 'whatsapp_markdown' as const
    }
  },
  postal: {
    body: { maxLength: 20_000, format: 'plain' as const }
  }
} as const

export type ChannelFormatKey = keyof typeof CHANNEL_FORMAT_RULES
