import { createClient } from '@/utils/supabase/client'
import { CacheUtil } from '@/utils/cache'

export interface DownloadedTripMetadata {
    id: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    downloadedAt: string;
}

export interface TripBundle {
    trip: any;
    plans: any[];
    checklist: any | null;
    checklistItems: any[];
    checklistChecks: any[];
    members: any[];
    downloadedAt: string;
}

const REGISTRY_KEY = 'downloaded_trip_registry'
const BUNDLE_PREFIX = 'trip_bundle_'

export const DownloadService = {
    /**
     * 특정 여행의 모든 데이터를 가져와서 로컬에 저장합니다.
     */
    async downloadTrip(tripId: string): Promise<boolean> {
        const supabase = createClient()
        
        try {
            // 1. 여행 기본 정보
            const { data: trip, error: tripErr } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single()
            
            if (tripErr || !trip) throw new Error('Trip not found')

            // 2. 일정 정보 (Plan + PlanURLs)
            const { data: plans, error: plansErr } = await supabase
                .from('plans')
                .select('*, plan_urls(*)')
                .eq('trip_id', tripId)
                .order('start_datetime_local', { ascending: true })
            
            if (plansErr) throw new Error('Plans fetch failed')

            // 3. 체크리스트 정보
            const { data: checklists } = await supabase
                .from('checklists')
                .select('*')
                .eq('trip_id', tripId)
                .limit(1)
            
            const checklist = checklists?.[0] || null
            let checklistItems: any[] = []
            let checklistChecks: any[] = []

            if (checklist) {
                const { data: items } = await supabase
                    .from('checklist_items')
                    .select('*')
                    .eq('checklist_id', checklist.id)
                
                if (items) {
                    checklistItems = items
                    const itemIds = items.map((i: any) => i.id)
                    if (itemIds.length > 0) {
                        const { data: checks } = await supabase
                            .from('checklist_item_user_checks')
                            .select('*')
                            .in('item_id', itemIds)
                        if (checks) checklistChecks = checks
                    }
                }
            }

            // 4. 동행자 정보
            const { data: members } = await supabase
                .from('trip_members')
                .select('*, profiles(*)')
                .eq('trip_id', tripId)

            // 5. 번들 생성 및 저장
            const bundle: TripBundle = {
                trip,
                plans: plans || [],
                checklist,
                checklistItems,
                checklistChecks,
                members: members || [],
                downloadedAt: new Date().toISOString()
            }

            await CacheUtil.set(`${BUNDLE_PREFIX}${tripId}`, bundle)

            // 방금 저장한 번들이 정상적으로 읽히는지 (용량 초과 등으로 인한 silent fail 검증)
            const verify = await CacheUtil.get(`${BUNDLE_PREFIX}${tripId}`)
            if (!verify) {
                throw new Error('용량 초과 또는 캐시 저장 실패로 번들이 저장되지 않았습니다.')
            }

            // 6. 레지스트리 업데이트
            await this.addToRegistry({
                id: trip.id,
                title: trip.title,
                destination: trip.destination,
                start_date: trip.start_date,
                end_date: trip.end_date,
                downloadedAt: bundle.downloadedAt
            })

            return true
        } catch (error) {
            console.error('DownloadService.downloadTrip failed:', error)
            return false
        }
    },

    /**
     * 로컬에 저장된 여행 데이터를 삭제합니다.
     */
    async removeDownloadedTrip(tripId: string): Promise<void> {
        await CacheUtil.remove(`${BUNDLE_PREFIX}${tripId}`)
        
        const registry = await this.getDownloadedTrips()
        const updatedRegistry = registry.filter(t => t.id !== tripId)
        await CacheUtil.set(REGISTRY_KEY, updatedRegistry)
    },

    /**
     * 다운로드된 여행 목록을 가져옵니다.
     */
    async getDownloadedTrips(): Promise<DownloadedTripMetadata[]> {
        const registry = await CacheUtil.get<DownloadedTripMetadata[]>(REGISTRY_KEY)
        return registry || []
    },

    /**
     * 특정 여행이 다운로드되어 있는지 확인합니다.
     */
    async isDownloaded(tripId: string): Promise<boolean> {
        const registry = await this.getDownloadedTrips()
        return registry.some(t => t.id === tripId)
    },

    /**
     * 레지스트리에 새 여행 정보를 추가합니다 (중복 방지).
     */
    async addToRegistry(metadata: DownloadedTripMetadata): Promise<void> {
        const registry = await this.getDownloadedTrips()
        const filtered = registry.filter(t => t.id !== metadata.id)
        const updated = [metadata, ...filtered]
        await CacheUtil.set(REGISTRY_KEY, updated)
    },

    /**
     * 다운로드된 번들 데이터를 직접 가져옵니다.
     */
    async getBundle(tripId: string): Promise<TripBundle | null> {
        return await CacheUtil.get<TripBundle>(`${BUNDLE_PREFIX}${tripId}`)
    }
}
