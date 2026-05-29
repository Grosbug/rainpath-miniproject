import { z } from 'zod'

export const OutputCondition = z.object({
  statuses: z.array(z.string().min(1)).min(1)
})
export type OutputCondition = z.infer<typeof OutputCondition>

const SimpleOutput = z.object({
  mode: z.literal('simple'),
  successCondition: OutputCondition
})

const MultiOutput = z.object({
  mode: z.literal('multi'),
  outputs: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    condition: OutputCondition
  })).min(1)
})

export const OutputConfig = z.discriminatedUnion('mode', [SimpleOutput, MultiOutput])
export type OutputConfig = z.infer<typeof OutputConfig>
