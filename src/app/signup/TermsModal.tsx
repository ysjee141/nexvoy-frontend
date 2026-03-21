'use client'

import { css } from 'styled-system/css'
import { X, ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'

interface TermsModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center',
            bg: { base: 'white', sm: 'rgba(0, 0, 0, 0.4)' },
            backdropFilter: { base: 'none', sm: 'blur(4px)' },
            p: { base: 0, sm: '20px' }
        })}>
            <div className={css({
                bg: 'white',
                w: '100%',
                maxW: { base: 'none', sm: '600px' },
                h: { base: '100vh', sm: 'auto' },
                maxH: { base: 'none', sm: '85vh' },
                borderRadius: { base: '0', sm: '24px' },
                display: 'flex',
                flexDirection: 'column',
                boxShadow: { base: 'none', sm: '0 20px 40px rgba(0,0,0,0.15)' },
                overflow: 'hidden'
            })}>
                {/* Header */}
                <div className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: '16px 20px',
                    borderBottom: '1px solid #eee',
                    pt: { base: 'calc(16px + env(safe-area-inset-top))', sm: '24px' },
                    px: { base: '20px', sm: '24px' }
                })}>
                    <button onClick={onClose} className={css({ display: { base: 'flex', sm: 'none' }, alignItems: 'center', bg: 'none', border: 'none', p: 0, color: '#064E3B' })}>
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#022C22', flex: 1, textAlign: { base: 'center', sm: 'left' } })}>
                        이용약관 및 개인정보 처리방침
                    </h2>
                    <button onClick={onClose} className={css({ display: { base: 'none', sm: 'flex' }, p: '4px', bg: '#f5f5f5', borderRadius: '50%', color: '#666', cursor: 'pointer', _hover: { bg: '#eee' }, border: 'none' })}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={css({
                    flex: 1,
                    overflowY: 'auto',
                    p: { base: '24px 20px', sm: '24px' },
                    pb: 'env(safe-area-inset-bottom)'
                })}>
                    <div className={css({
                        fontSize: '14px',
                        color: '#444',
                        lineHeight: 1.6,
                        wordBreak: 'keep-all',
                        '& h3': { fontSize: '16px', fontWeight: '700', mt: '24px', mb: '8px', color: '#022C22' },
                        '& p': { mb: '12px' },
                        '& ul': { pl: '20px', mb: '12px', listStyleType: 'disc' },
                        '& li': { mb: '6px' }
                    })}>
                        <p>본 서비스는 이용자의 개인정보를 소중히 다루며, 관련 법령을 준수합니다.</p>

                        <h3>1. 수집하는 개인정보 항목</h3>
                        <p>서비스 이용 및 회원가입을 위해 아래와 같은 최소한의 정보를 수집합니다.</p>
                        <ul>
                            <li><strong>필수 항목</strong>: 이메일 주소, 비밀번호</li>
                            <li><strong>자동 수집 항목</strong>: 서비스 이용 기록, 접속 로그, 쿠키(Cookie), 접속 IP 정보</li>
                        </ul>

                        <h3>2. 개인정보의 수집 및 이용 목적</h3>
                        <p>수집한 개인정보는 다음의 목적을 위해 활용합니다.</p>
                        <ul>
                            <li>이용자 식별 및 본인 확인</li>
                            <li>서비스 이용에 따른 민원 처리 및 고지사항 전달</li>
                            <li>비인가 사용 방지 및 서비스 안정성 유지</li>
                        </ul>

                        <h3>3. 개인정보의 보유 및 이용 기간</h3>
                        <ul>
                            <li><strong>보유 기간</strong>: 회원 탈퇴 시까지 (단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.)</li>
                            <li><strong>파기 절차</strong>: 이용자가 회원 탈퇴를 요청하거나 목적이 달성된 경우, 복구 불가능한 방법으로 즉시 파기합니다.</li>
                        </ul>

                        <h3>4. 개인정보 처리 위탁 (중요)</h3>
                        <p>본 서비스는 안정적인 인증 및 데이터 관리를 위해 아래와 같이 외부 서비스를 이용하며, 이는 개인정보 처리 위탁에 해당합니다.</p>
                        <ul>
                            <li><strong>수탁자</strong>: Supabase, Inc.</li>
                            <li><strong>위탁 업무</strong>: 회원 인증(Auth), 데이터베이스 관리 및 보안</li>
                            <li><strong>위탁 항목</strong>: 이메일 주소, 암호화된 비밀번호</li>
                            <li><strong>이전 국가 및 데이터 리전</strong>: 대한민국 서울 (ap-northeast-2)</li>
                        </ul>

                        <h3>5. 이용자의 권리</h3>
                        <p>이용자는 언제든지 본인의 개인정보를 조회, 수정하거나 서비스 탈퇴를 통해 개인정보 수집 동의를 철회할 수 있습니다.</p>

                        <h3>6. 개인정보 보호 책임자</h3>
                        <p>본 서비스는 개인이 운영하며, 개인정보 관련 문의는 아래 연락처로 해주시기 바랍니다.</p>
                        <ul>
                            <li><strong>담당자</strong>: 지윤성</li>
                            <li><strong>문의처</strong>: <a href="mailto:ysjee141@gmail.com" className={css({ color: '#34A853', textDecoration: 'underline' })}>ysjee141@gmail.com</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
