import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import {
  PLACE_PHOTO_ORIGINAL_WIDTH,
  PLACE_PHOTO_THUMB_WIDTH,
  placePhotoObjectPath,
  type PlacePhotoWidth,
} from '@nexvoy/core/supabase/storagePaths'

interface StoreRequestBody {
    planId?: string
    tripId?: string
    placeId?: string
    photoReference?: string | null
    documentPrimary?: boolean
}

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

interface FetchedPhoto {
    buffer: Buffer
    width: PlacePhotoWidth
}

/**
 * Google Places Photo API에서 지정 폭 이미지를 가져온다.
 * 실패는 상태 코드와 함께 반환해 호출측이 원본/썸네일을 구분 처리한다.
 */
async function fetchGooglePhoto(
    photoReference: string,
    width: PlacePhotoWidth,
    apiKey: string,
): Promise<{ photo: FetchedPhoto } | { errorStatus: number }> {
    const photoApiUrl =
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}` +
        `&photo_reference=${encodeURIComponent(photoReference)}` +
        `&key=${apiKey}`
    let res: Response
    try {
        res = await fetch(photoApiUrl, { redirect: 'follow' })
    } catch {
        return { errorStatus: 502 }
    }
    if (!res.ok) return { errorStatus: res.status }
    const arrayBuffer = await res.arrayBuffer()
    if (!arrayBuffer.byteLength) return { errorStatus: 502 }
    return { photo: { buffer: Buffer.from(arrayBuffer), width } }
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
        const isDocumentPrimary = body.documentPrimary === true
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
        //    Legacy row plan은 plans row로 trip 소속을 확인한다.
        //    Local-first/server-authority plan은 plans row가 아직 보이지 않을 수 있으므로
        //    trip-level owner/editor 권한만 확인한다.
        if (!isDocumentPrimary) {
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
        }

        if (isDocumentPrimary) {
            const authorityWrite = await supabase.rpc('check_can_write_authority_trip', {
                p_trip_id: tripId,
                p_user_id: user.id,
            })
            if (authorityWrite.error) {
                console.error(
                    '[places/photo/store] check_can_write_authority_trip failed:',
                    authorityWrite.error.message
                )
                return NextResponse.json({ error: 'Permission lookup failed' }, { status: 500 })
            }
            if (authorityWrite.data !== true) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        } else {
            // Legacy rows use trip owner/trip_members editor authority.
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
            if (ownerResp.data !== true && editorResp.data !== true) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
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

        // 5) Google Photo CDN fetch — 원본(w800)과 thumbnail(w240)을 각각 요청한다.
        //    Google이 리사이즈를 담당하므로 서버에 이미지 처리 라이브러리가 필요 없다.
        //    thumbnail 실패는 non-fatal: 원본만으로 기존 동작을 유지한다.
        const [originalResult, thumbResult] = await Promise.all([
            fetchGooglePhoto(photoReference, PLACE_PHOTO_ORIGINAL_WIDTH, apiKey),
            fetchGooglePhoto(photoReference, PLACE_PHOTO_THUMB_WIDTH, apiKey),
        ])

        if ('errorStatus' in originalResult) {
            // 403/410은 토큰 만료/거부 — 클라이언트가 photo_reference 무효화 처리해야 함
            if (originalResult.errorStatus === 403 || originalResult.errorStatus === 410) {
                console.warn(
                    `[places/photo/store] Google Photo expired (status=${originalResult.errorStatus}) for plan=${planId}`
                )
                return NextResponse.json({ error: 'Photo reference expired' }, { status: 410 })
            }
            console.error(
                `[places/photo/store] Google Photo fetch returned ${originalResult.errorStatus} for plan=${planId}`
            )
            return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 })
        }

        // 6) Supabase Storage upload — width suffix immutable path.
        const hash8 = placeIdHash8(placeId)
        const uploads: FetchedPhoto[] = [originalResult.photo]
        if ('photo' in thumbResult) uploads.push(thumbResult.photo)

        let publicUrl: string | null = null
        let thumbUrl: string | null = null
        for (const { buffer, width } of uploads) {
            const storagePath = placePhotoObjectPath(user.id, tripId, planId, hash8, width)
            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(storagePath, buffer, {
                    contentType: STORAGE_CONTENT_TYPE,
                    upsert: true,
                    cacheControl: '31536000',
                })
            if (uploadError) {
                if (width === PLACE_PHOTO_ORIGINAL_WIDTH) {
                    console.error('[places/photo/store] Storage upload failed:', uploadError.message)
                    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
                }
                console.warn('[places/photo/store] thumbnail upload failed:', uploadError.message)
                continue
            }

            const { data: publicUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(storagePath)
            if (width === PLACE_PHOTO_ORIGINAL_WIDTH) publicUrl = publicUrlData?.publicUrl ?? null
            else thumbUrl = publicUrlData?.publicUrl ?? null

            // metadata registry 등록 — orphan cleanup의 기준. 실패해도 ingest는 유지한다.
            const registration = await supabase.rpc('register_place_photo_asset', {
                p_trip_id: tripId,
                p_plan_id: planId,
                p_object_path: storagePath,
                p_width: width,
            })
            if (registration.error) {
                console.warn(
                    '[places/photo/store] asset registration failed:',
                    registration.error.message
                )
            }
        }

        if (!publicUrl) {
            console.error('[places/photo/store] getPublicUrl returned empty for plan', planId)
            return NextResponse.json({ error: 'Public URL generation failed' }, { status: 500 })
        }

        // 8) Legacy row plans UPDATE { image_url, photo_reference }.
        //    Document-primary callers update the Yjs document from the returned URL.
        if (!isDocumentPrimary) {
            const { error: updateError } = await supabase
                .from('plans')
                .update({ image_url: publicUrl, photo_reference: photoReference })
                .eq('id', planId)

            if (updateError) {
                console.error('[places/photo/store] plans UPDATE failed:', updateError.message)
                return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
            }
        }

        return NextResponse.json({ imageUrl: publicUrl, thumbUrl }, { status: 200 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[places/photo/store] Unhandled error:', message)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
