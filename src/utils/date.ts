import { format } from 'date-fns'

/**
 * 날짜를 'YYYY.MM.DD' 형식의 문자열로 변환합니다.
 * @param date 날짜 객체 또는 문자열
 * @returns '2026.04.04' 형식의 문자열
 */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return ''
    try {
        return format(new Date(date), 'yyyy.MM.dd')
    } catch (e) {
        console.error('Date formatting failed', e)
        return ''
    }
}
