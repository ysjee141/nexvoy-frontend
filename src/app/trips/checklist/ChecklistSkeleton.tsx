import { css } from 'styled-system/css'
import Skeleton from '@/components/ui/Skeleton'

/**
 * ChecklistItem 구조를 모방한 스켈레톤
 * - [ ] [Text       ] [Tag]
 */
const ChecklistItemSkeleton = () => (
    <div className={css({ 
        display: 'flex', alignItems: 'center', gap: '12px', p: '14px 16px', 
        bg: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' 
    })}>
        <Skeleton width="20px" height="20px" borderRadius="4px" />
        <Skeleton width="60%" height="18px" />
        <Skeleton width="40px" height="18px" borderRadius="10px" className={css({ ml: 'auto' })} />
    </div>
)

export const ChecklistSkeleton = () => {
    return (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
            {/* 카테고리 1 */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                <Skeleton width="80px" height="20px" borderRadius="4px" className={css({ mb: '8px', ml: '4px' })} />
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                    <ChecklistItemSkeleton />
                    <ChecklistItemSkeleton />
                    <ChecklistItemSkeleton />
                </div>
            </div>
            {/* 카테고리 2 */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                <Skeleton width="100px" height="20px" borderRadius="4px" className={css({ mb: '8px', ml: '4px' })} />
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                    <ChecklistItemSkeleton />
                    <ChecklistItemSkeleton />
                </div>
            </div>
        </div>
    )
}

export default ChecklistSkeleton
