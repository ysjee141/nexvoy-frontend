'use client'

import { useUIStore } from '@/stores/useUIStore'
import NewTripModal from '@/components/trips/NewTripModal'
import { useRouter } from 'next/navigation'

export default function GlobalModals() {
    const { isNewTripModalOpen, setIsNewTripModalOpen } = useUIStore()
    const router = useRouter()

    return (
        <>
            <NewTripModal 
                isOpen={isNewTripModalOpen}
                onClose={() => setIsNewTripModalOpen(false)}
                onSuccess={() => {
                    // 전역적인 성공 처리 (필요시)
                    router.refresh()
                }}
            />
        </>
    )
}
