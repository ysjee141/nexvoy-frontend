import { css } from 'styled-system/css'
import Skeleton from '@/components/ui/Skeleton'

/**
 * 프로필 화면의 헤더와 통계 카드 레이아웃을 모방한 스켈레톤
 */
export const ProfileSkeleton = () => {
    return (
        <div className={css({ maxW: '720px', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '16px', sm: '20px' }, display: 'flex', flexDirection: 'column', gap: '24px' })}>
            {/* 프리미엄 헤더 스켈레톤 */}
            <div className={css({ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                pt: '40px', pb: '24px', borderRadius: '32px',
                bg: 'rgba(46, 196, 182, 0.04)', gap: '16px' 
            })}>
                <Skeleton width={{ base: '88px', sm: '100px' }} height={{ base: '88px', sm: '100px' }} borderRadius="32px" />
                <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' })}>
                    <Skeleton width="140px" height="32px" borderRadius="8px" />
                    <Skeleton width="180px" height="16px" borderRadius="4px" />
                </div>
            </div>

            {/* 통계 대시보드 스켈레톤 */}
            <div className={css({ 
                bg: 'white', borderRadius: '32px', p: { base: '24px', sm: '32px' }, 
                border: '1px solid #F0F0F0', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' 
            })}>
                <div className={css({ display: 'flex', justifyContent: 'space-between', mb: '24px' })}>
                    <Skeleton width="120px" height="24px" borderRadius="6px" />
                    <Skeleton width="60px" height="20px" borderRadius="10px" />
                </div>
                <div className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '16px' })}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={css({ p: '24px 16px', bg: 'white', border: '1px solid #F5F5F5', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' })}>
                            <Skeleton width="48px" height="48px" borderRadius="16px" className={css({ mb: '12px' })} />
                            <Skeleton width="40px" height="24px" borderRadius="6px" className={css({ mb: '8px' })} />
                            <Skeleton width="60px" height="14px" borderRadius="4px" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 메뉴 리스트 스켈레톤 */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                <Skeleton width="100%" height="240px" borderRadius="32px" />
                <Skeleton width="100%" height="140px" borderRadius="32px" />
            </div>
        </div>
    )
}

export default ProfileSkeleton
