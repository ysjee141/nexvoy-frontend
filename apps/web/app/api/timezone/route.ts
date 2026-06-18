import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    // timestamp required by Time Zone API (seconds since epoch)
    const timestamp = searchParams.get('timestamp') || Math.floor(Date.now() / 1000)

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        console.error("Missing Google Maps API Key")
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        const data = await res.json()

        if (data.status !== 'OK') {
            console.error("Google Time Zone API Error:", data)
            return NextResponse.json({ error: data.errorMessage || data.status }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        console.error("Fetch Exception:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
