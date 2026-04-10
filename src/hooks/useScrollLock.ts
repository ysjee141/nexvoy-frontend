import { useEffect } from 'react'

let lockCount = 0

/**
 * 모달 오픈 시 배경 페이지의 스크롤을 막는 훅입니다.
 * 전역 카운팅을 통해 중첩 모달을 처리하며, 스크롤바 너비만큼 패딩을 추가하여 레이아웃 튐을 방지합니다.
 * @param isOpen 모달의 열림 상태
 */
export function useScrollLock(isOpen: boolean) {
    useEffect(() => {
        if (!isOpen) return

        lockCount++
        
        // 현재 스타일 저장
        const originalStyle = window.getComputedStyle(document.body).overflow
        const originalPadding = document.body.style.paddingRight
        
        // 스크롤바 너비 계산 (데스크탑에서 레이아웃 튐 방지)
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
        
        if (lockCount === 1) {
            document.body.style.overflow = 'hidden'
            if (scrollBarWidth > 0) {
                document.body.style.paddingRight = `${scrollBarWidth}px`
            }
        }

        return () => {
            lockCount--
            if (lockCount === 0) {
                document.body.style.overflow = '' // 초기 상태로 복구
                document.body.style.paddingRight = originalPadding
            }
        }
    }, [isOpen])
}
