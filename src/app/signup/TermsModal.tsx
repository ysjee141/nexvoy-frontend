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
            p: { base: 0, sm: '20px' },
            backdropFilter: { base: 'none', sm: 'blur(10px)' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white',
                w: '100%',
                maxW: { base: 'none', sm: '640px' },
                h: { base: '100vh', sm: 'auto' },
                maxH: { base: 'none', sm: '85vh' },
                borderRadius: { base: '0', sm: '24px' },
                display: 'flex',
                flexDirection: 'column',
                boxShadow: { base: 'none', sm: '0 30px 80px rgba(0,0,0,0.2)' },
                overflow: 'hidden',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* Header */}
                <div className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: '16px 20px',
                    borderBottom: '1px solid',
                    borderColor: 'brand.border',
                    pt: { base: 'calc(16px + env(safe-area-inset-top))', sm: '24px' },
                    px: { base: '20px', sm: '24px' },
                    bg: 'white'
                })}>
                    <button onClick={onClose} className={css({ 
                        display: { base: 'flex', sm: 'none' }, 
                        alignItems: 'center', bg: 'none', border: 'none', p: 0, 
                        color: 'brand.primary', cursor: 'pointer' 
                    })}>
                        <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>
                    <h2 className={css({ 
                        fontSize: '18px', fontWeight: '700', color: 'brand.secondary', flex: 1, 
                        textAlign: { base: 'center', sm: 'left' }, letterSpacing: '-0.02em' 
                    })}>
                        이용약관 및 개인정보 처리방침
                    </h2>
                    <button onClick={onClose} className={css({ 
                        display: { base: 'none', sm: 'flex' }, 
                        p: '6px', bg: 'bg.softCotton', borderRadius: '50%', color: 'brand.muted', 
                        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                        _hover: { bg: 'brand.border', color: 'brand.secondary', transform: 'rotate(90deg)' }
                    })}>
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content */}
                <div className={css({
                    flex: 1,
                    overflowY: 'auto',
                    p: { base: '24px 20px', sm: '32px' },
                    pb: 'calc(env(safe-area-inset-bottom) + 40px)',
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { w: '6px' },
                    '&::-webkit-scrollbar-thumb': { bg: 'brand.border', borderRadius: '10px' }
                })}>
                    <div className={css({
                        fontSize: '14.5px',
                        color: 'brand.muted',
                        lineHeight: 1.7,
                        wordBreak: 'keep-all',
                        '& h3': { fontSize: '16px', fontWeight: '800', mt: '36px', mb: '12px', color: 'brand.primary', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '4px solid', pl: '12px' },
                        '& h4': { fontSize: '14.5px', fontWeight: '700', mt: '20px', mb: '8px', color: 'brand.secondary' },
                        '& p': { mb: '14px', fontWeight: '500' },
                        '& ul': { pl: '20px', mb: '14px', listStyleType: 'none', position: 'relative' },
                        '& li': { mb: '8px', position: 'relative', pl: '12px', _before: { content: '"•"', position: 'absolute', left: 0, color: 'brand.primary', fontWeight: 'bold' } },
                        '& strong': { color: 'brand.secondary', fontWeight: '700' },
                        '& .footer': { mt: '48px', pt: '24px', borderTop: '1px solid', borderColor: 'brand.border', fontSize: '13px' }
                    })}>
                        <p className={css({ fontSize: '15px', color: 'brand.secondary', fontWeight: '700' })}>온여정(OnVoy)은 이용자의 개인정보를 소중히 다루며, 관련 법령을 투명하게 준수합니다.</p>

                        <h3>제1조 개인정보의 수집 및 이용 목적</h3>
                        <p>회사는 다음의 목적을 위해 필요한 최소한의 개인정보를 수집하며, 수집된 정보는 목적 이외의 용도로는 사용되지 않습니다.</p>
                        <ul>
                            <li><strong>이용자 식별 및 본인 확인</strong>: [필수] 이메일 주소, 비밀번호, 닉네임</li>
                            <li><strong>서비스 이용에 따른 민원 처리 및 고지사항 전달</strong>: [필수] 이메일 주소, 닉네임</li>
                            <li><strong>서비스 분석 및 UX 개선 (Google Analytics, Firebase 이용)</strong>: [선택] 서비스 이용 기록, 접속 로그, 쿠키, IP 정보</li>
                            <li><strong>비인가 사용 방지 및 서비스 안정성 유지</strong>: [자동수집] 접속 IP, 서비스 이용 기록</li>
                        </ul>

                        <h3>제2조 개인정보의 처리 및 보유 기간</h3>
                        <p>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
                        <ul>
                            <li><strong>보유 기간</strong>: 원칙적으로 이용자가 서비스 회원 자격을 유지하는 동안 보관하며, 회원 탈퇴 시 즉시 파기합니다.</li>
                            <li>단, 관계 법령(전자상거래법 등)에 따라 보존할 필요가 있는 경우 해당 법령이 정한 기간 동안 보관합니다.</li>
                        </ul>

                        <h3>제3조 개인정보의 파기절차 및 방법</h3>
                        <p>회사는 개인정보 처리 목적이 달성된 후 다음과 같은 절차 및 방법에 따라 개인정보를 파기합니다.</p>
                        <h4>1. 파기절차</h4>
                        <p>개인정보는 처리 목적이 달성된 후 별도의 DB로 옮겨져(지류의 경우 별도의 서류함) 관련 법령 및 내부 방침에 따라 일정 기간 보관된 후 파기됩니다. 해당 개인정보는 법률에 의한 경우가 아니고서는 보유되는 이외의 다른 목적으로 이용되지 않습니다.</p>
                        <h4>2. 파기방법</h4>
                        <ul>
                            <li><strong>전자적 파일 형태</strong>: 기록을 재생할 수 없는 기술적 방법을 사용하여 영구 삭제합니다.</li>
                            <li><strong>종이에 출력된 개인정보</strong>: 분쇄기로 분쇄하거나 소각을 통해 파기합니다.</li>
                        </ul>

                        <h3>제4조 개인정보 처리 위탁</h3>
                        <p>회사는 원활한 서비스 제공을 위해 아래와 같은 외부 전문업체에 개인정보 처리를 위탁하고 있습니다. 위탁 시 관련 법령에 따라 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있으며 위탁 업무 내용이 변경될 경우 공지사항을 통해 안내합니다.</p>
                        <ul>
                            <li><strong>Vercel, Inc.</strong>: 호스팅 및 인프라 관리</li>
                            <li><strong>Supabase, Inc.</strong>: 회원 인증(Auth), 데이터베이스 및 보안 관리</li>
                            <li><strong>Google LLC (Google Analytics/Firebase)</strong>: 서비스 로그 분석 및 앱 안정성 확인</li>
                            <li><strong>Resend Labs</strong>: 서비스 공지 및 알림 메일 발송</li>
                        </ul>

                        <h3>제5조 정보주체와 법정대리인의 권리·의무 및 행사방법</h3>
                        <p>정보주체는 언제든지 자신의 개인정보를 조회, 수정, 삭제 요청하거나 서비스 탈퇴를 통해 개인정보 수집 동의를 철회할 수 있습니다.</p>
                        <ul>
                            <li><strong>행사 방법</strong>: 서비스 내 '마이페이지' {'>'} '프로필 수정' 또는 이메일 문의를 통해 본인 확인 절차를 거친 후 서면, 전자우편 등을 통해 권리를 행사하실 수 있습니다.</li>
                            <li>정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</li>
                        </ul>

                        <h3>제6조 국외 이전 및 데이터 리전</h3>
                        <p>본 서비스는 글로벌 클라우드 인프라를 활용하여 운영되며, 데이터의 안정성과 성능을 위해 아래의 리전에서 처리됩니다.</p>
                        <ul>
                            <li><strong>이전 국가 및 데이터 리전</strong>: 대한민국 서울 (ap-northeast-2)</li>
                            <li>회사는 향후 글로벌 서비스 확장에 따라 리전이 추가될 수 있으며, 이 경우 약관 개정을 통해 사전에 공지하겠습니다.</li>
                        </ul>

                        <h3>제7조 개인정보의 안전성 확보 조치</h3>
                        <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
                        <ul>
                            <li><strong>관리적 조치</strong>: 내부관리계획 수립 및 시행, 개인정보 보호 교육 실시 등</li>
                            <li><strong>기술적 조치</strong>: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
                            <li><strong>물리적 조치</strong>: 클라우드 인프라의 물리적 접근 통제 및 보안 구역 설정</li>
                        </ul>

                        <h3>제8조 개인정보 보호 책임자</h3>
                        <p>개인정보와 관련한 문의, 불만 처리 등은 아래의 책임자에게 문의하실 수 있습니다.</p>
                        <ul>
                            <li><strong>담당자</strong>: 지윤성 (개인 운영자)</li>
                            <li><strong>문의처</strong>: <a href="mailto:ysjee141@gmail.com" className={css({ borderBottom: '1px solid', color: 'brand.primary', fontWeight: '700' })}>ysjee141@gmail.com</a></li>
                        </ul>
                        <p style={{ marginTop: '12px' }}>개인정보 침해에 대한 신고나 상담이 필요한 경우 아래의 기관에 문의하실 수 있습니다.</p>
                        <ul>
                            <li>개인정보침해신고센터 : privacy.kisa.or.kr (국번없이 118)</li>
                            <li>대검찰청 사이버 수사과 : www.spo.go.kr (국번없이 1301)</li>
                            <li>경찰청 사이버 안전국 : https://ecrm.police.go.kr/ (국번없이 182)</li>
                        </ul>

                        <div className="footer">
                            <p><strong>공고일자</strong>: 2026년 4월 8일</p>
                            <p><strong>시행일자</strong>: 2026년 4월 8일</p>
                            <p><strong>이전 버전 확인</strong>: 현재 버전이 최초 제정된 방침입니다.</p>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
