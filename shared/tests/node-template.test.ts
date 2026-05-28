import { describe, it, expect } from 'vitest'
import { NodeTemplate, NodeTemplateBody, NodeTemplateKind } from '../src/schemas/node-template'
import { CreateWorkflowDto, UpdateWorkflowDto } from '../src/schemas/api-dtos'

describe('NodeTemplateKind', () => {
  it('lists exactly send_* and condition (no start/end)', () => {
    expect(() => NodeTemplateKind.parse('start')).toThrow()
    expect(() => NodeTemplateKind.parse('end')).toThrow()
    expect(NodeTemplateKind.parse('send_email')).toBe('send_email')
    expect(NodeTemplateKind.parse('condition')).toBe('condition')
  })
})

describe('NodeTemplateBody', () => {
  it('parses a valid send_email template body', () => {
    expect(NodeTemplateBody.parse({
      kind: 'send_email',
      params: {
        subject: 'Hello',
        body: 'Bonjour',
        output: { mode: 'single' }
      }
    }).kind).toBe('send_email')
  })
  it('rejects wrong params for kind', () => {
    expect(() => NodeTemplateBody.parse({
      kind: 'send_sms',
      params: { subject: 'x' /* sms has no subject */ }
    })).toThrow()
  })
})

describe('NodeTemplate', () => {
  it('parses a full template with metadata', () => {
    const t = NodeTemplate.parse({
      id: 't1',
      name: 'Email première relance',
      kind: 'send_email',
      params: {
        subject: 'Sujet',
        body: '',
        output: { mode: 'single' }
      },
      createdAt: '2026-05-28T00:00:00.000Z',
      updatedAt: '2026-05-28T00:00:00.000Z'
    })
    expect(t.name).toBe('Email première relance')
  })
})

describe('CreateWorkflowDto', () => {
  it('accepts {name} alone', () => {
    expect(CreateWorkflowDto.parse({ name: 'My Workflow' }).name).toBe('My Workflow')
  })
  it('accepts {name, description}', () => {
    expect(CreateWorkflowDto.parse({
      name: 'wf', description: 'desc'
    }).description).toBe('desc')
  })
  it('accepts optional graph for import', () => {
    expect(CreateWorkflowDto.parse({
      name: 'imported',
      graph: { nodes: [], edges: [] }
    }).graph).toEqual({ nodes: [], edges: [] })
  })
  it('rejects empty name', () => {
    expect(() => CreateWorkflowDto.parse({ name: '' })).toThrow()
  })
})

describe('UpdateWorkflowDto', () => {
  it('accepts partial', () => {
    expect(UpdateWorkflowDto.parse({}).name).toBeUndefined()
    expect(UpdateWorkflowDto.parse({ name: 'new' }).name).toBe('new')
  })
})
