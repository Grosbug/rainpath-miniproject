import { describe, expect, it } from 'vitest'
import {
  formatFirstName,
  formatLastName,
  formatPatientDisplayName,
  formatPatientFullName,
  normalizePatientNameFields
} from './format-person-name'

describe('format-person-name', () => {
  it('capitalizes first names and uppercases last names', () => {
    expect(formatFirstName('jean-marc')).toBe('Jean-Marc')
    expect(formatLastName('durand')).toBe('DURAND')
    expect(formatPatientFullName({ firstName: 'alice', lastName: 'durand' })).toBe('Alice DURAND')
  })

  it('formats pre-composed display names', () => {
    expect(formatPatientDisplayName('alice durand')).toBe('Alice DURAND')
  })

  it('normalizes fields for persistence', () => {
    expect(normalizePatientNameFields({ firstName: '  bruno ', lastName: ' martin ' })).toEqual({
      firstName: 'Bruno',
      lastName: 'MARTIN'
    })
  })
})
