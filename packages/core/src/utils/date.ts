// src/utils/date.ts에서 이관 — 무변형 (순수 함수)
import { format } from 'date-fns'

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    return format(new Date(date), 'yyyy.MM.dd')
  } catch {
    return ''
  }
}
