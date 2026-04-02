import { css, cx } from 'styled-system/css'

interface SkeletonProps {
    width?: string | number | { base?: string | number, sm?: string | number, md?: string | number, lg?: string | number }
    height?: string | number | { base?: string | number, sm?: string | number, md?: string | number, lg?: string | number }
    borderRadius?: string | number
    circle?: boolean
    className?: string
}

export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '8px', circle, className }: SkeletonProps) => {
    return (
        <div 
            className={cx(
                css({
                    width,
                    height: circle ? (typeof width === 'object' ? width : width) : height,
                    borderRadius: circle ? '50%' : borderRadius,
                    background: 'linear-gradient(90deg, #f5f5f5 25%, #eeeeee 50%, #f5f5f5 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear',
                    display: 'block'
                }),
                className
            )}
            style={circle && typeof width !== 'object' ? { height: width } : {}}
        />
    )
}

export default Skeleton
