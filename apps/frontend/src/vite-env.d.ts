/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_SERVICE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ElectronAPI {
  isElectron: boolean
  platform: 'darwin' | 'win32' | 'linux'
  onOAuthCallback: (callback: (params: string) => void) => void
  showNotification: (title: string, body: string) => void
}

interface Window {
  electronAPI?: ElectronAPI
}
