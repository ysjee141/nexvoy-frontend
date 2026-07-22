'use client'

import { useEffect, useRef } from 'react'
import { Cloud, Loader2, RefreshCw, X } from 'lucide-react'
import { css } from 'styled-system/css'
import type { AuthorityConflictResolution } from '@nexvoy/core'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useScrollLock } from '@/hooks/useScrollLock'

interface AuthorityConflictDialogProps {
  isOpen: boolean
  pendingCount: number
  resolving: boolean
  error: string | null
  onClose: () => void
  onResolve: (resolution: AuthorityConflictResolution) => void
}

export default function AuthorityConflictDialog({
  isOpen,
  pendingCount,
  resolving,
  error,
  onClose,
  onResolve,
}: AuthorityConflictDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const safeActionRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    if (!resolving) onClose()
  }

  useModalBackButton(isOpen, close, 'authorityConflict')
  useScrollLock(isOpen)

  useEffect(() => {
    if (!isOpen) return undefined
    safeActionRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [])]
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, resolving])

  if (!isOpen) return null

  return (
    <div
      className={css({
        position: 'fixed',
        inset: 0,
        zIndex: 3200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: '16px',
        bg: 'rgba(17, 24, 39, 0.48)',
      })}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="authority-conflict-title"
        aria-describedby="authority-conflict-description"
        className={css({
          position: 'relative',
          w: '100%',
          maxW: '420px',
          borderRadius: '16px',
          bg: 'white',
          p: { base: '24px', sm: '28px' },
          boxShadow: '0 20px 50px rgba(17, 24, 39, 0.22)',
        })}
      >
        <button
          type="button"
          onClick={close}
          disabled={resolving}
          aria-label="닫기"
          className={css({
            position: 'absolute',
            top: '14px',
            right: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            w: '36px',
            h: '36px',
            border: 'none',
            borderRadius: '8px',
            bg: 'transparent',
            color: 'brand.muted',
            cursor: 'pointer',
            _hover: { bg: 'bg.softCotton', color: 'brand.ink' },
            _disabled: { cursor: 'not-allowed', opacity: 0.5 },
          })}
        >
          <X size={20} />
        </button>

        <h2
          id="authority-conflict-title"
          className={css({ pr: '36px', color: 'brand.ink', fontSize: '20px', fontWeight: '700', lineHeight: 1.4 })}
        >
          변경 사항을 선택해 주세요
        </h2>
        <p
          id="authority-conflict-description"
          className={css({ mt: '10px', color: 'brand.muted', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' })}
        >
          다른 기기에서 같은 항목이 먼저 수정되었습니다. 서버의 최신 내용과 이 기기의 변경 중 하나를 선택해야 합니다.
        </p>
        <p className={css({ mt: '12px', color: 'brand.ink', fontSize: '13px', fontWeight: '700' })}>
          이 기기에서 대기 중인 변경 {pendingCount}건
        </p>

        {error ? (
          <p
            role="alert"
            className={css({ mt: '16px', p: '12px', borderRadius: '8px', bg: 'brand.error/10', color: 'brand.error', fontSize: '13px' })}
          >
            {error}
          </p>
        ) : null}

        <div className={css({ display: 'grid', gap: '10px', mt: '24px' })}>
          <button
            ref={safeActionRef}
            type="button"
            disabled={resolving}
            onClick={() => onResolve('keep_server')}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minH: '48px',
              border: 'none',
              borderRadius: '8px',
              bg: 'brand.primary',
              color: 'white',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              _hover: { bg: 'brand.primaryActive' },
              _disabled: { cursor: 'not-allowed', opacity: 0.65 },
            })}
          >
            {resolving ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> : <Cloud size={18} />}
            서버 최신 내용 사용
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve('retry_local')}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minH: '48px',
              border: '1px solid',
              borderColor: 'brand.hairline',
              borderRadius: '8px',
              bg: 'white',
              color: 'brand.ink',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              _hover: { borderColor: 'brand.primary', color: 'brand.primary', bg: 'bg.softCotton' },
              _disabled: { cursor: 'not-allowed', opacity: 0.65 },
            })}
          >
            <RefreshCw size={18} />
            이 기기 변경 다시 적용
          </button>
        </div>
      </section>
    </div>
  )
}
