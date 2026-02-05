import { Capacitor } from '@capacitor/core'

/**
 * Get the appropriate API URL based on the platform and environment
 *
 * - Web development: Uses localhost
 * - iOS Simulator: Uses localhost
 * - iOS Device: Uses local network IP (must match your computer's IP)
 * - Production: Uses production API URL
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_AGENT_SERVICE_URL

  // If explicit URL is set, use it
  if (envUrl) {
    return envUrl
  }

  // Fallback logic based on platform
  if (Capacitor.isNativePlatform()) {
    // On native platforms (iOS/Android), we can't use localhost
    // This should be set via environment variable
    console.warn('VITE_AGENT_SERVICE_URL not set. Native apps require explicit backend URL.')
    return 'http://localhost:8000' // This won't work, but prevents crashes
  }

  // Web fallback
  return 'http://localhost:8000'
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration. Check your .env file.')
  }

  return { url, anonKey }
}

/**
 * Get Google OAuth client ID
 */
export function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID in .env file')
  }

  return clientId
}
