import { Suspense } from 'react'
import ClientPage from './TemplateClient'

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientPage />
        </Suspense>
    )
}
