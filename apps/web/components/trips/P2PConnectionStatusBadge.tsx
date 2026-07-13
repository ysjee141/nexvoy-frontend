'use client'

import { CheckCircle2, Cloud, Loader2 } from 'lucide-react'
import { css, cx } from 'styled-system/css'

export type P2PConnectionStatus = 'idle' | 'connecting' | 'connected' | 'fallback'

export interface P2PConnectionStatusBadgeProps {
  status: P2PConnectionStatus
}

const STATUS_COPY: Record<Exclude<P2PConnectionStatus, 'idle'>, string> = {
  connecting: '빠른 동기화 연결 중',
  connected: '빠른 동기화 중',
  fallback: '기존 방식으로 동기화 중',
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
        status === 'connected'
          ? css({
            color: 'brand.primary',
            bg: 'brand.primary/5',
            borderColor: 'brand.primary/20',
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
      ) : status === 'connected' ? (
        <CheckCircle2 size={iconSize} aria-hidden="true" />
      ) : (
        <Cloud size={iconSize} aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  )
}
