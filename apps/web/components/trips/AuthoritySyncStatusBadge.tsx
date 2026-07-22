'use client'

import { AlertTriangle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'
import type { AuthorityProductSyncStatus } from '@nexvoy/core'
import { css } from 'styled-system/css'

const COPY: Record<AuthorityProductSyncStatus, string> = {
  offline: '오프라인 저장',
  pending: '저장 대기',
  synced: '동기화 완료',
  conflict: '확인 필요',
  error: '저장 오류',
}

export default function AuthoritySyncStatusBadge({
  status,
  detail,
  pendingCount = 0,
  onConflictClick,
}: {
  status: AuthorityProductSyncStatus
  detail?: string | null
  pendingCount?: number
  onConflictClick?: () => void
}) {
  const isProblem = status === 'conflict' || status === 'error'
  const title = detail ? `${COPY[status]}: ${detail}` : COPY[status]
  const content = (
    <>
      {status === 'pending' ? (
        <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} />
      ) : status === 'offline' ? (
        <CloudOff size={14} />
      ) : status === 'synced' ? (
        <CheckCircle2 size={14} />
      ) : (
        <AlertTriangle size={14} />
      )}
      <span>{COPY[status]}</span>
      {status === 'conflict' && pendingCount > 0 ? <span>{pendingCount}건</span> : null}
    </>
  )

  const className = css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    h: '32px',
    px: '10px',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: isProblem ? '#FDE68A' : 'brand.hairline',
    bg: isProblem ? '#FFFBEB' : 'white',
    color: isProblem ? '#B45309' : status === 'synced' ? 'brand.primary' : 'brand.muted',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  })

  if (status === 'conflict' && onConflictClick) {
    return (
      <button
        type="button"
        onClick={onConflictClick}
        aria-label={`${title}. 해결 방법 선택`}
        title={title}
        className={`${className} ${css({
          cursor: 'pointer',
          _hover: { borderColor: '#F59E0B', bg: '#FEF3C7' },
          _focusVisible: { outline: '2px solid', outlineColor: 'brand.primary', outlineOffset: '2px' },
        })}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div role="status" aria-live="polite" title={title} className={className}>
      {content}
    </div>
  )
}
