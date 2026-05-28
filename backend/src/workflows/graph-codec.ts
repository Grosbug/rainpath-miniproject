import { Graph } from '@rainpath/shared'
import { InternalServerErrorException } from '@nestjs/common'

/** Serialize a validated Graph for storage in SQLite `String` column. */
export function encodeGraph(graph: Graph): string {
  return JSON.stringify(graph)
}

/**
 * Parse a stored graph string. Throws 500 on drift / corruption (spec §5.3).
 * The caller MUST have stored a Zod-validated graph at write time.
 */
export function decodeGraph(raw: string, workflowId: string): Graph {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new InternalServerErrorException(
      `Workflow ${workflowId} graph blob is not valid JSON`
    )
  }
  const result = Graph.safeParse(parsed)
  if (!result.success) {
    throw new InternalServerErrorException(
      `Workflow ${workflowId} graph failed schema validation: ${result.error.issues
        .slice(0, 3)
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    )
  }
  return result.data
}
