'use client'

import { useUIStore } from '@/stores/useUIStore'
import NewTripModal from '@/components/trips/NewTripModal'
import NewTemplateModal from '@/components/template/NewTemplateModal'
import EditTemplateModal from '@/components/template/EditTemplateModal'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

export default function GlobalModals() {
    const { 
        isNewTripModalOpen, setIsNewTripModalOpen,
        isNewTemplateModalOpen, setIsNewTemplateModalOpen,
        isEditTemplateModalOpen, setIsEditTemplateModalOpen,
        editingTemplateId, setEditingTemplateId,
        isTripSwitcherOpen
    } = useUIStore()
    const isAnyModalOpen = useMemo(() => 
        isNewTripModalOpen || isNewTemplateModalOpen || isEditTemplateModalOpen || isTripSwitcherOpen,
    [isNewTripModalOpen, isNewTemplateModalOpen, isEditTemplateModalOpen, isTripSwitcherOpen])

    useScrollLock(isAnyModalOpen)
    const router = useRouter()

    return (
        <>
            <NewTripModal 
                isOpen={isNewTripModalOpen}
                onClose={() => setIsNewTripModalOpen(false)}
                onSuccess={() => {
                    router.refresh()
                }}
            />

            <NewTemplateModal
                isOpen={isNewTemplateModalOpen}
                onClose={() => setIsNewTemplateModalOpen(false)}
                onSuccess={() => {
                    router.refresh()
                }}
            />

            <EditTemplateModal
                isOpen={isEditTemplateModalOpen}
                onClose={() => {
                    setIsEditTemplateModalOpen(false)
                    setEditingTemplateId(null)
                }}
                templateId={editingTemplateId}
                onSuccess={() => {
                    router.refresh()
                }}
            />
        </>
    )
}
