/**
 * 체크리스트 / 템플릿에서 사용하는 공통 카테고리 목록
 * 모든 곳에서 이 상수를 import하여 사용합니다.
 */
export const CATEGORIES = [
    '필수',
    '의류',
    '전자기기',
    '세면도구',
    '상비약',
    '서류',
    '음식',
    '기타',
] as const

export type Category = (typeof CATEGORIES)[number]
