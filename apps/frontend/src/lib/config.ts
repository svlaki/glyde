/**
 * Shared configuration helpers for accessing environment-specific values.
 * Centralising this logic prevents each module from re-implementing fallbacks
 * or accidentally introducing subtle differences in URL handling.
 */

let cachedAgentServiceUrl: string | null = null

/**
 * Returns the configured agent service base URL with a sensible fallback.
 * The value is cached to avoid repeated string work during render loops.
 */
export function getAgentServiceUrl(): string {
  if (cachedAgentServiceUrl) {
    return cachedAgentServiceUrl
  }

  const rawValue = (import.meta.env?.VITE_AGENT_SERVICE_URL as string | undefined)?.trim()
  const normalised = rawValue && rawValue.length > 0 ? rawValue : 'http://localhost:8000'

  // Ensure we do not end up with a trailing slash to simplify path joining.
  cachedAgentServiceUrl = normalised.replace(/\/$/, '')
  return cachedAgentServiceUrl
}

/**
 * Builds a URL for the agent service ensuring relative paths are handled.
 */
export function buildAgentServiceUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const baseUrl = getAgentServiceUrl()
  const normalisedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalisedPath}`
}
