interface ElectronAPI {
  isElectron: boolean
  platform: 'darwin' | 'win32' | 'linux'
  onOAuthCallback: (callback: (params: string) => void) => void
  showNotification: (title: string, body: string) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
