'use client'

import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, MapPin, CalendarDays, Luggage, User } from 'lucide-react'
import InvitationBanner from '@/components/trips/InvitationBanner'
import TripSection from '@/components/trips/TripSection'
import { useState, useEffect } from 'react'

export default function HomeClient() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [nickname, setNickname] = useState<string>('여행자')
  const [ongoing, setOngoing] = useState<any[]>([])
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [completed, setCompleted] = useState<any[]>([])
  const [hasAnyTrip, setHasAnyTrip] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      setNickname(profile?.nickname || user?.email?.split('@')[0] || '여행자')

      // 1. 내가 멤버로 참여(수락)한 여행 ID들 가져오기
      const { data: memberTripData } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')

      const memberTripIds = memberTripData?.map((m: any) => m.trip_id) || []

      // 2. 내가 소유하거나 멤버인 여행 전체 가져오기
      let query = supabase
        .from('trips')
        .select('*, checklists(id, checklist_items(id, is_checked))')

      if (memberTripIds.length > 0) {
        query = query.or(`user_id.eq.${user.id},id.in.(${memberTripIds.join(',')})`)
      } else {
        query = query.eq('user_id', user.id)
      }

      const { data: trips } = await query.order('start_date', { ascending: true })

      const allTrips = trips || []

      // 3. 오늘 날짜 기준으로 상태별 분류
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
      setLoading(false)
    }

    fetchData()
  }, [supabase])

  if (loading) {
    return <div className={css({ w: '100%', py: '80px', textAlign: 'center', color: '#888' })}>여정을 불러오는 중...</div>
  }

  if (!user) {
    return (
      <div className={css({ w: '100%', py: { base: '40px', md: '80px' } })}>
        {/* Hero Section */}
        <section className={css({ textAlign: 'center', mb: '80px' })}>
          <h1 className={css({ fontSize: { base: '32px', md: '56px' }, fontWeight: '900', color: '#022C22', mb: '20px', lineHeight: 1.1, letterSpacing: '-0.02em' })}>
            OnVoy와 함께하는<br />
            <span className={css({ color: '#10B981' })}>완벽한 여행 계획</span>
          </h1>
          <p className={css({ fontSize: { base: '16px', md: '20px' }, color: '#666', maxW: '600px', mx: 'auto', mb: '40px', lineHeight: 1.6 })}>
            복잡한 여행 계획부터 꼼꼼한 체크리스트까지.<br />
            당신의 여행을 더 스마트하고 즐겁게 만들어 드립니다.
          </p>
          <div className={css({ display: 'flex', gap: '16px', justifyContent: 'center', flexDirection: { base: 'column', sm: 'row' } })}>
            <Link
              href="/signup"
              className={css({
                bg: '#111', color: 'white', px: '32px', py: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '18px', transition: 'all 0.2s', _hover: { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }
              })}
            >
              지금 시작하기
            </Link>
            <Link
              href="/login"
              className={css({
                bg: 'white', color: '#022C22', px: '32px', py: '16px', borderRadius: '12px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '18px', transition: 'all 0.2s', _hover: { bg: 'white', transform: 'translateY(-2px)' }
              })}
            >
              로그인하기
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '24px' })}>
          <div className={css({ bg: 'white', p: '32px', borderRadius: '24px', border: '1px solid #f0f0f0', transition: 'all 0.3s', _hover: { borderColor: '#10B981', transform: 'translateY(-5px)' } })}>
            <div className={css({ w: '48px', h: '48px', bg: '#ECFDF5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' })}>
              <CalendarDays size={24} color="#10B981" />
            </div>
            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', mb: '12px' })}>스마트 일정표</h3>
            <p className={css({ color: '#666', fontSize: '14px', lineHeight: 1.6 })}>주간 캘린더를 통해 여행 일정을 한눈에 파악하고 드래그하듯 간편하게 관리하세요.</p>
          </div>

          <div className={css({ bg: 'white', p: '32px', borderRadius: '24px', border: '1px solid #f0f0f0', transition: 'all 0.3s', _hover: { borderColor: '#34A853', transform: 'translateY(-5px)' } })}>
            <div className={css({ w: '48px', h: '48px', bg: '#e6f4ea', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' })}>
              <Luggage size={24} color="#34A853" />
            </div>
            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', mb: '12px' })}>꼼꼼한 체크리스트</h3>
            <p className={css({ color: '#666', fontSize: '14px', lineHeight: 1.6 })}>준비물 템플릿을 활용하고 진행률을 확인하며 빠짐없이 여행을 준비하세요.</p>
          </div>

          <div className={css({ bg: 'white', p: '32px', borderRadius: '24px', border: '1px solid #f0f0f0', transition: 'all 0.3s', _hover: { borderColor: '#FBBC05', transform: 'translateY(-5px)' } })}>
            <div className={css({ w: '48px', h: '48px', bg: '#fef7e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' })}>
              <MapPin size={24} color="#FBBC05" />
            </div>
            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', mb: '12px' })}>타임존 자동 계산</h3>
            <p className={css({ color: '#666', fontSize: '14px', lineHeight: 1.6 })}>현지 시간을 일일이 계산할 필요 없습니다. OnVoy가 실시간으로 맞춰 드립니다.</p>
          </div>

          <div className={css({ bg: 'white', p: '32px', borderRadius: '24px', border: '1px solid #f0f0f0', transition: 'all 0.3s', _hover: { borderColor: '#EA4335', transform: 'translateY(-5px)' } })}>
            <div className={css({ w: '48px', h: '48px', bg: '#fce8e6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' })}>
              <Plus size={24} color="#EA4335" />
            </div>
            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', mb: '12px' })}>실시간 스마트 알림</h3>
            <p className={css({ color: '#666', fontSize: '14px', lineHeight: 1.6 })}>설정한 일정에 맞춰 브라우저 알림을 보내드려 소중한 계획을 놓치지 않게 합니다.</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={css({ w: '100%' })}>
      <InvitationBanner />
      <div className={css({ maxW: 'screen-xl', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '16px', sm: '20px' } })}>
        <header className={css({ mb: { base: '28px', sm: '40px' }, display: 'flex', justifyContent: 'space-between', alignItems: { base: 'flex-start', sm: 'center' }, flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
          <div>
            <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: 'bold', color: '#022C22' })}>
              안녕하세요, {nickname}님! 👋
            </h1>
            <p className={css({ color: '#666', mt: '4px', fontSize: { base: '14px', sm: '16px' } })}>
              {ongoing.length > 0
                ? `현재 ${ongoing[0].destination} 여행 중이에요 ✈️`
                : upcoming.length > 0
                  ? `다음 여행까지 설레는 마음으로 준비하세요!`
                  : '새로운 여행을 계획해 보세요.'}
            </p>
          </div>
          <Link
            href="/trips/new"
            className={css({
              display: 'flex', alignItems: 'center', gap: '8px',
              bg: '#111', color: 'white', px: '20px', py: '12px',
              borderRadius: '12px', fontWeight: '600', transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              w: { base: '100%', sm: 'auto' }, justifyContent: 'center',
              _hover: { bg: '#333', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' },
            })}
          >
            <Plus size={20} /> 새 여행 만들기
          </Link>
        </header>

        {!hasAnyTrip ? (
          /* 여행이 하나도 없을 때 */
          <div className={css({
            bg: 'white', borderRadius: '16px', p: { base: '40px 20px', sm: '60px' },
            textAlign: 'center', border: '2px dashed #ddd',
          })}>
            <Luggage size={48} className={css({ mx: 'auto', mb: '16px', color: '#ccc' })} />
            <p className={css({ fontSize: '18px', fontWeight: '500', mb: '8px', color: '#555' })}>
              아직 계획된 여행이 없습니다.
            </p>
            <p className={css({ fontSize: '14px', color: '#999' })}>상단의 버튼을 눌러 첫 여행을 등록해보세요!</p>
          </div>
        ) : (
          <div>
            {/* ①  여행 중 */}
            <TripSection
              title="여행 중이에요! 🎉"
              subtitle="현재 진행 중인 여행"
              emoji="✈️"
              accentColor="#10B981"
              badgeBg="#ECFDF5"
              badgeColor="#059669"
              badgeLabel="여행 중"
              trips={ongoing}
              currentUserId={user.id}
              defaultOpen={true}
            />

            {/* ②  다가오는 여행 */}
            <TripSection
              title="다가오는 여행"
              subtitle="출발 전 설레는 여행"
              emoji="🗺️"
              accentColor="#34A853"
              badgeBg="#e6f4ea"
              badgeColor="#137333"
              badgeLabel="예정"
              trips={upcoming}
              currentUserId={user.id}
              defaultOpen={true}
            />

            {/* ③  다녀온 여행 */}
            <TripSection
              title="다녀온 여행"
              subtitle="소중한 추억이 된 여행"
              emoji="📸"
              accentColor="#9e9e9e"
              badgeBg="#f5f5f5"
              badgeColor="#666"
              badgeLabel="완료"
              trips={completed}
              currentUserId={user.id}
              defaultOpen={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
