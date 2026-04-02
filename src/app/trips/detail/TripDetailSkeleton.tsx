import { css } from 'styled-system/css'
import Skeleton from '@/components/ui/Skeleton'

/**
 * 타임라인 카드 구조를 모방한 스켈레톤
 */
const TimelineCardSkeleton = () => (
    <div className={css({ display: 'flex', gap: '16px', mb: '20px' })}>
        {/* 시간 영역 */}
        <div className={css({ w: '50px', flexShrink: 0, pt: '4px' })}>
            <Skeleton width="40px" height="14px" borderRadius="4px" />
        </div>
        
        {/* 카드 영역 */}
        <div className={css({ 
            flex: 1, p: '16px', bg: 'white', border: '1px solid #f0f0f0', 
            borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' 
        })}>
            <Skeleton width="40px" height="40px" borderRadius="10px" />
            <div className={css({ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' })}>
                <Skeleton width="70%" height="16px" />
                <Skeleton width="40%" height="12px" />
            </div>
            <Skeleton width="24px" height="24px" borderRadius="50%" />
        </div>
    </div>
)

export const TripDetailSkeleton = () => {
    return (
        <div className={css({ py: '20px' })}>
            <div className={css({ mb: '32px' })}>
                <Skeleton width="120px" height="24px" className={css({ mb: '12px' })} />
                <Skeleton width="200px" height="14px" className={css({ mb: '24px' })} />
                
                <div className={css({ display: 'flex', flexDirection: 'column', position: 'relative' })}>
                    {/* 카드들 */}
                    <TimelineCardSkeleton />
                    <TimelineCardSkeleton />
                    <TimelineCardSkeleton />
                </div>
            </div>
        </div>
    )
}

export default TripDetailSkeleton
