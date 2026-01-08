import { Capacitor } from '@capacitor/core'
import { useMemo } from 'react'

export function usePlatform() {
  const isMobile = useMemo(() => Capacitor.isNativePlatform(), [])
  const isWeb = useMemo(() => !Capacitor.isNativePlatform(), [])
  const platform = useMemo(() => Capacitor.getPlatform(), [])

  return {
    isMobile,
    isWeb,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android'
  }
}
