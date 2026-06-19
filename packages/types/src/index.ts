export * from './trip'
export * from './plan'
export * from './checklist'
export * from './template'
export * from './user'
export * from './collaboration'
export type { Database, Json } from './database.generated'

// ─── View-model 타입 (목록/통계 카드용) ───────────────────────────────────────

/** 템플릿 목록 카드: 아이템 개수 포함 */
export interface TemplateWithCount {
  id: string
  title: string
  user_id: string | null
  item_count: number
}

/** 방문 목적지: plans.location 기준 집계 + 연관 trip 목록 */
export interface VisitedPlace {
  location: string
  trip_count: number
  trips: Array<{ id: string; destination: string; start_date: string }>
}

/** 여행 통계 집계 (여행 기록 화면) */
export interface TravelStats {
  totalDays: number
  completedCount: number
  longestTripDays: number
  uniqueDestinations: number
  pastTrips: Array<{ id: string; destination: string; start_date: string; end_date: string }>
  upcomingTrips: Array<{ id: string; destination: string; start_date: string; end_date: string }>
}
