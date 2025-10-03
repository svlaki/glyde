import * as React from "react"
import { createContext, useContext, useState, useCallback } from "react"

export type ToastVariant = 'default' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (props: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((props: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      variant: 'default',
      ...props,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss after duration
    if (newToast.duration) {
      setTimeout(() => {
        dismiss(id)
      }, newToast.duration)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[], onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-0 right-0 z-modal p-4 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastComponent({ toast, onDismiss }: { toast: Toast, onDismiss: (id: string) => void }) {
  const variantStyles = {
    default: 'bg-neutral-900 text-white border-neutral-800',
    success: 'bg-success-600 text-white border-success-700',
    warning: 'bg-warning-600 text-white border-warning-700',
    error: 'bg-error-600 text-white border-error-700',
  }

  const variantIcons = {
    default: '🔔',
    success: '✓',
    warning: '⚠',
    error: '✕',
  }

  return (
    <div
      className={`
        ${variantStyles[toast.variant || 'default']}
        rounded-lg p-4 shadow-xl border
        animate-slide-up
        flex items-start gap-3
      `}
    >
      <span className="text-xl">{variantIcons[toast.variant || 'default']}</span>
      <div className="flex-1">
        {toast.title && (
          <div className="font-semibold text-sm mb-1">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/70 hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
