'use client'

import { css } from 'styled-system/css'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface UnlinkConfirmModalProps {
  isOpen: boolean
  provider: 'google' | 'kakao'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

const PROVIDER_INFO = {
  google: {
    label: '구글',
    color: '#4285F4',
    bg: 'rgba(66, 133, 244, 0.08)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  kakao: {
    label: '카카오',
    color: '#191919',
    bg: 'rgba(254, 229, 0, 0.15)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.73 1.6 5.13 4.02 6.6L5.1 21l4.46-2.95c.79.13 1.61.2 2.44.2 5.52 0 10-3.48 10-7.8C22 6.48 17.52 3 12 3z" fill="#371D1E" />
      </svg>
    ),
  },
}

export default function UnlinkConfirmModal({
  isOpen,
  provider,
  onConfirm,
  onCancel,
  isLoading = false,
}: UnlinkConfirmModalProps) {
  if (!isOpen) return null

  const info = PROVIDER_INFO[provider]

  return (
    <div
      className={css({
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: '20px',
      })}
    >
      {/* 오버레이 */}
      <div
        onClick={!isLoading ? onCancel : undefined}
        className={css({
          position: 'absolute',
          inset: 0,
          bg: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        })}
      />

      {/* 모달 카드 */}
      <div
        className={css({
          position: 'relative',
          bg: 'white',
          borderRadius: '28px',
          p: '32px 28px 28px',
          w: '100%',
          maxW: '360px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'slideUp 0.25s cubic-bezier(0.2, 0, 0, 1)',
        })}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={!isLoading ? onCancel : undefined}
          disabled={isLoading}
          className={css({
            position: 'absolute',
            top: '16px',
            right: '16px',
            w: '32px',
            h: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#BBB',
            borderRadius: '10px',
            transition: 'all 0.2s',
            _hover: { bg: '#F5F5F5', color: '#666' },
            _disabled: { opacity: 0.4, cursor: 'not-allowed' },
          })}
        >
          <X size={18} />
        </button>

        {/* 아이콘 + 제목 */}
        <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' })}>
          <div
            className={css({
              w: '60px',
              h: '60px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            })}
            style={{ background: info.bg }}
          >
            {info.icon}
          </div>

          <div>
            <h2 className={css({ fontSize: '18px', fontWeight: '850', color: '#2C3A47', letterSpacing: '-0.02em', mb: '8px' })}>
              {info.label} 연동을 해제할까요?
            </h2>
            <p className={css({ fontSize: '14px', color: '#828D99', fontWeight: '600', lineHeight: '1.6' })}>
              연동을 해제해도 이메일과 비밀번호로
              <br />
              계속 로그인할 수 있어요.
            </p>
          </div>
        </div>

        {/* 경고 배지 */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            p: '14px 16px',
            bg: 'rgba(245, 158, 11, 0.08)',
            borderRadius: '14px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          })}
        >
          <AlertTriangle size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          <p className={css({ fontSize: '13px', color: '#92400E', fontWeight: '600', lineHeight: '1.5' })}>
            해제 후 {info.label} 계정으로 로그인하려면 다시 연동해야 합니다.
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className={css({ display: 'flex', gap: '10px' })}>
          <button
            onClick={!isLoading ? onCancel : undefined}
            disabled={isLoading}
            className={css({
              flex: 1,
              py: '14px',
              bg: '#F5F5F5',
              color: '#828D99',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '750',
              fontSize: '15px',
              transition: 'all 0.2s',
              _hover: { bg: '#EBEBEB' },
              _active: { transform: 'scale(0.97)' },
              _disabled: { opacity: 0.4, cursor: 'not-allowed' },
            })}
          >
            취소
          </button>
          <button
            onClick={!isLoading ? onConfirm : undefined}
            disabled={isLoading}
            className={css({
              flex: 1,
              py: '14px',
              bg: '#EF4444',
              color: 'white',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
              _hover: { bg: '#DC2626', boxShadow: '0 6px 16px rgba(239, 68, 68, 0.3)', transform: 'translateY(-1px)' },
              _active: { transform: 'scale(0.97)' },
              _disabled: { opacity: 0.6, cursor: 'not-allowed', boxShadow: 'none', transform: 'none' },
            })}
          >
            {isLoading ? (
              <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} />
            ) : null}
            {isLoading ? '해제 중...' : '연동 해제'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
