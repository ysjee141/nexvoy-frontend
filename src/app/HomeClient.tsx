'use client'

import { createClient } from '@/utils/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, MapPin, CalendarDays, Luggage, User } from 'lucide-react'
import InvitationBanner from '@/components/trips/InvitationBanner'
import TripSection from '@/components/trips/TripSection'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CacheUtil } from '@/utils/cache'
import {
  Map, CheckSquare, Globe, Wallet,
  Link2, ChevronDown, ChevronUp, ArrowRight,
  Clock, Share2, Star, Zap, Sparkles, X
} from 'lucide-react'
import NicknamePrompt from '@/components/profile/NicknamePrompt'
import { isBetaTester } from '@/constants/testers'
import TesterNoticeModal from '@/components/layout/TesterNoticeModal'
import Skeleton from '@/components/ui/Skeleton'
import { useUIStore } from '@/stores/useUIStore'
import { useNetworkStore } from '@/stores/useNetworkStore'

// ── 주요 기능 카드 (Guide에서 이식) ──
const FEATURES = [
  {
      icon: <Map size={28} />,
      bg: 'bg.softCotton', color: 'brand.primary',
      title: '스마트한 여행 관리',
      desc: '목적지·날짜·인원을 등록하면 끝. 진행 중인 여행은 자동으로 상단에 강조 표시되어 한눈에 파악됩니다.',
      badge: '여행 관리',
  },
  {
      icon: <CalendarDays size={28} />,
      bg: 'bg.softCotton', color: 'brand.primaryDark',
      title: '세부 일정 완벽 관리',
      desc: '장소·시간·예산·메모·참고 URL까지. 일정을 탭하면 구글 맵 미리보기와 함께 모든 정보를 확인할 수 있습니다.',
      badge: '일정',
  },
  {
      icon: <User size={28} />,
      bg: 'brand.errorLight', color: 'brand.accent',
      title: '동행자와 함께하기',
      desc: '동행자를 이메일로 초대하고 편집/조회 권한으로 함께 계획하세요. 혼자 세우는 여행 계획은 이제 그만.',
      badge: '동행',
  },
  {
      icon: <CheckSquare size={28} />,
      bg: 'bg.softCotton', color: 'brand.primary',
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
      color: 'brand.primary',
      title: '여행을 만드세요',
      desc: '"새 여행 추가"를 눌러 여행지와 날짜를 입력하기만 하면 됩니다. 30초면 충분합니다.',
      highlight: '평균 30초 만에 여행 생성',
  },
  {
      num: '02',
      icon: <CalendarDays size={22} />,
      color: 'brand.primaryDark',
      title: '일정을 채우세요',
      desc: '장소를 검색해 일정에 추가하면 현지 통화·타임존이 자동으로 설정됩니다. 시차 계산은 저한테 맡기세요.',
      highlight: '현지 통화 & 한화 동시 표시',
  },
  {
      num: '03',
      icon: <Share2 size={22} />,
      color: 'brand.accent',
      title: '함께 계획하세요',
      desc: '동행자 이메일만 입력하면 즉시 초대됩니다. 각자의 아이디어를 실시간으로 반영할 수 있습니다.',
      highlight: '2초 만에 초대 완료',
  },
  {
      num: '04',
      icon: <CheckSquare size={22} />,
      color: 'brand.error',
      title: '완벽하게 준비하세요',
      desc: '체크리스트로 준비물을 꼼꼼하게 챙기시고, 출발 당일 든든하게 여행을 시작하세요.',
      highlight: '준비물 하나도 빠짐없이',
  },
]

