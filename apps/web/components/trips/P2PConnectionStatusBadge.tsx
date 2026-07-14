'use client'

import { AlertTriangle, CheckCircle2, Cloud, KeyRound, Loader2 } from 'lucide-react'
import { css, cx } from 'styled-system/css'

export type P2PConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'fallback'
  | 'backup_waiting_for_key'
  | 'backup_pending'
  | 'backup_failed'
  | 'backup_synced'

export interface P2PConnectionStatusBadgeProps {
  status: P2PConnectionStatus
}

const STATUS_COPY: Record<Exclude<P2PConnectionStatus, 'idle'>, string> = {
  connecting: '빠른 동기화 연결 중',
  connected: '빠른 동기화 중',
  fallback: '빠른 동기화 대기 중',
  backup_waiting_for_key: '백업 키 대기 중',
  backup_pending: '백업 동기화 중',
  backup_failed: '백업 동기화 실패',
  backup_synced: '백업 완료',
}

export default function P2PConnectionStatusBadge({
  status,
}: P2PConnectionStatusBadgeProps) {
  if (status === 'idle') return null

  const label = STATUS_COPY[status]
  const iconSize = 14

  return (
    <div
      role="status"
      aria-live="polite"
      title={label}
      className={cx(
        css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          h: '32px',
          px: '10px',
          borderRadius: '999px',
          border: '1px solid',
          fontSize: '12px',
          fontWeight: '700',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }),
        status === 'connected' || status === 'backup_synced'
          ? css({
            color: 'brand.primary',
            bg: 'brand.primary/5',
            borderColor: 'brand.primary/20',
          })
          : status === 'backup_failed' || status === 'backup_waiting_for_key'
            ? css({
              color: '#B45309',
              bg: '#FFFBEB',
              borderColor: '#FDE68A',
            })
          : css({
            color: 'brand.muted',
            bg: 'white',
            borderColor: 'brand.hairline',
          }),
      )}
    >
      {status === 'connecting' ? (
        <Loader2
          size={iconSize}
          className={css({ animation: 'spin 1s linear infinite' })}
          aria-hidden="true"
        />
      ) : status === 'connected' || status === 'backup_synced' ? (
        <CheckCircle2 size={iconSize} aria-hidden="true" />
      ) : status === 'backup_waiting_for_key' ? (
        <KeyRound size={iconSize} aria-hidden="true" />
      ) : status === 'backup_failed' ? (
        <AlertTriangle size={iconSize} aria-hidden="true" />
      ) : (
        <Cloud size={iconSize} aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  )
}
