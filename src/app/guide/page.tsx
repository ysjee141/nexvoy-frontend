'use client'

import { useState } from 'react'
import Link from 'next/link'
import { css } from 'styled-system/css'
import {
    Map, CalendarDays, Users, CheckSquare, Globe, Wallet,
    Link2, MapPin, ChevronDown, ChevronUp, ArrowRight,
    Clock, Share2, Plus, Star, Zap, Sparkles
} from 'lucide-react'

// ── 주요 기능 카드 ──
const FEATURES = [
    {
        icon: <Map size={28} />,
        bg: '#e8f0fe', color: '#4285F4',
        title: '스마트한 여행 관리',
        desc: '목적지·날짜·인원을 등록하면 끝. 진행 중인 여행은 자동으로 상단에 강조 표시되어 한눈에 파악됩니다.',
        badge: '여행 관리',
    },
    {
        icon: <CalendarDays size={28} />,
        bg: '#e6f4ea', color: '#34A853',
        title: '세부 일정 완벽 관리',
        desc: '장소·시간·예산·메모·참고 URL까지. 일정을 탭하면 구글 맵 미리보기와 함께 모든 정보를 확인할 수 있습니다.',
        badge: '일정',
    },
    {
        icon: <Users size={28} />,
        bg: '#fce8b2', color: '#E37400',
        title: '실시간 협업',
        desc: '동행자를 이메일로 초대하고 편집자/뷰어 권한으로 함께 계획하세요. 혼자 세우는 여행 계획은 이제 그만.',
        badge: '협업',
    },
    {
        icon: <CheckSquare size={28} />,
        bg: '#fde8e8', color: '#EA4335',
        title: '여행 준비물 체크리스트',
        desc: '여권부터 충전기까지. 준비물을 체크리스트로 등록하고 빠뜨린 것 없이 완벽하게 챙기세요.',
        badge: '체크리스트',
    },
]

// ── 사용 흐름 단계 ──
const STEPS = [
    {
        num: '01',
        icon: <Plus size={22} />,
        color: '#4285F4',
        title: '여행을 만드세요',
        desc: '"새 여행 추가"를 눌러 여행지와 날짜를 입력하기만 하면 됩니다. 30초면 충분합니다.',
        highlight: '평균 30초 만에 여행 생성',
    },
    {
        num: '02',
        icon: <CalendarDays size={22} />,
        color: '#34A853',
        title: '일정을 채우세요',
        desc: '장소를 검색해 일정에 추가하면 현지 통화·타임존이 자동으로 설정됩니다. 시차 계산은 저한테 맡기세요.',
        highlight: '현지 통화 & 한화 동시 표시',
    },
    {
        num: '03',
        icon: <Share2 size={22} />,
        color: '#FBBC05',
        title: '함께 계획하세요',
        desc: '동행자 이메일만 입력하면 즉시 초대됩니다. 각자의 아이디어를 실시간으로 반영할 수 있습니다.',
        highlight: '2초 만에 초대 완료',
    },
    {
        num: '04',
        icon: <CheckSquare size={22} />,
        color: '#EA4335',
        title: '완벽하게 준비하세요',
        desc: '체크리스트로 준비물을 꼼꼼하게 챙기고, 출발 당일 든든하게 여행을 시작하세요.',
        highlight: '준비물 하나도 빠짐없이',
    },
]

// ── 차별화 기능 ──
const ADVANCED = [
    {
        icon: <Wallet size={20} />,
        color: '#34A853',
        title: '실시간 환율 자동 변환',
        desc: '홍콩달러, 엔화, 달러… 어떤 통화든 예상 금액을 자동으로 한화로 환산해 드립니다. 환율은 1시간마다 최신화됩니다.',
    },
    {
        icon: <MapPin size={20} />,
        color: '#F4511E',
        title: '구글 맵 바로 열기',
        desc: '일정을 탭하면 구글 맵 미리보기가 뜹니다. 장소명을 누르면 앱 또는 웹으로 바로 이동. 길 찾기도 끊김 없이.',
    },
    {
        icon: <Clock size={20} />,
        color: '#4285F4',
        title: '현지·한국 시간 동시 확인',
        desc: '시차 때문에 머리 아플 필요 없습니다. 현지 시간과 한국 시간을 나란히 보여드립니다.',
    },
    {
        icon: <Link2 size={20} />,
        color: '#9E9E9E',
        title: '참고자료 URL 카드 미리보기',
        desc: '블로그, 예약 사이트 등 참고 링크를 저장하면 카드 형태의 미리보기로 깔끔하게 정리됩니다.',
    },
    {
        icon: <Globe size={20} />,
        color: '#FBBC05',
        title: '링크 하나로 여행 공유',
        desc: '공유 링크를 생성해 가족·친구에게 보내세요. 로그인 없이도 내 여행 일정을 볼 수 있습니다.',
    },
    {
        icon: <Star size={20} />,
        color: '#EA4335',
        title: '진행 중 일정 강조 표시',
        desc: '오늘 진행 중인 일정이 상단에 자동으로 표시됩니다. 여행 중에도 다음 일정을 한눈에 파악하세요.',
    },
]

