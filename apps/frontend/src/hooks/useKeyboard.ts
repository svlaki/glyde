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

    // DEBUG: log to confirm the effect ran — check Safari Web Inspector console
    console.log('[useKeyboard] effect mounted, setting up listeners')
    console.log('[useKeyboard] ontouchstart:', 'ontouchstart' in window)
    console.log('[useKeyboard] maxTouchPoints:', navigator.maxTouchPoints)

    let inputFocused = false
    let fullHeight = window.innerHeight
    console.log('[useKeyboard] initial fullHeight:', fullHeight)

    const recalculate = () => {
      if (!inputFocused) {
        setKeyboardHeight(0)
        return
      }

      // Method 1: body height (Capacitor resize:"body" sets document.body.style.height)
      const bodyHeight = document.body.clientHeight
      const bodyDiff = fullHeight - bodyHeight
      console.log('[useKeyboard] recalc — bodyHeight:', bodyHeight, 'fullHeight:', fullHeight, 'diff:', bodyDiff)

      if (bodyHeight > 0 && bodyDiff > 100) {
        console.log('[useKeyboard] detected via body resize:', bodyDiff)
        setKeyboardHeight(Math.round(bodyDiff))
        return
      }

      // Method 2: visualViewport
      const vv = window.visualViewport
      if (vv) {
        const vvDiff = fullHeight - vv.height
        console.log('[useKeyboard] vv.height:', vv.height, 'diff:', vvDiff)
        if (vvDiff > 100) {
          console.log('[useKeyboard] detected via visualViewport:', vvDiff)
          setKeyboardHeight(Math.round(vvDiff))
          return
        }
      }

      // Fallback
      console.log('[useKeyboard] using 300px fallback')
      setKeyboardHeight(300)
    }

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element
      console.log('[useKeyboard] focusin:', target?.tagName, (target as HTMLInputElement)?.type)
      if (isInputElement(target)) {
        inputFocused = true
        console.log('[useKeyboard] input focused, will recalculate in 300ms')
        setTimeout(recalculate, 300)
      }
    }

    const onFocusOut = () => {
      console.log('[useKeyboard] focusout')
      setTimeout(() => {
        if (!isInputElement(document.activeElement)) {
          console.log('[useKeyboard] no input focused, closing keyboard state')
          inputFocused = false
          setKeyboardHeight(0)
          window.scrollTo(0, 0)
        } else {
          console.log('[useKeyboard] focus moved to another input, keeping open')
        }
      }, 100)
    }

    // Watch body resize (Capacitor resize:"body" changes body height)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log('[useKeyboard] body resized:', entry.contentRect.height)
      }
      recalculate()
    })
    resizeObserver.observe(document.body)

    // Watch visualViewport
    const vv = window.visualViewport
    const onViewportResize = () => {
      if (vv) {
        console.log('[useKeyboard] visualViewport resize:', vv.height)
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
    const onNativeShow = (e: Event) => {
      console.log('[useKeyboard] native keyboardWillShow event:', e)
    }
    const onNativeHide = () => {
      console.log('[useKeyboard] native keyboardWillHide event')
    }
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
