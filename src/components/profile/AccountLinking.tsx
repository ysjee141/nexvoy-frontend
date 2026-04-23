'use client'

import { useState } from 'react'
import { css } from 'styled-system/css'
import { MessageCircle, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import { AuthService } from '@/services/AuthService'

interface AccountLinkingProps {
  user: any
}

export default function AccountLinking({ user }: AccountLinkingProps) {
  const [loading, setLoading] = useState(false)

  // 연동 상태 확인 (identities 또는 app_metadata 활용)
  const identities = user?.identities || []
  const appMetadata = user?.app_metadata || {}

  const isKakaoLinked = identities.some((id: any) => id.provider === 'kakao') || !!appMetadata.kakao_id
  const isGoogleLinked = identities.some((id: any) => id.provider === 'google') || !!appMetadata.google_id
  
  // 사용자의 주 로그인 방식 (이메일인지 확인)
  const isEmailUser = user?.app_metadata?.provider === 'email' || (!isKakaoLinked && !isGoogleLinked)

  const handleLinkKakao = async () => {
    if (loading || isKakaoLinked) return
    setLoading(true)
    try {
      AuthService.linkKakaoAccount()
    } catch (error) {
      console.error('Failed to initiate Kakao linking:', error)
      setLoading(false)
    }
  }

  // 구글이나 카카오로 이미 연동된 상태라면 버튼을 노출하지 않거나 상태만 표시 (사용자 요청: "구글 또는 카카오로 연동되어 있지 않은 상태에서만")
  // 하지만 이미 카카오로 연동된 경우에는 '연동됨' 상태를 보여주는 것이 좋음.
  const canLink = isEmailUser && !isGoogleLinked && !isKakaoLinked

  return (
    <div className={css({ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px',
      mb: '12px'
    })}>
      <div className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: '20px',
        bg: 'bg.softCotton',
        borderRadius: '20px',
        border: '1px solid #F0F0F0',
        transition: 'all 0.2s',
        _hover: canLink ? { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } : {}
      })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
          <div className={css({ 
            w: '44px', 
            h: '44px', 
            bg: '#FEE500', 
            borderRadius: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#191919',
            boxShadow: '0 4px 10px rgba(254, 229, 0, 0.2)'
          })}>
            <MessageCircle size={22} fill="currentColor" />
          </div>
          <div>
            <div className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.secondary' })}>카카오 계정 연동</div>
            <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '2px', fontWeight: '600' })}>
              {isKakaoLinked ? '이미 카카오 계정과 연결되어 있습니다.' : '카카오 로그인 기능을 활성화합니다.'}
            </p>
          </div>
        </div>

        {isKakaoLinked ? (
          <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: 'brand.success', fontWeight: '800', fontSize: '14px', bg: 'rgba(34, 197, 94, 0.08)', px: '12px', py: '6px', borderRadius: '10px' })}>
            <CheckCircle2 size={16} />
            연동됨
          </div>
        ) : canLink ? (
          <button
            onClick={handleLinkKakao}
            disabled={loading}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              bg: 'brand.primary',
              color: 'white',
              px: '14px',
              py: '8px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: { bg: '#1D4ED8', transform: 'translateX(2px)' },
              _active: { transform: 'scale(0.95)' },
              _disabled: { opacity: 0.6, cursor: 'not-allowed' }
            })}
          >
            {loading ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} /> : '연동하기'}
            {!loading && <ChevronRight size={16} />}
          </button>
        ) : isGoogleLinked ? (
            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: 'brand.muted', fontWeight: '700', fontSize: '13px', opacity: 0.7 })}>
                <AlertCircle size={14} />
                구글 계정 연동 중
            </div>
        ) : (
          <div className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600', opacity: 0.6 })}>
            연동 불가
          </div>
        )}
      </div>

      {!isKakaoLinked && !canLink && (
        <div className={css({ 
          fontSize: '12px', 
          color: 'brand.muted', 
          px: '12px', 
          fontWeight: '600',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          lineHeight: '1.5'
        })}>
          <AlertCircle size={14} className={css({ flexShrink: 0, mt: '1px' })} />
          구글 또는 카카오로 이미 소셜 연동된 계정은 추가 연동이 제한됩니다.
        </div>
      )}
    </div>
  )
}
