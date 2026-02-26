import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  onOAuthCallback: (callback: (params: string) => void): void => {
    ipcRenderer.on('oauth-callback', (_event, params: string) => {
      callback(params)
    })
  },

  showNotification: (title: string, body: string): void => {
    // Use the web Notification API (works natively in Electron's renderer)
    new globalThis.Notification(title, { body })
  }
})
