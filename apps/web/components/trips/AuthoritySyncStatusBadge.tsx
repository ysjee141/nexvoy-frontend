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
}: {
  status: AuthorityProductSyncStatus
  detail?: string | null
}) {
  const isProblem = status === 'conflict' || status === 'error'
  return (
    <div
      role="status"
      aria-live="polite"
      title={detail ? `${COPY[status]}: ${detail}` : COPY[status]}
      className={css({
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
      })}
    >
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
    </div>
  )
}
