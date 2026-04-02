'use client'

import { Suspense } from 'react'
import ClientPage from './TemplateClient'
import { TemplateFormSkeleton } from '@/components/template/TemplateFormSkeleton'

export default function Page() {
    return (
        <Suspense fallback={<TemplateFormSkeleton />}>
            <ClientPage initialData={null} />
        </Suspense>
    )
}
