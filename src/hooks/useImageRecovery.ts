'use client'

import { useCallback, useRef, useState } from 'react'
import { storePhoto, isStoring } from '@/services/PlacePhotoService'

/**
 * 이미지 복구 훅 — Google Place Photo 영구 저장 진입점.
 *
 * 책임:
 *  - PlanImage(onError) 트리거 시 `POST /api/places/photo/store` 호출
 *  - 모듈 스코프(PlacePhotoService)에 위임하여 in-flight dedup + cooldown 적용
 *  - 성공 시 imageUrl 반환. 실패는 null 반환 (Zero Noise)
 *  - 410 (photo_reference 만료) 시에도 null 반환 — 호출자(PlanImage)는
 *    `error-final`로 자동 귀결됨
 *
 * 비고:
 *  - Zustand store 갱신은 본 훅에서 직접 수행하지 않는다.
 *    PlanImage의 onRecovered 콜백에서 호출자가 처리한다 (UX 설계 9.x 참조).
 */

export interface RecoverParams {
    planId: string
    tripId: string
    placeId?: string | null
    photoReference?: string | null
}

export interface RecoverResult {
    imageUrl: string
}

export interface UseImageRecoveryReturn {
    recover: (params: RecoverParams) => Promise<RecoverResult | null>
    isRecovering: boolean
    isRecoveringFor: (planId: string) => boolean
}

export function useImageRecovery(): UseImageRecoveryReturn {
    const [isRecovering, setIsRecovering] = useState(false)
    const inFlightRef = useRef<boolean>(false)

    const recover = useCallback(
        async (params: RecoverParams): Promise<RecoverResult | null> => {
            const { planId, tripId, placeId, photoReference } = params

            // 필수 필드 검증 — photoReference는 서버 fallback이 처리하므로 optional
            if (!planId || !tripId || !placeId) {
                return null
            }

            // 동일 훅 인스턴스 dedup (PlanImage가 한 카드에서 onError가 빠르게 두 번 발생할 수 있음)
            if (inFlightRef.current) return null

            inFlightRef.current = true
            setIsRecovering(true)
            try {
                const result = await storePhoto({
                    planId,
                    tripId,
                    placeId,
                    photoReference,
                })

                if (result.ok) {
                    return { imageUrl: result.imageUrl }
                }
                // 실패 — 모든 사유에 대해 null 반환. cooldown은 모듈 스코프가 관리.
                return null
            } catch (error) {
                // 예외는 service에서 잡지만, 방어적으로 처리
                console.error('[useImageRecovery] unexpected error', error)
                return null
            } finally {
                inFlightRef.current = false
                setIsRecovering(false)
            }
        },
        [],
    )

    const isRecoveringFor = useCallback((planId: string) => {
        return isStoring(planId)
    }, [])

    return { recover, isRecovering, isRecoveringFor }
}

export default useImageRecovery
