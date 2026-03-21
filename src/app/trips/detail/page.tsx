import { Suspense } from 'react'
import TripLayoutClient from './TripLayoutClient'

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TripLayoutClient />
        </Suspense>
    )
}
