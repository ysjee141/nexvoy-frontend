import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'loading'

interface Toast {
    id: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastState {
    toasts: Toast[]
    addToast: (message: string, type?: ToastType, duration?: number) => string
    removeToast: (id: string) => void
    success: (message: string, duration?: number) => string
    error: (message: string, duration?: number) => string
    info: (message: string, duration?: number) => string
    loading: (message: string) => string
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    addToast: (message, type = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newToast = { id, message, type, duration }
        
        set((state) => ({ toasts: [...state.toasts, newToast] }))

        if (type !== 'loading') {
            setTimeout(() => {
                get().removeToast(id)
            }, duration)
        }

        return id
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }))
    },
    success: (message, duration) => get().addToast(message, 'success', duration),
    error: (message, duration) => get().addToast(message, 'error', duration),
    info: (message, duration) => get().addToast(message, 'info', duration),
    loading: (message) => get().addToast(message, 'loading', 0),
}))
