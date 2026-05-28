export type GraphErrorItem = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  path?: (string | number)[]
}

export type GraphWarning = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  missingStatuses?: string[]
}

/**
 * Thrown by services when `validateGraph` reports errors. Caught by ZodExceptionFilter
 * and turned into a structured 422 response.
 */
export class GraphValidationError extends Error {
  constructor(
    public readonly errors: GraphErrorItem[],
    public readonly warnings: GraphWarning[] = []
  ) {
    super('Graph validation failed')
    this.name = 'GraphValidationError'
  }
}
