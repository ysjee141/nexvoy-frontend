import { useEffect, useRef, useState } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void, baseModalId: string) {
    const onCloseRef = useRef(onClose);
    const [modalId, setModalId] = useState('');

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // 모달이 열릴 때마다 고유한 modalId 생성하여 페이지 새로고침 등에 따른 이전 상태 충돌 방지
    useEffect(() => {
        if (isOpen) setModalId(`${baseModalId}_${Date.now()}`);
    }, [isOpen, baseModalId]);

    useEffect(() => {
        if (isOpen && modalId) {
            // 히스토리에 현재 상태를 기록 (URL 변경 없이 state만 추가)
            window.history.pushState({ modal: modalId }, '', window.location.href);

            const handlePopState = (e: PopStateEvent) => {
                // 뒤로가기로 인해 발생한 이벤트일 때,
                // 만약 돌아온 state가 현재 모달의 state와 같다면 
                // 이는 이 모달 위에 떠 있던 '다른 모달'이 닫히면서 나에게 돌아온 것이므로 닫히면 안 됨.
                // 현재 state가 내 modalId와 다를 때만 닫기 트리거.
                if (window.history.state?.modal !== modalId) {
                    onCloseRef.current();
                }
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
                
                // 사용자가 명시적 닫기 버튼(X 닫기, 저장 등)을 눌러 모달이 언마운트되는 경우
                // history 스택에 쌓인 상태를 깔끔하게 소비하기 위해 한 번 back() 해줌.
                // 단축키 뒤로가기로 닫힌 경우 이미 history가 바뀌었으므로 조건에 부합하지 않음.
                if (window.history.state && window.history.state.modal === modalId) {
                    window.history.back();
                }
            };
        }
    }, [isOpen, modalId]);
}