// ── 차별화 기능 ──
const ADVANCED = [
  {
      icon: <Wallet size={20} />,
      color: 'brand.primary',
      title: '실시간 환율 자동 변환',
      desc: '홍콩달러, 엔화, 달러… 어떤 통화든 예상 금액을 자동으로 한화로 환산해 드립니다. 환율은 1시간마다 최신화됩니다.',
  },
  {
      icon: <MapPin size={20} />,
      color: 'brand.accent',
      title: '구글 맵 바로 열기',
      desc: '일정을 탭하면 구글 맵 미리보기이 뜹니다. 장소명을 누르면 앱 또는 웹으로 바로 이동. 길 찾기도 끊김 없이.',
  },
  {
      icon: <Clock size={20} />,
      color: 'brand.primary',
      title: '현지·한국 시간 동시 확인',
      desc: '시차 때문에 머리 아플 필요 없습니다. 현지 시간과 한국 시간을 나란히 보여드립니다.',
  },
  {
      icon: <Link2 size={20} />,
      color: 'brand.muted',
      title: '참고자료 URL 카드 미리보기',
      desc: '블로그, 예약 사이트 등 참고 링크를 저장하면 카드 형태의 미리보기로 깔끔하게 정리됩니다.',
  },
  {
      icon: <Globe size={20} />,
      color: 'brand.warning',
      title: '링크 하나로 여행 공유',
      desc: '공유 링크를 생성해 가족·친구에게 보내세요. 로그인 없이도 내 여행 일정을 볼 수 있습니다.',
  },
  {
      icon: <Star size={20} />,
      color: 'brand.error',
      title: '진행 중 일정 강조 표시',
      desc: '오늘 진행 중인 일정이 상단에 자동으로 표시됩니다. 여행 중에도 다음 일정을 한눈에 파악하세요.',
  },
]

