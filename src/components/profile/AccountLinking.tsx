'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { css } from 'styled-system/css'
import { MessageCircle, CheckCircle2, ChevronRight, Loader2, Link2Off } from 'lucide-react'
import { AuthService } from '@/services/AuthService'
import { createClient } from '@/utils/supabase/client'
import UnlinkConfirmModal from '@/components/common/UnlinkConfirmModal'

interface AccountLinkingProps {
  user: any
}

// Google 공식 SVG 아이콘
const GoogleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function AccountLinking({ user }: AccountLinkingProps) {
  const router = useRouter()
  const [linkingGoogle, setLinkingGoogle] = useState(false)
  const [linkingKakao, setLinkingKakao] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<'google' | 'kakao' | null>(null)
  const [unlinkError, setUnlinkError] = useState('')

  // 연동 상태 확인
  const identities = user?.identities || []
  const appMetadata = user?.app_metadata || {}

  const isKakaoLinked = identities.some((id: any) => id.provider === 'kakao') || !!appMetadata.kakao_id
  const isGoogleLinked = identities.some((id: any) => id.provider === 'google')

  // 최초 가입 방식 판단: google/kakao로 가입한 경우 섹션 전체 숨김
  const primaryProvider = appMetadata.provider ?? 'email'
  const isSocialSignup = primaryProvider === 'google' || primaryProvider === 'kakao'

  // 소셜 계정(구글/카카오)으로 가입한 경우 이 섹션을 표시하지 않음
  if (isSocialSignup) return null

  const handleLinkGoogle = () => {
    if (linkingGoogle || isGoogleLinked) return
    setLinkingGoogle(true)
    try {
      AuthService.linkGoogleAccount()
      // 리다이렉트 발생 → 로딩 상태 유지
    } catch (error) {
      console.error('Failed to initiate Google linking:', error)
      setLinkingGoogle(false)
    }
  }

  const handleLinkKakao = () => {
    if (linkingKakao || isKakaoLinked) return
    setLinkingKakao(true)
    try {
      AuthService.linkKakaoAccount()
      // 리다이렉트 발생 → 로딩 상태 유지
    } catch (error) {
      console.error('Failed to initiate Kakao linking:', error)
      setLinkingKakao(false)
    }
  }

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget) return
    setIsUnlinking(true)
    setUnlinkError('')

    try {
      if (unlinkTarget === 'google') {
        await AuthService.unlinkGoogleAccount()
      } else {
        await AuthService.unlinkKakaoAccount()
      }
      setUnlinkTarget(null)
      // app_metadata 변경이 클라이언트 JWT에 반영되도록 세션 강제 갱신
      const supabase = createClient()
      await supabase.auth.refreshSession()
      router.refresh()
      window.location.reload()
    } catch (err: any) {
      console.error('Unlink failed:', err)
      setUnlinkError(err.message ?? '연동 해제 중 오류가 발생했습니다. 다시 시도해 주세요.')
      setIsUnlinking(false)
    }
  }

  return (
    <>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>

        {/* ── Google 연동 row ── */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: '20px',
          bg: 'bg.softCotton',
          borderRadius: '20px',
          border: '1px solid #F0F0F0',
          transition: 'all 0.2s',
          _hover: !isGoogleLinked ? { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } : {},
        })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
            <div className={css({
              w: '44px', h: '44px',
              bg: 'white',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #F0F0F0',
            })}>
              <GoogleIcon />
            </div>
            <div>
              <div className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.secondary' })}>구글 계정 연동</div>
              <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '2px', fontWeight: '600' })}>
                {isGoogleLinked ? '구글 계정과 연결되어 있습니다.' : '구글 로그인 기능을 활성화합니다.'}
              </p>
            </div>
          </div>

          {isGoogleLinked ? (
            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: 'brand.success', fontWeight: '800', fontSize: '14px', bg: 'rgba(34, 197, 94, 0.08)', px: '12px', py: '6px', borderRadius: '10px' })}>
                <CheckCircle2 size={16} />
                연동됨
              </div>
              <button
                onClick={() => { setUnlinkError(''); setUnlinkTarget('google') }}
                className={css({
                  display: 'flex', alignItems: 'center', gap: '4px',
                  bg: 'rgba(239, 68, 68, 0.06)', color: '#EF4444',
                  px: '10px', py: '6px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: '750', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: { bg: 'rgba(239, 68, 68, 0.12)' },
                  _active: { transform: 'scale(0.95)' },
                })}
              >
                <Link2Off size={13} />
                해제
              </button>
            </div>
          ) : isKakaoLinked ? (
            <div className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600', px: '8px' })}>
              카카오 해제 후 연동 가능
            </div>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={linkingGoogle}
              className={css({
                display: 'flex', alignItems: 'center', gap: '4px',
                bg: 'brand.primary', color: 'white',
                px: '14px', py: '8px', borderRadius: '12px',
                fontSize: '14px', fontWeight: '800', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: { bg: '#1D4ED8', transform: 'translateX(2px)' },
                _active: { transform: 'scale(0.95)' },
                _disabled: { opacity: 0.6, cursor: 'not-allowed' },
              })}
            >
              {linkingGoogle ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} /> : '연동하기'}
              {!linkingGoogle && <ChevronRight size={16} />}
            </button>
          )}
        </div>

        {/* ── 카카오 연동 row ── */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: '20px',
          bg: 'bg.softCotton',
          borderRadius: '20px',
          border: '1px solid #F0F0F0',
          transition: 'all 0.2s',
          _hover: !isKakaoLinked ? { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } : {},
        })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
            <div className={css({
              w: '44px', h: '44px',
              bg: '#FEE500',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#191919',
              boxShadow: '0 4px 10px rgba(254, 229, 0, 0.2)',
            })}>
              <MessageCircle size={22} fill="currentColor" />
            </div>
            <div>
              <div className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.secondary' })}>카카오 계정 연동</div>
              <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '2px', fontWeight: '600' })}>
                {isKakaoLinked ? '카카오 계정과 연결되어 있습니다.' : '카카오 로그인 기능을 활성화합니다.'}
              </p>
            </div>
          </div>

          {isKakaoLinked ? (
            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: 'brand.success', fontWeight: '800', fontSize: '14px', bg: 'rgba(34, 197, 94, 0.08)', px: '12px', py: '6px', borderRadius: '10px' })}>
                <CheckCircle2 size={16} />
                연동됨
              </div>
              <button
                onClick={() => { setUnlinkError(''); setUnlinkTarget('kakao') }}
                className={css({
                  display: 'flex', alignItems: 'center', gap: '4px',
                  bg: 'rgba(239, 68, 68, 0.06)', color: '#EF4444',
                  px: '10px', py: '6px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: '750', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: { bg: 'rgba(239, 68, 68, 0.12)' },
                  _active: { transform: 'scale(0.95)' },
                })}
              >
                <Link2Off size={13} />
                해제
              </button>
            </div>
          ) : isGoogleLinked ? (
            <div className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600', px: '8px' })}>
              구글 해제 후 연동 가능
            </div>
          ) : (
            <button
              onClick={handleLinkKakao}
              disabled={linkingKakao}
              className={css({
                display: 'flex', alignItems: 'center', gap: '4px',
                bg: 'brand.primary', color: 'white',
                px: '14px', py: '8px', borderRadius: '12px',
                fontSize: '14px', fontWeight: '800', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: { bg: '#1D4ED8', transform: 'translateX(2px)' },
                _active: { transform: 'scale(0.95)' },
                _disabled: { opacity: 0.6, cursor: 'not-allowed' },
              })}
            >
              {linkingKakao ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} /> : '연동하기'}
              {!linkingKakao && <ChevronRight size={16} />}
            </button>
          )}
        </div>

        {/* 연동 해제 에러 메시지 */}
        {unlinkError && (
          <p className={css({ fontSize: '13px', color: '#EF4444', fontWeight: '700', px: '4px', display: 'flex', alignItems: 'center', gap: '6px' })}>
            ⚠️ {unlinkError}
          </p>
        )}
      </div>

      {/* 연동 해제 확인 모달 */}
      {unlinkTarget && (
        <UnlinkConfirmModal
          isOpen={!!unlinkTarget}
          provider={unlinkTarget}
          onConfirm={handleUnlinkConfirm}
          onCancel={() => { if (!isUnlinking) { setUnlinkTarget(null); setUnlinkError('') } }}
          isLoading={isUnlinking}
        />
      )}
    </>
  )
}
