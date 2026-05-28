import { z } from 'zod'

export const Position = z.object({
  x: z.number(),
  y: z.number()
})
export type Position = z.infer<typeof Position>

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  daysAfter: z.number().int().min(0)
})
export type GraphEdge = z.infer<typeof GraphEdge>