// ── FAQ ──
const FAQS = [
    {
        q: 'Next Voyage는 무료인가요?',
        a: '네, 완전 무료입니다. 별도 결제나 신용카드 등록 없이 바로 사용하실 수 있습니다.',
    },
    {
        q: '동행자는 몇 명까지 초대할 수 있나요?',
        a: '현재 초대 인원에 별도 제한은 없습니다. 소규모 커플 여행부터 대규모 단체 여행까지 함께 계획하세요.',
    },
    {
        q: '여행 일정을 공유하면 상대방도 수정할 수 있나요?',
        a: '공유 링크는 읽기 전용입니다. 함께 수정하려면 협업 기능으로 직접 초대해 편집자 권한을 부여하세요.',
    },
    {
        q: '환율은 얼마나 자주 업데이트되나요?',
        a: '환율 정보는 1시간마다 자동으로 최신 데이터로 업데이트됩니다. 항상 비교적 최신 환율을 기준으로 예상 금액을 확인할 수 있습니다.',
    },
    {
        q: '모바일에서도 동일하게 사용할 수 있나요?',
        a: '물론입니다. 반응형으로 설계되어 스마트폰에서도 동일한 기능을 쾌적하게 사용할 수 있습니다. 별도 앱 설치도 필요 없습니다.',
    },
]

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div className={css({
            border: '1px solid #eee', borderRadius: '12px',
            overflow: 'hidden', transition: 'box-shadow 0.2s',
            _hover: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        })}>
            <button
                onClick={() => setOpen(v => !v)}
                className={css({
                    w: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: '16px 20px', bg: 'white', border: 'none', cursor: 'pointer',
                    textAlign: 'left', gap: '12px',
                })}
            >
                <span className={css({ fontWeight: '600', fontSize: '15px', color: '#111', lineHeight: 1.4 })}>{q}</span>
                {open ? <ChevronUp size={18} color="#aaa" style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="#aaa" style={{ flexShrink: 0 }} />}
            </button>
            {open && (
                <div className={css({ p: '16px 20px', fontSize: '14px', color: '#555', lineHeight: 1.7, bg: '#fafafa', borderTop: '1px solid #f0f0f0' })}>
                    {a}
                </div>
            )}
        </div>
    )
}

