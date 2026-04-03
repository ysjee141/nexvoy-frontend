'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ChecklistRedirect() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const id = searchParams.get('id')

    useEffect(() => {
        if (id) {
            router.replace(`/trips/detail?id=${id}&tab=checklist`)
        } else {
            router.replace('/')
        }
    }, [id, router])

    return null
}

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ChecklistRedirect />
        </Suspense>
    )
}
