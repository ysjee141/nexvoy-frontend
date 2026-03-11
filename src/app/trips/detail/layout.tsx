import { Suspense } from 'react'
import TripLayoutClient from './TripLayoutClient'

export default function TripLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div>Loading Layout...</div>}>
            <TripLayoutClient>
                {children}
            </TripLayoutClient>
        </Suspense>
    )
}