export default function GuidePage() {
    return (
        <div className={css({ w: '100%', pb: '80px' })}>

            {/* ── 히어로 ── */}
            <section className={css({
                textAlign: 'center',
                py: { base: '56px', md: '88px' },
                px: '16px',
                bg: 'linear-gradient(160deg, #f8faff 0%, #eef2ff 55%, #f0fdf4 100%)',
                borderRadius: '20px',
                mb: '64px',
                position: 'relative',
                overflow: 'hidden',
            })}>
                <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(66,133,244,0.07)' }} />
                <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(52,168,83,0.07)' }} />
                <div style={{ position: 'absolute', top: '20%', left: '8%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(251,188,5,0.06)' }} />

                <div className={css({
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    bg: '#e8f0fe', color: '#4285F4', fontSize: '12px', fontWeight: '700',
                    px: '12px', py: '5px', borderRadius: '20px', mb: '20px',
                    letterSpacing: '0.5px',
                })}>
                    <Sparkles size={13} /> 무료로 사용할 수 있어요
                </div>

                <h1 className={css({
                    fontSize: { base: '30px', md: '48px' }, fontWeight: '900',
                    color: '#111', mb: '20px', letterSpacing: '-0.03em', lineHeight: 1.15,
                })}>
                    여행 계획, 이제<br />
                    <span className={css({ color: '#4285F4' })}>더 쉽고 즐겁게</span> 세우세요
                </h1>
                <p className={css({
                    fontSize: { base: '15px', md: '18px' }, color: '#555',
                    maxW: '520px', mx: 'auto', lineHeight: 1.8, mb: '36px', wordBreak: 'keep-all',
                })}>
                    일정 관리부터 환율 변환, 동행자 협업까지.<br />
                    Next Voyage 하나로 여행의 모든 것을 해결하세요.
                </p>
                <div className={css({ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' })}>
                    <Link href="/signup" className={css({
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        bg: '#4285F4', color: 'white', fontWeight: '700', fontSize: '15px',
                        px: '28px', py: '14px', borderRadius: '14px', textDecoration: 'none',
                        boxShadow: '0 6px 20px rgba(66,133,244,0.35)',
                        transition: 'all 0.2s',
                        _hover: { bg: '#3367d6', transform: 'translateY(-2px)', boxShadow: '0 10px 28px rgba(66,133,244,0.4)' },
                    })}>
                        지금 무료로 시작하기 <ArrowRight size={17} />
                    </Link>
                    <Link href="/" className={css({
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        bg: 'white', color: '#333', fontWeight: '600', fontSize: '15px',
                        px: '24px', py: '14px', borderRadius: '14px', textDecoration: 'none',
                        border: '1px solid #e0e0e0',
                        transition: 'all 0.2s',
                        _hover: { bg: '#f8f8f8', borderColor: '#ccc' },
                    })}>
                        내 여행 보기
                    </Link>
                </div>
            </section>

            {/* ── 주요 기능 ── */}
            <section className={css({ mb: '72px' })}>
                <SectionTitle badge="핵심 기능" title="여행에 필요한 모든 것, 한 곳에" sub="여러 앱을 오갈 필요 없습니다. Next Voyage 하나로 충분합니다." />
                <div className={css({
                    display: 'grid',
                    gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: '16px',
                })}>
                    {FEATURES.map(f => (
                        <div key={f.title} className={css({
                            bg: 'white', border: '1px solid #eee', borderRadius: '18px',
                            p: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
                            transition: 'all 0.2s',
                            _hover: { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.09)', borderColor: 'transparent' },
                        })}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ width: 52, height: 52, borderRadius: 14, background: f.bg, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {f.icon}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: f.color, background: f.bg, padding: '3px 8px', borderRadius: 20 }}>{f.badge}</span>
                            </div>
                            <h3 className={css({ fontWeight: '800', fontSize: '16px', color: '#111', lineHeight: 1.3 })}>{f.title}</h3>
                            <p className={css({ fontSize: '13px', color: '#666', lineHeight: 1.7 })}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 사용 흐름 ── */}
            <section className={css({ mb: '72px' })}>
                <SectionTitle badge="시작하기" title="딱 4단계면 충분합니다" sub="복잡한 설정 없이 바로 쓸 수 있습니다. 지금 바로 첫 여행을 만들어보세요." />
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                    {STEPS.map((s, i) => (
                        <div key={s.num} className={css({
                            bg: 'white', border: '1px solid #eee', borderRadius: '16px',
                            p: { base: '20px', md: '22px 28px' },
                            display: 'flex', gap: '18px', alignItems: 'flex-start',
                            transition: 'all 0.2s',
                            _hover: { boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: '#e0e0e0' },
                        })}>
                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: s.color + '15', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {s.icon}
                                </div>
                                {i < STEPS.length - 1 && <div style={{ width: 2, height: 20, background: '#f0f0f0', borderRadius: 2 }} />}
                            </div>
                            <div className={css({ flex: 1, pt: '4px' })}>
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', mb: '5px', flexWrap: 'wrap' })}>
                                    <span className={css({ fontSize: '11px', fontWeight: '800', color: '#ccc', letterSpacing: '1px' })}>{s.num}</span>
                                    <h3 className={css({ fontWeight: '800', fontSize: '16px', color: '#111' })}>{s.title}</h3>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.color + '12', padding: '2px 8px', borderRadius: 20 }}>
                                        ✓ {s.highlight}
                                    </span>
                                </div>
                                <p className={css({ fontSize: '14px', color: '#555', lineHeight: 1.65 })}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 차별화 기능 ── */}
            <section className={css({ mb: '72px' })}>
                <SectionTitle badge="더 알아보기" title="알면 알수록 편리한 기능들" sub="여행을 더 스마트하게 만들어주는 세심한 기능들을 확인하세요." />
                <div className={css({
                    display: 'grid',
                    gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                    gap: '14px',
                })}>
                    {ADVANCED.map(a => (
                        <div key={a.title} className={css({
                            bg: 'white', border: '1px solid #eee', borderRadius: '14px',
                            p: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start',
                            transition: 'all 0.2s',
                            _hover: { boxShadow: '0 4px 14px rgba(0,0,0,0.07)', borderColor: '#e0e0e0' },
                        })}>
                            <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color }}>
                                {a.icon}
                            </div>
                            <div>
                                <h4 className={css({ fontWeight: '700', fontSize: '14px', color: '#111', mb: '5px' })}>{a.title}</h4>
                                <p className={css({ fontSize: '13px', color: '#666', lineHeight: 1.65 })}>{a.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className={css({ mb: '72px' })}>
                <SectionTitle badge="FAQ" title="자주 묻는 질문" sub="궁금한 점이 있으시면 언제든지 편하게 확인하세요." />
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px', maxW: '720px', mx: 'auto' })}>
                    {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
                </div>
            </section>

            {/* ── CTA 하단 ── */}
            <section className={css({
                textAlign: 'center',
                bg: 'linear-gradient(135deg, #1a56db 0%, #34A853 100%)',
                borderRadius: '20px',
                py: { base: '48px', md: '68px' },
                px: '20px',
                position: 'relative',
                overflow: 'hidden',
            })}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <div className={css({ display: 'inline-flex', alignItems: 'center', gap: '6px', bg: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '12px', fontWeight: '700', px: '12px', py: '5px', borderRadius: '20px', mb: '16px' })}>
                    <Zap size={13} /> 지금 바로 시작하세요
                </div>
                <h2 className={css({ fontSize: { base: '24px', md: '34px' }, fontWeight: '900', color: 'white', mb: '12px', letterSpacing: '-0.02em', lineHeight: 1.2 })}>
                    다음 여행, Next Voyage와<br />함께 계획하세요 ✈️
                </h2>
                <p className={css({ fontSize: '15px', color: 'rgba(255,255,255,0.83)', mb: '32px', lineHeight: 1.7, wordBreak: 'keep-all' })}>
                    무료 계정 하나로 무제한 여행을 관리하세요.<br />
                    신용카드도, 복잡한 설정도 필요 없습니다.
                </p>
                <Link href="/signup" className={css({
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    bg: 'white', color: '#1a56db', fontWeight: '800', fontSize: '16px',
                    px: '36px', py: '16px', borderRadius: '14px', textDecoration: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                    transition: 'all 0.2s',
                    _hover: { transform: 'translateY(-3px)', boxShadow: '0 10px 32px rgba(0,0,0,0.22)' },
                })}>
                    무료로 시작하기 <ArrowRight size={18} />
                </Link>
            </section>
        </div>
    )
}

function SectionTitle({ badge, title, sub }: { badge: string; title: string; sub?: string }) {
    return (
        <div className={css({ textAlign: 'center', mb: '40px' })}>
            <span className={css({
                display: 'inline-block', fontSize: '11px', fontWeight: '800',
                color: '#4285F4', letterSpacing: '1.5px', textTransform: 'uppercase',
                bg: '#e8f0fe', px: '10px', py: '4px', borderRadius: '20px', mb: '12px',
            })}>
                {badge}
            </span>
            <h2 className={css({
                fontSize: { base: '22px', md: '32px' }, fontWeight: '900',
                color: '#111', letterSpacing: '-0.02em', mb: '10px',
            })}>
                {title}
            </h2>
            {sub && (
                <p className={css({ fontSize: '15px', color: '#777', maxW: '480px', mx: 'auto', lineHeight: 1.6 })}>{sub}</p>
            )}
        </div>
    )
}
