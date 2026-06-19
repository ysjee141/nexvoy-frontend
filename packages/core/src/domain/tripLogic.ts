import type { Plan } from '@nexvoy/types'

/** 날짜 문자열 기준 오름차순 정렬 */
export function sortPlansByDatetime(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const dateCompare = a.start_datetime_local.localeCompare(b.start_datetime_local)
    if (dateCompare !== 0) return dateCompare
    const aTime = a.visit_time ?? ''
    const bTime = b.visit_time ?? ''
    return aTime.localeCompare(bTime)
  })
}

/** 여행 기간(일수) 계산 */
export function calcTripDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/** 여행이 현재 진행 중인지 확인 */
export function isTripOngoing(startDate: string, endDate: string): boolean {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return now >= start && now <= end
}

/** 여행이 과거인지 확인 */
export function isTripPast(endDate: string): boolean {
  const now = new Date()
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return now > end
}

/** 여행이 미래인지 확인 */
export function isTripUpcoming(startDate: string): boolean {
  const now = new Date()
  return new Date(startDate) > now
}

/** 플랜의 총 비용 합산 */
export function calcTotalCost(plans: Plan[]): number {
  return plans.reduce((sum, p) => sum + (p.cost ?? 0), 0)
}