// ── FAQ ──
const FAQS = [
  {
      q: '온여정는 무료인가요?',
      a: '네, 완전 무료예요! 별도 결제나 신용카드 등록 없이 바로 시작해 보세요.',
  },
  {
      q: '동행자는 몇 명까지 초대할 수 있나요?',
      a: '현재 초대 인원에 별도 제한은 없어요. 소규모 커플 여행부터 대규모 단체 여행까지 함께 즐거운 계획을 세워 보세요.',
  },
  {
      q: '여행 일정을 공유하면 상대방도 수정할 수 있나요?',
      a: '공유 링크는 읽기 전용입니다. 함께 수정하려면 동행자 초대 기능으로 직접 초대해 편집 권한을 나누어 보세요.',
  },
  {
      q: '환율은 얼마나 자주 업데이트되나요?',
      a: '환율 정보는 1시간마다 자동으로 최신 데이터로 업데이트돼요. 항상 따끈따끈한 최신 환율을 기준으로 예상 금액을 확인할 수 있답니다.',
  },
  {
      q: '모바일에서도 동일하게 사용할 수 있나요?',
      a: '물론이죠! 반응형으로 설계되어 스마트폰에서도 동일한 기능을 쾌적하게 사용할 수 있어요. 별도 앱 설치 없이도 충분히 편리하답니다.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
      <div className={css({
          border: '1px solid', borderColor: 'brand.border', borderRadius: '12px',
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
              <span className={css({ fontWeight: '600', fontSize: '15px', color: 'brand.secondary', lineHeight: 1.4 })}>{q}</span>
              {open ? <ChevronUp size={18} color="brand.muted" style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="brand.muted" style={{ flexShrink: 0 }} />}
          </button>
          {open && (
              <div className={css({ p: '16px 20px', fontSize: '14px', color: 'brand.muted', lineHeight: 1.7, bg: 'bg.softCotton', borderTop: '1px solid', borderTopColor: 'brand.border' })}>
                  {a}
              </div>
          )}
      </div>
  )
}

function SectionTitle({ badge, title, sub }: { badge: string; title: string; sub?: string }) {
  return (
      <div className={css({ textAlign: 'center', mb: '40px' })}>
          <span className={css({
              display: 'inline-block', fontSize: '11px', fontWeight: '700',
              color: 'brand.primary', letterSpacing: '1.5px', textTransform: 'uppercase',
              bg: 'bg.softCotton', px: '10px', py: '4px', borderRadius: '20px', mb: '12px',
          })}>
              {badge}
          </span>
          <h2 className={css({
              fontSize: { base: '22px', md: '32px' }, fontWeight: '700',
              color: 'brand.secondary', letterSpacing: '-0.02em', mb: '10px',
          })}>
              {title}
          </h2>
          {sub && (
              <p className={css({ fontSize: '15px', color: 'brand.muted', maxW: '480px', mx: 'auto', lineHeight: 1.6 })}>{sub}</p>
          )}
      </div>
  )
}

export default function HomeClient() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [nickname, setNickname] = useState<string>('여행자')
  const [ongoing, setOngoing] = useState<any[]>([])
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [completed, setCompleted] = useState<any[]>([])
  const [hasAnyTrip, setHasAnyTrip] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFirstCheck, setIsFirstCheck] = useState(true) // 최초 세션/캐시 확인용
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false)

  const { setMobileTitle, isNewTripModalOpen, setIsNewTripModalOpen } = useUIStore()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab')

  // 섹션 참조 (스크롤용)
  const ongoingRef = useRef<HTMLDivElement>(null)
  const upcomingRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef<HTMLDivElement>(null)

  const processTrips = useCallback((allTrips: any[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    setOngoing(allTrips.filter((t: any) => {
      const start = new Date(t.start_date)
      const end = new Date(t.end_date)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return start <= today && today <= end
    }))

    setUpcoming(allTrips.filter((t: any) => {
      const start = new Date(t.start_date)
      start.setHours(0, 0, 0, 0)
      return start > today
    }))

    setCompleted(allTrips.filter((t: any) => {
      const end = new Date(t.end_date)
      end.setHours(23, 59, 59, 999)
      return end < today
    }))

    setHasAnyTrip(allTrips.length > 0)
  }, [])

  const { isOnline } = useNetworkStore()

  const fetchNetworkBackground = useCallback(async () => {
    // 오프라인 상태라면 네트워크 동기화 스킵 (기존 캐시 유지)
    if (!isOnline) return;

    try {
        const { data: { user: networkUser } } = await supabase.auth.getUser()
        if (!networkUser) {
            setUser(null)
            setLoading(false)
            return
        }
        setUser(networkUser)
        // 오프라인 UI 판정을 위해 유저 정보 캐싱
        await CacheUtil.setAuthUser(networkUser)

        const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', networkUser.id)
            .single()

        setNickname(profile?.nickname || networkUser.email?.split('@')[0] || '여행자')
        if (profile) {
            await CacheUtil.setProfile(profile)
        }
        setShowNicknamePrompt(!profile?.nickname)

        // 1. 내가 멤버로 참여(수락)한 여행 ID들 가져오기
        const { data: memberTripData } = await supabase
            .from('trip_members')
            .select('trip_id')
            .eq('user_id', networkUser.id)
            .eq('status', 'accepted')

        const memberTripIds = memberTripData?.map((m: any) => m.trip_id) || []

        // 2. 내가 소유하거나 멤버인 여행 전체 가져오기
        let query = supabase
            .from('trips')
            .select('*, checklists(id, checklist_items(id, is_checked))')

        if (memberTripIds.length > 0) {
            query = query.or(`user_id.eq.${networkUser.id},id.in.(${memberTripIds.join(',')})`)
        } else {
            query = query.eq('user_id', networkUser.id)
        }

        const { data: trips } = await query.order('start_date', { ascending: true })

        const allTrips = trips || []
        processTrips(allTrips)
    } catch (e) {
        console.warn('Network sync failed, keeping local/cached state', e)
    } finally {
        setLoading(false)
    }
  }, [supabase, processTrips, isOnline])

  // 인증 상태 실시간 감지 (로그인 직후 세션 반영 대응)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser(session.user)
        fetchNetworkBackground()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, fetchNetworkBackground])

  useEffect(() => {
    async function loadCacheFirst() {
      // 1. 빠른 로컬 세션 확인 (네트워크 지연 없음)
      const { data: { session } } = await supabase.auth.getSession()
      let localUser = session?.user

      // 2. 만약 세션이 즉시 확인되지 않는다면 오프라인 캐시에서 확인
      if (!localUser) {
        localUser = await CacheUtil.getAuthUser()
      }

      if (localUser) {
        setUser(localUser)
        // 1. 프로필 캐시 확인 (닉네임 깜빡임 방지)
        const cachedProfile = await CacheUtil.getProfile()
        if (cachedProfile?.nickname) {
            setNickname(cachedProfile.nickname)
        } else {
            setNickname(localUser.email?.split('@')[0] || '여행자')
        }
      }
      // 세션을 확인했든 못 했든 초기 로딩 해제 (화면 진입)
      setLoading(false)
    }

    // 두 가지를 실행: 먼저 캐시 & 세션으로 화면을 채우고, 뒤이어 네트워크 통신으로 동기화 (SWR)
    loadCacheFirst().then(() => {
        setIsFirstCheck(false)
        fetchNetworkBackground()
    })
  }, [supabase, processTrips, fetchNetworkBackground])

  // 탭 파라미터에 따른 스크롤 처리
  useEffect(() => {
    if (!loading && activeTab) {
        const timer = setTimeout(() => {
            let targetRef = null
            if (activeTab === 'ongoing') targetRef = ongoingRef
            else if (activeTab === 'upcoming') targetRef = upcomingRef
            else if (activeTab === 'completed') targetRef = completedRef

            if (targetRef?.current) {
                targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 300) // 데이터 렌더링 대기 시간
        return () => clearTimeout(timer)
    }
  }, [loading, activeTab])

  // 최초 체크(세션/캐시 로드) 전까지는 스켈레톤 표시
  if (isFirstCheck && ongoing.length === 0 && upcoming.length === 0) {
    return (
      <div className={css({ w: '100%', maxW: 'screen-xl', mx: 'auto', p: '24px' })}>
        <Skeleton height="80px" borderRadius="16px" className={css({ mb: '40px' })} />
        <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '16px' })}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height="180px" borderRadius="16px" />)}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={css({ w: '100%', pb: '80px' })}>

          {/* ── 히어로 ── */}
          <section className={css({
              textAlign: 'center',
              py: { base: '64px', md: '100px' },
              px: '16px',
              bg: 'white',
              borderRadius: '24px',
              mb: '72px',
              position: 'relative',
              overflow: 'hidden',
          })}>
              <div className={css({ position: 'absolute', top: '-60px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', bg: 'brand.primary/3' })} />
              <div className={css({ position: 'absolute', bottom: '-40px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', bg: 'brand.secondary/3' })} />
              <div className={css({ position: 'absolute', top: '20%', left: '8%', width: '80px', height: '80px', borderRadius: '50%', bg: 'brand.accent/5' })} />

              <div className={css({
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  bg: 'bg.softCotton', color: 'brand.primary', fontSize: '12px', fontWeight: '700',
                  px: '12px', py: '5px', borderRadius: '20px', mb: '20px',
                  letterSpacing: '0.5px',
              })}>
                  <Sparkles size={13} /> 무료로 사용할 수 있어요
              </div>

              <h1 className={css({
                  fontSize: { base: '30px', md: '48px' }, fontWeight: '700',
                  color: 'brand.secondary', mb: '20px', letterSpacing: '-0.03em', lineHeight: 1.15,
              })}>
                  여행 계획, 가이드 없이도<br />
                  <span className={css({ color: 'brand.primary' })}>더 쉽고 즐겁게</span> 세워 보세요
              </h1>
              <p className={css({
                  fontSize: { base: '15px', md: '18px' }, color: 'brand.muted',
                  maxW: '520px', mx: 'auto', lineHeight: 1.8, mb: '36px', wordBreak: 'keep-all',
              })}>
                  일정 관리부터 환율 변환, 동행자와의 계획까지.<br />
                  복잡한 준비는 온여정에게 맡기고, 오직 여행의 설렘에만 집중하세요!
              </p>
              <div className={css({ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' })}>
                  <Link href="/signup" className={css({
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      bg: 'brand.primary', color: 'white', fontWeight: '700', fontSize: '15px',
                       px: '28px', py: '14px', borderRadius: '16px', textDecoration: 'none',
                      boxShadow: '0 6px 20px rgba(37, 99, 235, 0.25)',
                      transition: 'all 0.2s',
                      _hover: { bg: 'brand.primaryDark', transform: 'translateY(-2px)', boxShadow: '0 10px 28px rgba(37, 99, 235, 0.35)' },
                  })}>
                      지금 바로 시작하기 <ArrowRight size={17} />
                  </Link>
                  <Link href="/login" className={css({
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      bg: 'white', color: 'brand.secondary', fontWeight: '600', fontSize: '15px',
                      px: '24px', py: '14px', borderRadius: '14px', textDecoration: 'none',
                      border: '1px solid', borderColor: 'brand.border',
                      transition: 'all 0.2s',
                      _hover: { bg: 'bg.softCotton', borderColor: 'brand.muted' },
                  })}>
                      로그인하기
                  </Link>
              </div>
          </section>

          {/* ── 주요 기능 ── */}
          <section className={css({ mb: '72px' })}>
              <SectionTitle badge="핵심 기능" title="여행에 필요한 모든 것, 한 곳에" sub="여러 앱을 오갈 필요 없습니다. 온여정 하나로 충분합니다." />
              <div className={css({
                  display: 'grid',
                  gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                  gap: '16px',
              })}>
                  {FEATURES.map(f => (
                      <div key={f.title} className={css({
                          bg: 'white', border: '1px solid', borderColor: 'brand.border', borderRadius: '18px',
                          p: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
                          transition: 'all 0.2s',
                          _hover: { transform: 'translateY(-4px)', boxShadow: 'floating', borderColor: 'transparent' },
                      })}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div className={css({ width: '52px', height: '52px', borderRadius: '14px', background: 'bg.softCotton', color: 'brand.primary', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                                  {f.icon}
                              </div>
                              <span className={css({ fontSize: '11px', fontWeight: '700', color: 'brand.primary', background: 'bg.softCotton', padding: '3px 8px', borderRadius: '20px' })}>{f.badge}</span>
                          </div>
                          <h3 className={css({ fontWeight: '700', fontSize: '16px', color: 'brand.secondary', lineHeight: 1.3 })}>{f.title}</h3>
                          <p className={css({ fontSize: '13px', color: 'brand.muted', lineHeight: 1.7 })}>{f.desc}</p>
                      </div>
                  ))}
              </div>
          </section>

          {/* ── 사용 흐름 ── */}
          <section className={css({ mb: '72px' })}>
              <SectionTitle badge="시작하기" title="딱 4단계면 충분합니다" sub="어려운 설정은 NO! 가벼운 마음으로 바로 첫 여행을 만들어 보세요. ✨" />
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                  {STEPS.map((s, i) => (
                      <div key={s.num} className={css({
                          bg: 'white', border: '1px solid', borderColor: 'brand.border', borderRadius: '16px',
                          p: { base: '20px', md: '22px 28px' },
                          display: 'flex', gap: '18px', alignItems: 'flex-start',
                          transition: 'all 0.2s',
                          _hover: { boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: 'brand.border' },
                      })}>
                          <div className={css({ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' })}>
                              <div className={css({ width: '48px', height: '48px', borderRadius: '14px', background: 'bg.softCotton', color: 'brand.primary', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                                  {s.icon}
                              </div>
                              {i < STEPS.length - 1 && <div className={css({ width: '2px', height: '20px', background: 'brand.border', borderRadius: '2px' })} />}
                          </div>
                          <div className={css({ flex: 1, pt: '4px' })}>
                              <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', mb: '5px', flexWrap: 'wrap' })}>
                                  <span className={css({ fontSize: '11px', fontWeight: '700', color: 'brand.muted', letterSpacing: '1px' })}>{s.num}</span>
                                  <h3 className={css({ fontWeight: '700', fontSize: '16px', color: 'brand.secondary' })}>{s.title}</h3>
                                  <span className={css({ fontSize: '11px', fontWeight: '700', color: 'brand.primary', background: 'bg.softCotton', padding: '2px 8px', borderRadius: '20px' })}>
                                      ✓ {s.highlight}
                                  </span>
                              </div>
                              <p className={css({ fontSize: '14px', color: 'brand.muted', lineHeight: 1.65 })}>{s.desc}</p>
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
                          bg: 'white', border: '1px solid', borderColor: 'brand.border', borderRadius: '14px',
                          p: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start',
                          transition: 'all 0.2s',
                          _hover: { boxShadow: '0 4px 14px rgba(0,0,0,0.07)', borderColor: 'brand.border' },
                      })}>
                          <div className={css({ width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0, background: 'bg.softCotton', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'brand.primary' })}>
                              {a.icon}
                          </div>
                          <div>
                              <h4 className={css({ fontWeight: '700', fontSize: '14px', color: 'brand.secondary', mb: '5px' })}>{a.title}</h4>
                              <p className={css({ fontSize: '13px', color: 'brand.muted', lineHeight: 1.65 })}>{a.desc}</p>
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
              bg: 'linear-gradient(135deg, brand.primaryDark 0%, brand.primary 100%)',
              borderRadius: '20px',
              py: { base: '48px', md: '68px' },
              px: '20px',
              position: 'relative',
              overflow: 'hidden',
          })}>
              <div className={css({ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', bg: 'white/5' })} />
              <div className={css({ position: 'absolute', bottom: '-30px', left: '-30px', width: '150px', height: '150px', borderRadius: '50%', bg: 'white/5' })} />
              <div className={css({ display: 'inline-flex', alignItems: 'center', gap: '6px', bg: 'white/15', color: 'white', fontSize: '12px', fontWeight: '700', px: '12px', py: '5px', borderRadius: '20px', mb: '16px' })}>
                  <Zap size={13} /> 지금 바로 시작하세요
              </div>
              <h2 className={css({ fontSize: { base: '24px', md: '34px' }, fontWeight: '700', color: 'white', mb: '12px', letterSpacing: '-0.02em', lineHeight: 1.2 })}>
                  다음 여행, 온여정와<br />함께 계획하세요 ✈️
              </h2>
              <p className={css({ fontSize: '15px', color: 'white/85', mb: '32px', lineHeight: 1.7, wordBreak: 'keep-all' })}>
                  무료 계정 하나로 무제한 여행을 관리해 보세요.<br />
                  카드 등록이나 복잡한 절차 없이, 누구나 바로 시작할 수 있어요.
              </p>
              <Link href="/signup" className={css({
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  bg: 'white', color: 'brand.primaryDark', fontWeight: '700', fontSize: '16px',
                  px: '36px', py: '16px', borderRadius: '14px', textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                  transition: 'all 0.2s',
                  _hover: { transform: 'translateY(-3px)', boxShadow: '0 10px 32px rgba(0,0,0,0.22)' },
              })}>
                  지금 바로 시작하기 <ArrowRight size={18} />
              </Link>
          </section>
      </div>
    )
  }

  return (
    <div className={css({ w: '100%' })}>
      <InvitationBanner />
      {user && isBetaTester(user.id) && <TesterNoticeModal userId={user.id} />}
      <div className={css({ maxW: 'screen-xl', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '16px', sm: '20px' } })}>
        {showNicknamePrompt && <NicknamePrompt onClose={() => setShowNicknamePrompt(false)} />}
        <header className={css({ 
          mb: { base: '40px', sm: '72px' }, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { base: 'flex-start', sm: 'flex-end' }, 
          flexDirection: { base: 'column', sm: 'row' }, 
          gap: '24px',
          pb: '24px',
          borderBottom: '1px solid',
          borderColor: 'brand.border'
        })}>
          <div>
            <h1 className={css({ fontSize: { base: '28px', sm: '36px' }, fontWeight: '700', color: 'brand.secondary', letterSpacing: '-1px' })}>
                안녕하세요, {nickname}님! 👋
            </h1>
            <p className={css({ color: 'brand.muted', mt: '12px', fontSize: { base: '16px', sm: '20px' }, fontWeight: '500', letterSpacing: '-0.4px' })}>
              {ongoing.length > 0
                ? `현재 ${ongoing[0].destination} 여행 중이에요 ✈️`
                : upcoming.length > 0
                  ? `다음 여행까지 설레는 마음으로 준비하세요!`
                  : '새로운 여행을 계획해 보세요.'}
            </p>
          </div>
          <button
            onClick={() => setIsNewTripModalOpen(true)}
            className={css({
              display: 'flex', alignItems: 'center', gap: '8px',
              bg: 'brand.primary', color: 'white', px: '24px', py: '14px',
              borderRadius: '16px', fontWeight: '700', transition: 'all 0.2s',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
              w: { base: '100%', sm: 'auto' }, justifyContent: 'center',
              border: 'none', cursor: 'pointer',
              _hover: { bg: 'brand.primaryDark', transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(37, 99, 235, 0.35)' },
              _active: { transform: 'scale(0.96)' }
            })}
          >
            <Plus size={22} strokeWidth={2.5} /> 새 여행 만들기
          </button>
        </header>


        {!hasAnyTrip ? (
          /* 여행이 하나도 없을 때 또는 로딩 중일 때 */
          loading && ongoing.length === 0 ? (
            <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '16px' })}>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} height="180px" borderRadius="16px" />
              ))}
            </div>
          ) : (
            <div className={css({
              bg: 'white', borderRadius: '16px', p: { base: '40px 20px', sm: '60px' },
              textAlign: 'center', border: '2px dashed', borderColor: 'brand.border',
            })}>
              <Luggage size={48} className={css({ mx: 'auto', mb: '16px', color: 'brand.border' })} />
              <p className={css({ fontSize: '18px', fontWeight: '500', mb: '8px', color: 'brand.secondary' })}>
                아직 계획된 여행이 없네요.
              </p>
              <p className={css({ fontSize: '14px', color: 'brand.muted' })}>새로운 설렘을 위해 첫 여정을 만들어 볼까요? 🗺️</p>
            </div>
          )
        ) : (
          <div>
            <div ref={ongoingRef}>
                <TripSection
                    title="여행 중이에요! 🎉"
                    subtitle="현재 진행 중인 여행"
                    emoji="✈️"
                    accentColor="brand.accent"
                    badgeBg="bg.softCotton"
                    badgeColor="brand.accent"
                    badgeLabel="여행 중"
                    trips={ongoing}
                    currentUserId={user.id}
                    defaultOpen={activeTab === 'ongoing' || (!activeTab && ongoing.length > 0)}
                />
            </div>

            {/* ②  다가오는 여행 */}
            <div ref={upcomingRef}>
                <TripSection
                    title="다가오는 여행"
                    subtitle="출발 전 설레는 여행"
                    emoji="🗺️"
                    accentColor="brand.primary"
                    badgeBg="bg.softCotton"
                    badgeColor="brand.primary"
                    badgeLabel="예정"
                    trips={upcoming}
                    currentUserId={user.id}
                    defaultOpen={activeTab === 'upcoming' || (!activeTab && upcoming.length > 0)}
                />
            </div>

            {/* ③  다녀온 여행 */}
            <div ref={completedRef}>
                <TripSection
                    title="다녀온 여행"
                    subtitle="소중한 추억이 된 여행"
                    emoji="📸"
                    accentColor="brand.muted"
                    badgeBg="bg.softCotton"
                    badgeColor="brand.muted"
                    badgeLabel="완료"
                    trips={completed}
                    currentUserId={user.id}
                    defaultOpen={activeTab === 'completed'}
                />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
