import { create } from 'zustand'

interface UIState {
    mobileTitle: string | null
    setMobileTitle: (title: string | null) => void
    isTripSwitcherOpen: boolean
    setIsTripSwitcherOpen: (isOpen: boolean) => void
    isNewTripModalOpen: boolean
    setIsNewTripModalOpen: (isOpen: boolean) => void
    
    // Checklist Template Modals
    isNewTemplateModalOpen: boolean
    setIsNewTemplateModalOpen: (isOpen: boolean) => void
    isEditTemplateModalOpen: boolean
    setIsEditTemplateModalOpen: (isOpen: boolean) => void
    editingTemplateId: string | null
    setEditingTemplateId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
    mobileTitle: null,
    setMobileTitle: (title) => set({ mobileTitle: title }),
    isTripSwitcherOpen: false,
    setIsTripSwitcherOpen: (isOpen) => set({ isTripSwitcherOpen: isOpen }),
    isNewTripModalOpen: false,
    setIsNewTripModalOpen: (isOpen) => set({ isNewTripModalOpen: isOpen }),

    // Checklist Template Modals
    isNewTemplateModalOpen: false,
    setIsNewTemplateModalOpen: (isOpen) => set({ isNewTemplateModalOpen: isOpen }),
    isEditTemplateModalOpen: false,
    setIsEditTemplateModalOpen: (isOpen) => set({ isEditTemplateModalOpen: isOpen }),
    editingTemplateId: null,
    setEditingTemplateId: (id) => set({ editingTemplateId: id }),
}))
