import { z } from 'zod'
import { NodeData } from './node-data'

export const Position = z.object({
  x: z.number(),
  y: z.number()
})
export type Position = z.infer<typeof Position>

export const GraphNode = z.object({
  id: z.string(),
  position: Position,
  data: NodeData
})
export type GraphNode = z.infer<typeof GraphNode>

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  daysAfter: z.number().int().min(0)
})
export type GraphEdge = z.infer<typeof GraphEdge>

export const Graph = z.object({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge)
})
export type Graph = z.infer<typeof Graph>
