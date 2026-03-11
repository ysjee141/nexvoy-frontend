import { Suspense } from 'react'
import ClientPage from './ShareClient'

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientPage />
        </Suspense>
    )
}
