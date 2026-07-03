import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        console.error('Missing Google Maps API Key')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=ko&key=${apiKey}`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        const data = await res.json()

        if (data.status !== 'OK') {
            console.error('Google Geocoding API Error:', data)
            return NextResponse.json({ error: data.error_message || data.status }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[geocode] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
