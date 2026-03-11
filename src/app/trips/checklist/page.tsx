import { Suspense } from 'react'
import ClientPage from './ChecklistClient'

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientPage />
        </Suspense>
    )
}
