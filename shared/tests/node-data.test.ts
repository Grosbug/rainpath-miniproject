import { describe, it, expect } from 'vitest'
import { OutputConfig } from '../src/schemas/output-config'
import { NodeData, EmailParams, SmsParams, WhatsAppParams, PostalParams, ConditionParams } from '../src/schemas/node-data'
import { GraphNode, Graph } from '../src/schemas/primitives'

describe('OutputConfig', () => {
  it('parses single mode', () => {
    expect(OutputConfig.parse({ mode: 'single' }).mode).toBe('single')
  })
  it('parses simple mode with successCondition', () => {
    const out = OutputConfig.parse({
      mode: 'simple',
      successCondition: { statuses: ['delivered', 'opened'] }
    })
    expect(out.mode).toBe('simple')
  })
  it('parses multi mode with outputs', () => {
    const out = OutputConfig.parse({
      mode: 'multi',
      outputs: [
        { id: 'engaged', label: 'Engagé', condition: { statuses: ['opened'] } },
        { id: 'rejected', label: 'Rejeté', condition: { statuses: ['bounced'] } }
      ]
    })
    expect(out.mode).toBe('multi')
    if (out.mode === 'multi') expect(out.outputs.length).toBe(2)
  })
  it('rejects empty multi outputs', () => {
    expect(() => OutputConfig.parse({ mode: 'multi', outputs: [] })).toThrow()
  })
  it('rejects empty successCondition statuses', () => {
    expect(() => OutputConfig.parse({ mode: 'simple', successCondition: { statuses: [] } })).toThrow()
  })
})

describe('EmailParams', () => {
  it('caps subject at 78 chars', () => {
    expect(() => EmailParams.parse({
      subject: 'a'.repeat(79),
      body: 'ok',
      output: { mode: 'single' }
    })).toThrow()
  })
  it('caps body at 100_000 chars', () => {
    expect(() => EmailParams.parse({
      subject: '',
      body: 'a'.repeat(100_001),
      output: { mode: 'single' }
    })).toThrow()
  })
  it('accepts a valid email params', () => {
    expect(EmailParams.parse({
      subject: 'Relance',
      body: 'Bonjour…',
      output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
    })).toMatchObject({ subject: 'Relance' })
  })
})

describe('SmsParams', () => {
  it('caps body at 459', () => {
    expect(() => SmsParams.parse({
      body: 'a'.repeat(460),
      output: { mode: 'single' }
    })).toThrow()
  })
})

describe('WhatsAppParams', () => {
  it('caps body at 4096', () => {
    expect(() => WhatsAppParams.parse({
      body: 'a'.repeat(4097),
      output: { mode: 'single' }
    })).toThrow()
  })
})

describe('PostalParams', () => {
  it('has tracked field', () => {
    expect(PostalParams.parse({
      body: 'lettre',
      tracked: true,
      output: { mode: 'single' }
    }).tracked).toBe(true)
  })
})

describe('ConditionParams', () => {
  it('accepts data_available with patient.email', () => {
    expect(ConditionParams.parse({
      conditionType: 'data_available',
      expression: 'patient.email'
    }).conditionType).toBe('data_available')
  })
  it('rejects unknown conditionType', () => {
    expect(() => ConditionParams.parse({
      conditionType: 'other',
      expression: 'x'
    })).toThrow()
  })
})

describe('NodeData', () => {
  it('parses start node', () => {
    expect(NodeData.parse({ kind: 'start' }).kind).toBe('start')
  })
  it('parses end node', () => {
    expect(NodeData.parse({ kind: 'end' }).kind).toBe('end')
  })
  it('parses send_email node with params', () => {
    const n = NodeData.parse({
      kind: 'send_email',
      params: { subject: '', body: '', output: { mode: 'single' } }
    })
    expect(n.kind).toBe('send_email')
  })
})

describe('GraphNode', () => {
  it('parses a valid node', () => {
    expect(GraphNode.parse({
      id: 'n1',
      position: { x: 0, y: 200 },
      data: { kind: 'start' }
    }).id).toBe('n1')
  })
})

describe('Graph', () => {
  it('parses empty nodes/edges arrays', () => {
    expect(Graph.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
  })
})
