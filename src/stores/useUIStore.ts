import { create } from 'zustand'

interface UIState {
    mobileTitle: string | null
    setMobileTitle: (title: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
    mobileTitle: null,
    setMobileTitle: (title) => set({ mobileTitle: title }),
}))
