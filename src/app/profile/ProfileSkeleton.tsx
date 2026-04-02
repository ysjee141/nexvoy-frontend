import { css } from 'styled-system/css'
import Skeleton from '@/components/ui/Skeleton'

/**
 * 프로필 화면의 헤더와 통계 카드 레이아웃을 모방한 스켈레톤
 */
export const ProfileSkeleton = () => {
    return (
        <div className={css({ maxW: '720px', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '16px', sm: '20px' }, display: 'flex', flexDirection: 'column', gap: '24px' })}>
            {/* 유저 헤더 */}
            <div className={css({ display: 'flex', alignItems: 'center', gap: '16px' })}>
                <Skeleton width={{ base: '64px', sm: '72px' }} height={{ base: '64px', sm: '72px' }} circle />
                <div className={css({ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' })}>
                    <Skeleton width="120px" height="28px" />
                    <Skeleton width="180px" height="15px" />
                </div>
            </div>

            {/* 통계 섹션 */}
            <div className={css({ 
                bg: 'white', borderRadius: '24px', p: { base: '20px', sm: '32px' }, 
                border: '1px solid #DDDDDD', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' 
            })}>
                <Skeleton width="100px" height="20px" className={css({ mb: '24px' })} />
                <div className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '12px' })}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={css({ p: '24px 16px', bg: '#F7F7F7', borderRadius: '16px' })}>
                            <Skeleton width="32px" height="32px" className={css({ mx: 'auto', mb: '12px' })} />
                            <Skeleton width="40px" height="24px" className={css({ mx: 'auto', mb: '8px' })} />
                            <Skeleton width="60px" height="14px" className={css({ mx: 'auto' })} />
                        </div>
                    ))}
                </div>
            </div>

            {/* 메뉴 리스트 */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                <Skeleton width="100%" height="60px" borderRadius="16px" />
                <Skeleton width="100%" height="80px" borderRadius="20px" />
                <Skeleton width="100%" height="80px" borderRadius="20px" />
            </div>
        </div>
    )
}

export default ProfileSkeleton
