import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('placeId')
    const maxwidth = searchParams.get('maxwidth') || '400'

    if (!placeId) {
        return NextResponse.json({ error: 'Missing placeId' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    try {
        // 1. Places Details REST API로 photo_reference 조회
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`
        const detailsRes = await fetch(detailsUrl, { next: { revalidate: 3600 } })
        const detailsData = await detailsRes.json()

        if (detailsData.status !== 'OK' || !detailsData.result?.photos?.length) {
            return NextResponse.json({ url: null, photoReference: null })
        }

        const photoRef: string = detailsData.result.photos[0].photo_reference

        // 2. Places Photo URL로 리다이렉트를 따라가 영구 CDN URL 획득 (미리보기용)
        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photoRef}&key=${apiKey}`
        const photoRes = await fetch(photoApiUrl, { redirect: 'manual', next: { revalidate: 3600 } })
        const finalUrl = photoRes.headers.get('location')

        // photoReference는 클라이언트가 plans INSERT 시 함께 저장해야 함 (영구 저장 키)
        return NextResponse.json({
            url: finalUrl || photoApiUrl,
            photoReference: photoRef,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[places/photo] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
