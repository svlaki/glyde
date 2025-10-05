const DEFAULT_AGENT_SERVICE_URL = 'http://localhost:8000'

/**
 * Returns the configured agent service base URL, defaulting to the local development value.
 * Trims any accidental whitespace to ensure consistent fetch requests across the app.
 */
export function getAgentServiceUrl(): string {
  const configuredUrl = import.meta.env.VITE_AGENT_SERVICE_URL

  if (typeof configuredUrl === 'string' && configuredUrl.trim().length > 0) {
    return configuredUrl.trim()
  }

  return DEFAULT_AGENT_SERVICE_URL
}

export { DEFAULT_AGENT_SERVICE_URL }
