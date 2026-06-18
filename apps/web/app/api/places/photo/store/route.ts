import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

interface StoreRequestBody {
    planId?: string
    tripId?: string
    placeId?: string
    photoReference?: string | null
}

const PHOTO_MAX_WIDTH = 800
const STORAGE_BUCKET = 'place-photos'
const STORAGE_CONTENT_TYPE = 'image/jpeg'

/**
 * Google Places Details API로부터 photo_reference를 조회한다.
 * - 레거시 plan(photo_reference 컬럼이 null인 데이터) 자동 복구 fallback에 사용.
 * - 실패/photos 없음/non-OK status는 모두 null 반환 → 호출 측에서 410 처리.
 */
async function fetchPhotoReferenceByPlaceId(
    placeId: string,
    apiKey: string
): Promise<string | null> {
    const detailsUrl =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=photos` +
        `&language=ko` +
        `&key=${apiKey}`

    try {
        const res = await fetch(detailsUrl)
        if (!res.ok) {
            console.error(
                `[photo/store] Places Details HTTP ${res.status} for placeId lookup`
            )
            return null
        }
        const json = (await res.json()) as {
            status?: string
            result?: { photos?: Array<{ photo_reference?: string }> }
        }
        if (json.status !== 'OK') {
            console.warn(`[photo/store] Places Details status=${json.status}`)
            return null
        }
        const photoRef = json.result?.photos?.[0]?.photo_reference
        if (!photoRef) {
            return null
        }
        return photoRef
    } catch (err) {
        const message = err instanceof Error ? err.message : 'fetch failed'
        console.error('[photo/store] Places Details fetch failed:', message)
        return null
    }
}

function placeIdHash8(placeId: string): string {
    return createHash('sha256').update(placeId).digest('hex').slice(0, 8)
}

function buildStoragePath(userId: string, tripId: string, planId: string, placeId: string): string {
    return `${userId}/${tripId}/${planId}_${placeIdHash8(placeId)}.jpg`
}

export async function POST(request: NextRequest) {
    try {
        // 1) 요청 본문 파싱
        let body: StoreRequestBody
        try {
            body = (await request.json()) as StoreRequestBody
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { planId, tripId, placeId } = body
        // photoReference는 optional. 누락 시 placeId 기반 fallback으로 조회.
        let photoReference: string | null | undefined = body.photoReference
        if (!planId || !tripId || !placeId) {
            return NextResponse.json(
                { error: 'Missing required fields: planId, tripId, placeId' },
                { status: 400 }
            )
        }

        // 2) 인증 확인
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 3) 멤버십 검증
        //    plan이 존재하며 동일 trip_id에 속하고, 현재 사용자가 owner/editor 권한을 가진다.
        //    RLS만 의존하지 않고 service 레이어에서 명시 검증.
        const { data: planRow, error: planLookupError } = await supabase
            .from('plans')
            .select('id, trip_id')
            .eq('id', planId)
            .maybeSingle()

        if (planLookupError) {
            console.error('[places/photo/store] plan lookup failed:', planLookupError.message)
            return NextResponse.json({ error: 'Plan lookup failed' }, { status: 500 })
        }
        if (!planRow) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }
        if (planRow.trip_id !== tripId) {
            return NextResponse.json({ error: 'Trip mismatch' }, { status: 400 })
        }

        // 소유자 또는 멤버(편집자) 권한 검증.
        // 두 보조 함수를 RPC 호출하여 OR 조건을 평가한다.
        const [ownerResp, editorResp] = await Promise.all([
            supabase.rpc('check_is_trip_owner', { _trip_id: tripId, _user_id: user.id }),
            supabase.rpc('check_is_trip_editor', { _trip_id: tripId, _user_id: user.id }),
        ])
        if (ownerResp.error) {
            console.error('[places/photo/store] check_is_trip_owner failed:', ownerResp.error.message)
        }
        if (editorResp.error) {
            console.error('[places/photo/store] check_is_trip_editor failed:', editorResp.error.message)
        }
        const isOwner = ownerResp.data === true
        const isEditor = editorResp.data === true
        if (!isOwner && !isEditor) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 4) Google Maps API Key (서버 보유)
        //    Places Photo API는 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 사용하지만,
        //    가능하면 서버 전용 키를 분리해서 도메인 제약을 우회한다.
        const apiKey =
            process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // 4-b) photoReference fallback
        //      레거시 plan(photo_reference=null) 자동 복구: placeId로 Places Details API 호출하여
        //      photo_reference를 재조회한다. 조회 실패 시 410으로 반환하여 클라이언트는 만료 처리.
        if (!photoReference) {
            console.info('[photo/store] photoReference fallback via placeId', { planId })
            const recovered = await fetchPhotoReferenceByPlaceId(placeId, apiKey)
            if (!recovered) {
                return NextResponse.json(
                    { error: 'Photo reference unavailable' },
                    { status: 410 }
                )
            }
            photoReference = recovered
        }

        // 5) Google Photo CDN fetch
        //    Places Photo API는 302 리다이렉트 → 실제 CDN. fetch는 자동 follow.
        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${PHOTO_MAX_WIDTH}&photo_reference=${encodeURIComponent(
            photoReference
        )}&key=${apiKey}`

        let photoRes: Response
        try {
            photoRes = await fetch(photoApiUrl, { redirect: 'follow' })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'fetch failed'
            console.error('[places/photo/store] Google Photo fetch failed:', message)
            return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 })
        }

        // 403/410은 토큰 만료/거부 — 클라이언트가 photo_reference 무효화 처리해야 함
        if (photoRes.status === 403 || photoRes.status === 410) {
            console.warn(
                `[places/photo/store] Google Photo expired (status=${photoRes.status}) for plan=${planId}`
            )
            return NextResponse.json({ error: 'Photo reference expired' }, { status: 410 })
        }
        if (!photoRes.ok) {
            console.error(
                `[places/photo/store] Google Photo fetch returned ${photoRes.status} for plan=${planId}`
            )
            return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 })
        }

        const photoArrayBuffer = await photoRes.arrayBuffer()
        if (!photoArrayBuffer.byteLength) {
            return NextResponse.json({ error: 'Empty photo response' }, { status: 502 })
        }
        const photoBuffer = Buffer.from(photoArrayBuffer)

        // 6) Supabase Storage upload
        const storagePath = buildStoragePath(user.id, tripId, planId, placeId)
        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, photoBuffer, {
                contentType: STORAGE_CONTENT_TYPE,
                upsert: true,
                cacheControl: '31536000',
            })
        if (uploadError) {
            console.error('[places/photo/store] Storage upload failed:', uploadError.message)
            return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
        }

        // 7) publicUrl 획득
        const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath)
        const publicUrl = publicUrlData?.publicUrl
        if (!publicUrl) {
            console.error('[places/photo/store] getPublicUrl returned empty for', storagePath)
            return NextResponse.json({ error: 'Public URL generation failed' }, { status: 500 })
        }

        // 8) plans UPDATE { image_url, photo_reference }
        //    RLS 정책에 의해 권한이 있는 경우만 통과.
        const { error: updateError } = await supabase
            .from('plans')
            .update({ image_url: publicUrl, photo_reference: photoReference })
            .eq('id', planId)

        if (updateError) {
            console.error('[places/photo/store] plans UPDATE failed:', updateError.message)
            return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
        }

        return NextResponse.json({ imageUrl: publicUrl }, { status: 200 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[places/photo/store] Unhandled error:', message)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
