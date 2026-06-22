export * from './trip'
export * from './plan'
export * from './checklist'
export * from './template'
export * from './user'
export * from './collaboration'
export type { Database, Json } from './database.generated'

import type { Trip } from './trip'

// ─── View-model 타입 (목록/통계 카드용) ───────────────────────────────────────

/** 템플릿 목록 카드: 아이템 개수 포함 */
export interface TemplateWithCount {
  id: string
  title: string
  user_id: string | null
  item_count: number
}

/** 여행 카드: 체크리스트 진행률 + 소유 여부 포함 (모바일/웹 목록 정렬용) */
export interface TripWithProgress extends Trip {
  /** 0~100, 체크리스트 완료율 (체크리스트 없으면 0) */
  progressPercent: number
  /** trip.user_id === 요청 userId */
  isOwner: boolean
}

/** 템플릿 카드: 아이템 개수 + 미리보기 항목명 포함 */
export interface TemplateWithPreview {
  id: string
  title: string
  /** null = 공개(기본 제공) 템플릿. 본인 소유 여부/삭제 가드 판별용 */
  user_id: string | null
  item_count: number
  /** 최대 3개 항목명 */
  preview_items: string[]
  created_at: string
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
