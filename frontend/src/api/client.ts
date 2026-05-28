const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

export type ApiErrorBody = {
  statusCode?: number
  errors?: Array<{ code: string; message: string; path?: (string | number)[]; nodeId?: string; edgeId?: string }>
  warnings?: Array<{ code: string; message: string; nodeId?: string; edgeId?: string; missingStatuses?: string[] }>
  message?: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
    message?: string
  ) {
    super(message ?? body.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json' }
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)

  const res = await fetch(`${BASE_URL}${path}`, init)

  if (res.status === 204) {
    return undefined as T
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
  const payload: unknown = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    const body = (isJson ? payload : { message: String(payload) }) as ApiErrorBody
    throw new ApiError(res.status, body)
  }

  return payload as T
}
