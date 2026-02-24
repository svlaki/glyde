import { useState, useEffect, useRef } from 'react'

interface GeoPosition {
  latitude: number
  longitude: number
}

/**
 * Browser geolocation hook using navigator.geolocation.
 * Requests permission on mount, caches last known position.
 * Returns null if permission denied or unavailable.
 */
export function useGeolocation(): GeoPosition | null {
  const [position, setPosition] = useState<GeoPosition | null>(() => {
    // Restore cached position from sessionStorage
    try {
      const cached = sessionStorage.getItem('glydee_geolocation')
      if (cached) return JSON.parse(cached)
    } catch { /* ignore */ }
    return null
  })
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return

    const onSuccess = (pos: GeolocationPosition) => {
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }
      setPosition(coords)
      try {
        sessionStorage.setItem('glydee_geolocation', JSON.stringify(coords))
      } catch { /* ignore */ }
    }

    const onError = (err: GeolocationPositionError) => {
      // Permission denied or unavailable - keep cached value if any
      console.warn('Geolocation error:', err.message)
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 min cache
    })

    // Watch for updates (low frequency)
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000,
    })

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return position
}
