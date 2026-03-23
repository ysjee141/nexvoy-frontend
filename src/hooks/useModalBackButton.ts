import { useEffect, useRef } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void, baseModalId: string) {
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            // 모달이 열릴 때마다 고유한 modalId 생성
            const modalId = `${baseModalId}_${Date.now()}`;

            // 기존 history state를 덮어쓰지 않도록 복사하여 추가 (Next.js 호환성)
            const currentState = window.history.state || {};
            window.history.pushState({ ...currentState, modal: modalId }, '', window.location.href);

            const handlePopState = () => {
                // 현재 state의 modal 값이 내가 띄운 modalId와 다르면(뒤로가기로 빠졌다면) onClose 실행
                if (window.history.state?.modal !== modalId) {
                    onCloseRef.current();
                }
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
                
                // 모달이 직접 닫히는 경우 (뒤로가기가 아닌 버튼 클릭 등) 쌓은 history 정리
                if (window.history.state && window.history.state.modal === modalId) {
                    window.history.back();
                }
            };
        }
    }, [isOpen, baseModalId]);
}
