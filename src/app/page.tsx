import { createClient } from '@/utils/supabase/server'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, MapPin, CalendarDays, Luggage, User } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()

  // 서버 컴포넌트 환경에서 세션 확인 (없을 시 미들웨어에서 /login 으로 리다이렉트됨을 보장)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className={css({ w: '100%', py: { base: '40px', md: '80px' } })}>
        {/* Hero Section */}
        <section className={css({ textAlign: 'center', mb: '80px' })}>
          <h1 className={css({ fontSize: { base: '32px', md: '56px' }, fontWeight: '900', color: '#111', mb: '20px', lineHeight: 1.1, letterSpacing: '-0.02em' })}>
            Nexvoy와 함께하는<br />
            <span className={css({ color: '#4285F4' })}>완벽한 여행 계획</span>
          </h1>
          <p className={css({ fontSize: { base: '16px', md: '20px' }, color: '#666', maxW: '600px', mx: 'auto', mb: '40px', lineHeight: 1.6 })}>
            복잡한 여행 계획부터 꼼꼼한 체크리스트까지.<br />
            당신의 여행을 더 스마트하고 즐겁게 만들어 드립니다.
          </p>
          <div className={css({ display: 'flex', gap: '16px', justifyContent: 'center', flexDirection: { base: 'column', sm: 'row' } })}>
            <Link
              href="/login"
              className={css({
                bg: '#111', color: 'white', px: '32px', py: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '18px', transition: 'all 0.2s', _hover: { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }
              })}
            >
              지금 시작하기
            </Link>
            <Link
              href="/login"
              className={css({
                bg: 'white', color: '#111', px: '32px', py: '16px', borderRadius: '12px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '18px', transition: 'all 0.2s', _hover: { bg: '#f9f9f9', transform: 'translateY(-2px)' }
              })}
            >
              로그인하기
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '24px' })}>
          <div className={css({ bg: 'white', p: '32px', borderRadius: '24px', border: '1px solid #f0f0f0', transition: 'all 0.3s', _hover: { borderColor: '#4285F4', transform: 'translateY(-5px)' } })}>
            <div className={css({ w: '48px', h: '48px', bg: '#e8f0fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' })}>
              <CalendarDays size={24} color="#4285F4" />
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
            <p className={css({ color: '#666', fontSize: '14px', lineHeight: 1.6 })}>현지 시간을 일일이 계산할 필요 없습니다. Nexvoy가 실시간으로 맞춰 드립니다.</p>
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

  const nickname = user?.user_metadata?.nickname || user?.email?.split('@')[0] || '여행자'

  // 다가오는 여행 데이터 fetch (임시 정렬 로직 포함, 체크리스트 데이터 조인)
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, checklists(id, checklist_items(id, is_checked))')
    .eq('user_id', user?.id)
    .order('start_date', { ascending: true })
    .limit(3)

  return (
    <div className={css({ w: '100%', py: '40px' })}>
      <header className={css({ mb: '40px', display: 'flex', justifyContent: 'space-between', alignItems: { base: 'flex-start', sm: 'center' }, flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
        <div>
          <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: 'bold', color: '#111' })}>
            안녕하세요, {nickname}님! 👋
          </h1>
          <p className={css({ color: '#666', mt: '4px', fontSize: { base: '14px', sm: '16px' } })}>
            다가오는 여행 일정을 확인하고 새로운 계획을 세워보세요.
          </p>
        </div>
        <Link
          href="/trips/new"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            bg: '#111',
            color: 'white',
            px: '20px',
            py: '12px',
            borderRadius: '12px',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            w: { base: '100%', sm: 'auto' },
            justifyContent: 'center',
            _hover: { bg: '#333', transform: 'translateY(-2px) scale(1.02)', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' },
            _active: { transform: 'translateY(0) scale(0.98)' }
          })}
        >
          <Plus size={20} /> 새 여행 만들기
        </Link>
      </header>

      <section>
        <h2 className={css({ fontSize: '20px', fontWeight: '700', mb: '20px', color: '#222' })}>다가오는 여행</h2>

        {(!trips || trips.length === 0) ? (
          <div
            className={css({
              bg: 'white',
              borderRadius: '16px',
              p: { base: '40px 20px', sm: '60px' },
              textAlign: 'center',
              border: '2px dashed #ddd',
              color: '#888',
            })}
          >
            <Luggage size={48} className={css({ mx: 'auto', mb: '16px', color: '#ccc' })} />
            <p className={css({ fontSize: '18px', fontWeight: '500', mb: '8px', color: '#555' })}>
              아직 계획된 여행이 없습니다.
            </p>
            <p className={css({ fontSize: '14px' })}>상단의 버튼을 눌러 첫 여행을 등록해보세요!</p>
          </div>
        ) : (
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px',
            })}
          >
            {trips.map((trip) => {
              const start = new Date(trip.start_date).toLocaleDateString()
              const end = new Date(trip.end_date).toLocaleDateString()

              // 첫 번째(메인) 체크리스트 가져오기
              const mainChecklist = trip.checklists?.[0]
              const items = mainChecklist?.checklist_items || []
              const totalItems = items.length
              const checkedItems = items.filter((item: any) => item.is_checked).length
              const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className={css({
                    display: 'block',
                    bg: 'white',
                    p: '24px',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    _hover: {
                      transform: 'translateY(-6px) scale(1.01)',
                      boxShadow: '0 15px 30px rgba(0,0,0,0.1)',
                      borderColor: '#4285F4',
                    },
                  })}
                >
                  {/* Card Decoration */}
                  <div
                    className={css({
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      w: '4px',
                      h: '100%',
                      bg: 'linear-gradient(to bottom, #4285F4, #34A853)',
                    })}
                  />
                  <h3
                    className={css({
                      fontSize: '20px',
                      fontWeight: '700',
                      mb: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#222',
                    })}
                  >
                    <MapPin size={20} color="#EA4335" />
                    {trip.destination}
                  </h3>
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px', color: '#666', mb: '20px' })}>
                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' })}>
                      <CalendarDays size={16} color="#888" /> {start} ~ {end}
                    </p>
                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' })}>
                      <User size={16} color="#888" /> 성인 {trip.adults_count}명
                      {trip.children_count > 0 && `, 아이 ${trip.children_count}명`}
                    </p>
                  </div>

                  {/* Checklist Progress */}
                  <div className={css({ borderTop: '1px solid #eee', pt: '16px', mt: 'auto' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '8px' })}>
                      <span className={css({ fontSize: '13px', fontWeight: '600', color: '#555' })}>
                        준비물 챙기기
                      </span>
                      <span className={css({ fontSize: '13px', fontWeight: 'bold', color: progressPercent === 100 ? '#34A853' : '#4285F4' })}>
                        {progressPercent}%
                      </span>
                    </div>
                    <div className={css({ w: '100%', h: '6px', bg: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' })}>
                      <div
                        className={css({ h: '100%', bg: progressPercent === 100 ? '#34A853' : '#4285F4', transition: 'width 0.6s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    {totalItems === 0 && (
                      <p className={css({ fontSize: '12px', color: '#999', mt: '6px', textAlign: 'right' })}>아직 추가된 항목이 없습니다</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
