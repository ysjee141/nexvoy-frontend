import { useRef, useState, useEffect, useCallback } from 'react'

interface UseBottomSheetDragOptions {
    threshold?: number  // 닫기 임계값 (기본 100px)
}

interface UseBottomSheetDragReturn {
    handleRef: (node: HTMLDivElement | null) => void
    dragY: number
    isDragging: boolean
}

export function useBottomSheetDrag(
    onClose: () => void,
    options?: UseBottomSheetDragOptions
): UseBottomSheetDragReturn {
    const { threshold = 100 } = options || {}
    const [handleEl, setHandleEl] = useState<HTMLDivElement | null>(null)
    const [dragY, setDragY] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const startYRef = useRef(0)
    const dragYRef = useRef(0)
    const onCloseRef = useRef(onClose)

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    // callback ref — DOM 마운트/언마운트 시점을 정확히 감지
    const handleRef = useCallback((node: HTMLDivElement | null) => {
        setHandleEl(node)
    }, [])

    useEffect(() => {
        if (!handleEl) return

        const onTouchStart = (e: TouchEvent) => {
            startYRef.current = e.touches[0].clientY
            setIsDragging(true)
        }

        const onTouchMove = (e: TouchEvent) => {
            const deltaY = e.touches[0].clientY - startYRef.current
            if (deltaY > 0) {
                if (e.cancelable) e.preventDefault()
                dragYRef.current = deltaY
                setDragY(deltaY)
            } else {
                dragYRef.current = 0
                setDragY(0)
            }
        }

        const onTouchEnd = () => {
            setIsDragging(false)
            if (dragYRef.current > threshold) {
                onCloseRef.current()
            }
            dragYRef.current = 0
            setDragY(0)
        }

        handleEl.addEventListener('touchstart', onTouchStart, { passive: true })
        handleEl.addEventListener('touchmove', onTouchMove, { passive: false })
        handleEl.addEventListener('touchend', onTouchEnd)

        return () => {
            handleEl.removeEventListener('touchstart', onTouchStart)
            handleEl.removeEventListener('touchmove', onTouchMove)
            handleEl.removeEventListener('touchend', onTouchEnd)
        }
    }, [handleEl, threshold])

    return { handleRef, dragY, isDragging }
}
