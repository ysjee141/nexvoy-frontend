import { css } from 'styled-system/css'
import Skeleton from '../ui/Skeleton'

interface CommonListSkeletonProps {
    count?: number
    height?: string | number
    gap?: string | number
    borderRadius?: string | number
}

export const CommonListSkeleton = ({ 
    count = 5, 
    height = '80px', 
    gap = '12px',
    borderRadius = '12px'
}: CommonListSkeletonProps) => {
    return (
        <div className={css({ display: 'flex', flexDirection: 'column', gap })}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton 
                    key={i} 
                    height={height} 
                    borderRadius={borderRadius} 
                />
            ))}
        </div>
    )
}

export default CommonListSkeleton
