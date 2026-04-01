/**
 * 비공개 테스트를 진행하는 테스터들의 User ID (UUID) 목록입니다.
 * 이 목록에 포함된 사용자에게만 버그 제보 등 테스트 전용 기능이 노출됩니다.
 */
export const BETA_TESTERS = [
    '3812153a-12a9-4849-8907-d1a5d80004ff', // 홍길동 (예시)
    // 추가 테스터의 UUID를 여기에 등록하세요.
]

/**
 * 현재 사용자가 베타 테스터인지 확인합니다.
 */
export const isBetaTester = (userId?: string | null) => {
    if (!userId) return false
    console.log(userId)
    return BETA_TESTERS.includes(userId)
}
