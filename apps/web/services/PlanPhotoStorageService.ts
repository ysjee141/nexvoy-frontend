import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * PlanPhotoStorageService
 * - place-photos 버킷 내 plan 관련 객체의 cleanup을 담당.
 * - plan 삭제 흐름에서 best-effort로 호출하며, 실패해도 plan 삭제 자체는 진행한다.
 *
 * 경로 규칙: place-photos/{user_id}/{trip_id}/{plan_id}_{placeIdHash8}.jpg
 *
 * 권한: RLS에 의해 본인 폴더(user_id == auth.uid()) 객체만 삭제 가능.
 */
class PlanPhotoStorageServiceImpl {
    private static instance: PlanPhotoStorageServiceImpl
    private readonly bucket = 'place-photos'

    private constructor() {}

    static getInstance(): PlanPhotoStorageServiceImpl {
        if (!PlanPhotoStorageServiceImpl.instance) {
            PlanPhotoStorageServiceImpl.instance = new PlanPhotoStorageServiceImpl()
        }
        return PlanPhotoStorageServiceImpl.instance
    }

    /**
     * plan 삭제 전후로 호출. {user_id}/{trip_id}/ 폴더에서 {plan_id}_ 로 시작하는 객체를 일괄 삭제.
     *
     * @param params.tripId  trip id (경로 구성에 필요)
     * @param params.planId  plan id (파일명 접두어)
     * @returns 삭제된 객체 수 (실패 시 0)
     *
     * 실패는 best-effort: 절대 throw 하지 않음. 호출 측 plan DELETE는 계속 진행.
     */
    async cleanupPlanPhotos(params: { tripId: string; planId: string }): Promise<number> {
        const { tripId, planId } = params
        if (!tripId || !planId) {
            return 0
        }

        try {
            const supabase: SupabaseClient = createClient()

            // 1) 현재 사용자 식별
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser()
            if (authError || !user) {
                console.warn('[PlanPhotoStorageService] cleanup skipped: unauthenticated')
                return 0
            }

            const folder = `${user.id}/${tripId}`

            // 2) 폴더 내 객체 목록 조회
            const { data: list, error: listError } = await supabase.storage
                .from(this.bucket)
                .list(folder, { limit: 100 })

            if (listError) {
                console.warn(
                    '[PlanPhotoStorageService] list failed:',
                    listError.message
                )
                return 0
            }
            if (!list || list.length === 0) {
                return 0
            }

            // 3) {plan_id}_ 로 시작하는 객체만 필터
            const targets = list
                .filter(obj => obj?.name?.startsWith(`${planId}_`))
                .map(obj => `${folder}/${obj.name}`)

            if (targets.length === 0) {
                return 0
            }

            // 4) 삭제 (RLS에 의해 본인 폴더만 삭제 가능)
            const { data: removed, error: removeError } = await supabase.storage
                .from(this.bucket)
                .remove(targets)

            if (removeError) {
                console.warn(
                    '[PlanPhotoStorageService] remove failed:',
                    removeError.message
                )
                return 0
            }

            return removed?.length ?? 0
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            console.warn('[PlanPhotoStorageService] cleanup error:', message)
            return 0
        }
    }
}

export const PlanPhotoStorageService = PlanPhotoStorageServiceImpl.getInstance()
