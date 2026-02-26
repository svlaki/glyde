import { Capacitor } from '@capacitor/core'
import { useMemo } from 'react'

function detectElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron
}

export function usePlatform() {
  const isMobile = useMemo(() => Capacitor.isNativePlatform(), [])
  const isElectron = useMemo(() => detectElectron(), [])
  const isWeb = useMemo(() => !Capacitor.isNativePlatform() && !detectElectron(), [])
  const isDesktop = useMemo(() => detectElectron(), [])
  const platform = useMemo(() => Capacitor.getPlatform(), [])
  const electronPlatform = useMemo(
    () => (detectElectron() ? window.electronAPI!.platform : null),
    []
  )

  return {
    isMobile,
    isWeb,
    isElectron,
    isDesktop,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isMacOS: electronPlatform === 'darwin',
    isWindows: electronPlatform === 'win32',
    isLinux: electronPlatform === 'linux'
  }
}
