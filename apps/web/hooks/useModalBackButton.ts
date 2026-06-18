import { useEffect, useRef } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void, baseModalId: string) {
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        // 모달이 열릴 때마다 고유한 modalId 생성
        const modalId = `${baseModalId}_${Date.now()}`;

        // React 18 Strict Mode의 더블 마운트/언마운트 사이클에서 pushState가 연달아 일어나지 않도록 짧게 지연합니다.
        const pushTimer = setTimeout(() => {
            if (!isMounted) return;
            // 기존 history state를 덮어쓰지 않도록 복사하여 추가 (Next.js 호환성)
            const currentState = window.history.state || {};
            window.history.pushState({ ...currentState, modal: modalId }, '', window.location.href);
        }, 30);

        const handlePopState = () => {
            // 현재 state의 modal 값이 내가 띄운 modalId와 다르면(뒤로가기로 빠졌다면) onClose 실행
            if (window.history.state?.modal !== modalId) {
                onCloseRef.current();
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            isMounted = false;
            clearTimeout(pushTimer);
            window.removeEventListener('popstate', handlePopState);
            
            // 모달이 직접 닫히는 경우 (뒤로가기가 아닌 버튼 클릭 등) 쌓은 history 정리
            // 비동기로 빼서 React의 연쇄적인 언마운트 흐름과 popstate의 충돌을 방지합니다.
            setTimeout(() => {
                if (window.history.state && window.history.state.modal === modalId) {
                    window.history.back();
                }
            }, 10);
        };
    }, [isOpen, baseModalId]);
}
