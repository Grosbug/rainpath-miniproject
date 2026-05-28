import { describe, it, expect } from 'vitest'
import { CHANNEL_STATUSES, type ChannelKey } from '../src/schemas/channels'
import { CHANNEL_FORMAT_RULES, type ChannelFormatKey } from '../src/schemas/format'
import { DataAvailableExpressions } from '../src/schemas/expressions'

describe('CHANNEL_STATUSES', () => {
  it('lists email statuses without delivered ambiguity', () => {
    expect(CHANNEL_STATUSES.email).toEqual([
      'delivered', 'bounced', 'rejected', 'opened', 'clicked', 'unopened'
    ])
  })
  it('postal_untracked only has sent', () => {
    expect(CHANNEL_STATUSES.postal_untracked).toEqual(['sent'])
  })
  it('postal_tracked observes sent, delivered, returned', () => {
    expect(CHANNEL_STATUSES.postal_tracked).toEqual(['sent', 'delivered', 'returned'])
  })
})

describe('CHANNEL_FORMAT_RULES', () => {
  it('sms body maxLength 459 and recommendedMax 160', () => {
    expect(CHANNEL_FORMAT_RULES.sms.body.maxLength).toBe(459)
    expect(CHANNEL_FORMAT_RULES.sms.body.recommendedMax).toBe(160)
    expect(CHANNEL_FORMAT_RULES.sms.body.unicodeThreshold).toBe(70)
  })
  it('email subject maxLength 78 recommended 50', () => {
    expect(CHANNEL_FORMAT_RULES.email.subject.maxLength).toBe(78)
    expect(CHANNEL_FORMAT_RULES.email.subject.recommendedMax).toBe(50)
  })
  it('whatsapp body maxLength 4096', () => {
    expect(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).toBe(4096)
  })
})

describe('DataAvailableExpressions', () => {
  it('contains exactly the 4 patient fields', () => {
    expect(DataAvailableExpressions).toEqual([
      'patient.email', 'patient.phone', 'patient.whatsapp', 'patient.address'
    ])
  })
})
