/**
 * 비공개 테스트를 진행하는 테스터들의 User ID (UUID) 목록입니다.
 * 이 목록에 포함된 사용자에게만 버그 제보 등 테스트 전용 기능이 노출됩니다.
 */
export const BETA_TESTERS = [
    '3812153a-12a9-4849-8907-d1a5d80004ff', // 홍길동 (예시)
    'f3e197e5-62e7-4248-a4d1-4728cf02d6b2',
    '448d2f7e-502c-4756-ace6-06e82a7274ea',
    'd8cd7e05-e634-4d5f-8700-81f475abfe78',
    'c4a52732-4834-4bfa-ab37-a5d28b15bc13',
    '5b3248c2-ac22-40a4-860a-93bb07ad302d',
    'ce9ea01f-248c-44b2-ad58-04e3895d2c6a',
    '5a8f556f-d6d0-4d78-9b6c-ec4de692e121',
    '2531585c-acdf-435c-993e-fc43bac328ac',
    '4fb40d1a-200b-4a80-9f03-c4dbe6f3f391'
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
