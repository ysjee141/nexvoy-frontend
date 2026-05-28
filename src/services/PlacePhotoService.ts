import { Capacitor, CapacitorHttp } from '@capacitor/core'

/**
 * PlacePhotoService
 * - Google Place Photo의 영구 저장(Supabase Storage) 흐름 진입점.
 * - 모듈 스코프에서 in-flight dedup과 cooldown을 관리하여 동일 plan에 대한
 *   중복 호출을 차단한다.
 *
 * 주의:
 *  - 직접 `POST /api/places/photo/store` 호출 (인증 쿠키 동반).
 *  - 모바일(Capacitor) 환경에서는 CapacitorHttp 사용 (절대 경로).
 *  - 실패는 silent (콘솔 로그만). 호출자(훅/모달)는 onRecovered 콜백을 통해
 *    성공 시 상태를 갱신한다.
 */

export interface StorePhotoParams {
    planId: string
    tripId: string
    placeId?: string | null
    photoReference?: string | null
}

export interface StorePhotoResult {
    /** Storage publicUrl (성공 시) */
    imageUrl: string
}

/** 410 응답 시 사용. photo_reference 만료 */
const PHOTO_REFERENCE_EXPIRED_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h
/** 그 외 5xx/네트워크 실패 시 사용 */
const TRANSIENT_FAILURE_COOLDOWN_MS = 5 * 60 * 1000 // 5분

const inFlight: Set<string> = new Set()
const lastFailedAt: Map<string, { at: number; cooldownMs: number }> = new Map()

function isCoolingDown(planId: string): boolean {
    const entry = lastFailedAt.get(planId)
    if (!entry) return false
    if (Date.now() - entry.at >= entry.cooldownMs) {
        lastFailedAt.delete(planId)
        return false
    }
    return true
}

function getStoreUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || ''
    if (Capacitor.isNativePlatform()) {
        // Native: 절대 경로 필요
        return `${base}/api/places/photo/store`
    }
    return '/api/places/photo/store'
}

/** in-flight + cooldown 체크 (사이드 이펙트 없음) */
export function canStoreNow(planId: string): boolean {
    if (!planId) return false
    if (inFlight.has(planId)) return false
    if (isCoolingDown(planId)) return false
    return true
}

/** 진행 중 여부 (UI 표시용) */
export function isStoring(planId: string): boolean {
    return !!planId && inFlight.has(planId)
}

/**
 * `POST /api/places/photo/store` 호출.
 * - 성공: { imageUrl }
 * - 410: photo_reference 만료 → 장기 cooldown 기록 후 'expired' 반환
 * - 그 외 실패: 단기 cooldown 기록 후 'transient' 반환
 *
 * 호출자가 await 가능. 백그라운드 호출 측에서는 `void` 처리하여 fire-and-forget.
 */
export async function storePhoto(
    params: StorePhotoParams,
): Promise<
    | { ok: true; imageUrl: string }
    | { ok: false; reason: 'invalid' | 'cooldown' | 'expired' | 'transient' }
> {
    const { planId, tripId, placeId, photoReference } = params

    // photoReference는 optional — 서버가 placeId로 Places Details fallback 수행
    if (!planId || !tripId || !placeId) {
        return { ok: false, reason: 'invalid' }
    }
    if (inFlight.has(planId)) {
        return { ok: false, reason: 'cooldown' }
    }
    if (isCoolingDown(planId)) {
        return { ok: false, reason: 'cooldown' }
    }

    inFlight.add(planId)
    try {
        const url = getStoreUrl()
        const normalizedPhotoReference = photoReference ?? null
        const body = JSON.stringify({
            planId,
            tripId,
            placeId,
            photoReference: normalizedPhotoReference,
        })

        let status = 0
        let payload: StorePhotoResult | { error?: string } = {}

        if (Capacitor.isNativePlatform()) {
            try {
                const res = await CapacitorHttp.request({
                    url,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: {
                        planId,
                        tripId,
                        placeId,
                        photoReference: normalizedPhotoReference,
                    },
                    connectTimeout: 15000,
                    readTimeout: 15000,
                })
                status = res.status
                payload = (res.data as StorePhotoResult) ?? {}
            } catch (err) {
                console.warn('[PlacePhotoService] native request failed', err)
                lastFailedAt.set(planId, {
                    at: Date.now(),
                    cooldownMs: TRANSIENT_FAILURE_COOLDOWN_MS,
                })
                return { ok: false, reason: 'transient' }
            }
        } else {
            try {
                const controller = new AbortController()
                const timer = setTimeout(() => controller.abort(), 15000)
                let res: Response
                try {
                    res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body,
                        credentials: 'same-origin',
                        signal: controller.signal,
                    })
                } finally {
                    clearTimeout(timer)
                }
                status = res.status
                payload = await res.json().catch(() => ({}))
            } catch (err) {
                console.warn('[PlacePhotoService] fetch failed', err)
                lastFailedAt.set(planId, {
                    at: Date.now(),
                    cooldownMs: TRANSIENT_FAILURE_COOLDOWN_MS,
                })
                return { ok: false, reason: 'transient' }
            }
        }

        if (status === 200 && (payload as StorePhotoResult).imageUrl) {
            return { ok: true, imageUrl: (payload as StorePhotoResult).imageUrl }
        }

        if (status === 410) {
            lastFailedAt.set(planId, {
                at: Date.now(),
                cooldownMs: PHOTO_REFERENCE_EXPIRED_COOLDOWN_MS,
            })
            return { ok: false, reason: 'expired' }
        }

        lastFailedAt.set(planId, {
            at: Date.now(),
            cooldownMs: TRANSIENT_FAILURE_COOLDOWN_MS,
        })
        return { ok: false, reason: 'transient' }
    } finally {
        inFlight.delete(planId)
    }
}

/**
 * 백그라운드 업로드 (fire-and-forget).
 * - await 하지 않음. 호출자는 즉시 다음 동작으로 진행 가능.
 * - 성공 시 `onSuccess` 콜백을 통해 imageUrl 전달.
 * - 실패는 silent (콘솔 로그만).
 */
export function uploadInBackground(
    params: StorePhotoParams,
    onSuccess?: (imageUrl: string) => void,
): void {
    if (!canStoreNow(params.planId)) return
    storePhoto(params)
        .then(result => {
            if (result.ok && onSuccess) {
                try {
                    onSuccess(result.imageUrl)
                } catch (err) {
                    console.warn('[PlacePhotoService] onSuccess callback failed', err)
                }
            }
        })
        .catch(err => {
            // Zero Noise: 토스트 없이 콘솔 로그만
            console.warn('[PlacePhotoService] background upload failed', err)
        })
}

export const PlacePhotoStoreService = {
    storePhoto,
    uploadInBackground,
    canStoreNow,
    isStoring,
}
