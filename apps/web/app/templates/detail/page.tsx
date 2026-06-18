'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TemplateDetailRedirect() {
    const router = useRouter()
    
    useEffect(() => {
        router.replace('/templates')
    }, [router])

    return null
}
