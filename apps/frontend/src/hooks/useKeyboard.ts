import { useState, useEffect, useContext, createContext, ReactNode, createElement } from 'react'
import { Capacitor } from '@capacitor/core'

interface KeyboardState {
  isKeyboardOpen: boolean
  keyboardHeight: number
}

const KeyboardContext = createContext<KeyboardState>({ isKeyboardOpen: false, keyboardHeight: 0 })

const isInputElement = (el: Element | null): boolean => {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return type === 'text' || type === 'email' || type === 'password' ||
      type === 'search' || type === 'tel' || type === 'url' || type === 'number' ||
      type === 'date' || type === 'time' || type === ''
  }
  return tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const isKeyboardOpen = keyboardHeight > 0

  useEffect(() => {
    // Skip keyboard detection on web — no virtual keyboard
    if (!Capacitor.isNativePlatform()) return

    let inputFocused = false
    let fullHeight = window.innerHeight

    const recalculate = () => {
      if (!inputFocused) {
        setKeyboardHeight(0)
        return
      }

      // Method 1: body height (Capacitor resize:"body" sets document.body.style.height)
      const bodyHeight = document.body.clientHeight
      const bodyDiff = fullHeight - bodyHeight

      if (bodyHeight > 0 && bodyDiff > 100) {
        setKeyboardHeight(Math.round(bodyDiff))
        return
      }

      // Method 2: visualViewport
      const vv = window.visualViewport
      if (vv) {
        const vvDiff = fullHeight - vv.height
        if (vvDiff > 100) {
          setKeyboardHeight(Math.round(vvDiff))
          return
        }
      }

      // Fallback
      setKeyboardHeight(300)
    }

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element
      if (isInputElement(target)) {
        inputFocused = true
        setTimeout(recalculate, 300)
      }
    }

    const onFocusOut = () => {
      setTimeout(() => {
        if (!isInputElement(document.activeElement)) {
          inputFocused = false
          setKeyboardHeight(0)
          window.scrollTo(0, 0)
        }
      }, 100)
    }

    // Watch body resize (Capacitor resize:"body" changes body height)
    const resizeObserver = new ResizeObserver(() => {
      recalculate()
    })
    resizeObserver.observe(document.body)

    // Watch visualViewport
    const vv = window.visualViewport
    const onViewportResize = () => {
      if (vv) {
        if (vv.height > fullHeight) {
          fullHeight = vv.height
        }
        recalculate()
      }
    }

    // Listen on capture phase so we get the event even if something stops propagation
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    if (vv) {
      vv.addEventListener('resize', onViewportResize)
    }

    // Also listen for native Capacitor keyboard events on window (fired by plugin)
    const onNativeShow = () => {}
    const onNativeHide = () => {}
    window.addEventListener('keyboardWillShow', onNativeShow)
    window.addEventListener('keyboardWillHide', onNativeHide)

    return () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      resizeObserver.disconnect()
      if (vv) {
        vv.removeEventListener('resize', onViewportResize)
      }
      window.removeEventListener('keyboardWillShow', onNativeShow)
      window.removeEventListener('keyboardWillHide', onNativeHide)
    }
  }, [])

  // Set CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`)
  }, [keyboardHeight])

  // Scroll focused input into view when keyboard opens
  useEffect(() => {
    if (!isKeyboardOpen) return

    const timer = setTimeout(() => {
      const active = document.activeElement as HTMLElement
      if (active && isInputElement(active)) {
        active.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [isKeyboardOpen])

  return createElement(KeyboardContext.Provider, { value: { isKeyboardOpen, keyboardHeight } }, children)
}

export function useKeyboard(): KeyboardState {
  return useContext(KeyboardContext)
}
