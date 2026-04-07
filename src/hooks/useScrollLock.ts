import { useEffect } from 'react'

/**
 * 모달 오픈 시 배경 페이지의 스크롤을 막는 훅입니다.
 * @param isOpen 모달의 열림 상태
 */
export function useScrollLock(isOpen: boolean) {
    useEffect(() => {
        if (isOpen) {
            const originalStyle = window.getComputedStyle(document.body).overflow
            document.body.style.overflow = 'hidden'
            
            return () => {
                document.body.style.overflow = originalStyle
            }
        }
    }, [isOpen])
}
