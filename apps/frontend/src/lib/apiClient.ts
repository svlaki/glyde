import { buildAgentServiceUrl } from './config'

const DEFAULT_TIMEOUT_MS = 15000

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Optional body. Plain objects are serialised to JSON automatically. */
  body?: BodyInit | Record<string, unknown> | null
  /** Abort the request after a period. Defaults to 15 seconds. */
  timeoutMs?: number
  /** Override the base URL – useful for absolute URLs or testing. */
  baseUrl?: string
}

export interface ApiResult<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
  rawBody?: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

function resolveUrl(path: string, baseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  if (baseUrl) {
    const normalisedBase = baseUrl.replace(/\/$/, '')
    const normalisedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalisedBase}${normalisedPath}`
  }

  return buildAgentServiceUrl(path)
}

export async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, baseUrl, body, headers, ...rest } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  let abortListener: (() => void) | undefined
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      abortListener = () => controller.abort(signal.reason)
      signal.addEventListener('abort', abortListener)
    }
  }

  try {
    const finalHeaders = new Headers(headers)
    let finalBody: BodyInit | undefined

    if (body == null) {
      finalBody = undefined
    } else if (isPlainObject(body)) {
      if (!finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json')
      }
      finalBody = JSON.stringify(body)
    } else {
      finalBody = body as BodyInit
    }

    const url = resolveUrl(path, baseUrl)
    const response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: finalBody,
      signal: controller.signal
    })

    const text = await response.text()
    let parsedBody: unknown = undefined

    if (text) {
      try {
        parsedBody = JSON.parse(text)
      } catch {
        parsedBody = text
      }
    }

    if (!response.ok) {
      const errorMessage = deriveErrorMessage(parsedBody, response.status, response.statusText)
      return { ok: false, status: response.status, error: errorMessage, rawBody: parsedBody }
    }

    return { ok: true, status: response.status, data: parsedBody as T, rawBody: parsedBody }
  } catch (error) {
    const message = (error as any)?.name === 'AbortError'
      ? 'Request timed out'
      : error instanceof Error
        ? error.message
        : 'Network error'

    return { ok: false, status: 0, error: message }
  } finally {
    clearTimeout(timeoutId)
    if (abortListener && signal) {
      signal.removeEventListener('abort', abortListener)
    }
  }
}

function deriveErrorMessage(body: unknown, status: number, statusText: string): string {
  if (!body) {
    return `Request failed with status ${status}`
  }

  if (typeof body === 'string') {
    return body
  }

  if (typeof body === 'object') {
    if ('error' in body && typeof (body as any).error === 'string') {
      return (body as any).error
    }
    if ('message' in body && typeof (body as any).message === 'string') {
      return (body as any).message
    }
  }

  return `Request failed with status ${status} (${statusText})`
}

export async function get<T>(path: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
  return request<T>(path, { ...options, method: 'GET' })
}

export async function post<T>(
  path: string,
  body?: ApiRequestOptions['body'],
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
) {
  return request<T>(path, { ...options, method: 'POST', body })
}
