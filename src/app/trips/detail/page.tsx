import { Suspense } from 'react'
import ClientPage from './TripClient'

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientPage />
        </Suspense>
    )
}
