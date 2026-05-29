import { describe, it, expect } from 'vitest'
import { isValidPhone, stripPhone, formatPhone } from './phone'

describe('phone helpers', () => {
  it('accepts French national numbers with mixed separators', () => {
    expect(isValidPhone('0612345678')).toBe(true)
    expect(isValidPhone('06 12 34 56 78')).toBe(true)
    expect(isValidPhone('06.12.34.56.78')).toBe(true)
    expect(isValidPhone('06-12-34-56-78')).toBe(true)
  })

  it('accepts E.164 international numbers', () => {
    expect(isValidPhone('+33612345678')).toBe(true)
    expect(isValidPhone('+33 6 12 34 56 78')).toBe(true)
    expect(isValidPhone('+15551234567')).toBe(true)
  })

  it('treats empty / whitespace as valid (phone field is optional)', () => {
    expect(isValidPhone('')).toBe(true)
    expect(isValidPhone('   ')).toBe(true)
  })

  it('rejects malformed numbers', () => {
    expect(isValidPhone('123')).toBe(false)            // too short
    expect(isValidPhone('+0123456789')).toBe(false)    // leading 0 after +
    expect(isValidPhone('hello')).toBe(false)
    expect(isValidPhone('+12')).toBe(false)            // too few digits
  })

  it('stripPhone keeps only digits + optional leading +', () => {
    expect(stripPhone('06 12 34 56 78')).toBe('0612345678')
    expect(stripPhone('+33 (0)6 12 34 56 78')).toBe('+330612345678')
    expect(stripPhone('  06.12-34.56 78  ')).toBe('0612345678')
  })

  it('formatPhone groups French national as 5×2', () => {
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78')
    expect(formatPhone('06.12.34.56.78')).toBe('06 12 34 56 78')
  })

  it('formatPhone groups French E.164 with country prefix', () => {
    expect(formatPhone('+33612345678')).toBe('+33 6 12 34 56 78')
  })

  it('formatPhone returns empty for nullish input', () => {
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
    expect(formatPhone('')).toBe('')
  })

  it('formatPhone falls back to stripped form for unknown shapes', () => {
    // Out-of-range length: just return the stripped form, the validator will flag it
    expect(formatPhone('12345')).toBe('12345')
  })
})
