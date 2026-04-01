import { create } from 'zustand'

interface UIState {
    mobileTitle: string | null
    setMobileTitle: (title: string | null) => void
    isTripSwitcherOpen: boolean
    setIsTripSwitcherOpen: (isOpen: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
    mobileTitle: null,
    setMobileTitle: (title) => set({ mobileTitle: title }),
    isTripSwitcherOpen: false,
    setIsTripSwitcherOpen: (isOpen) => set({ isTripSwitcherOpen: isOpen }),
}))
