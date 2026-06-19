/**
 * useRealtimeSubscription — Supabase Realtime postgres_changes 구독 훅 (제네릭)
 *
 * - `supabase.channel(channelName)` → `.on('postgres_changes', …)` → `.subscribe()` 흐름을 래핑한다.
 * - unmount/의존성 변경 시 `supabase.removeChannel(channel)` 로 채널을 완전히 정리한다(누수 방지).
 * - `onChange` 는 매 렌더마다 새 함수일 수 있으므로 `useRef` 로 최신값을 보관하고,
 *   effect 의존성 배열에서 제외해 재구독 폭주를 막는다.
 * - `enabled === false` 면 채널을 생성하지 않는다(인증 전 방어 등).
 *
 * 주의: 대상 테이블이 Supabase `supabase_realtime` publication 에 포함되어 있어야
 *       postgres_changes 가 수신된다(서버 측 설정, 코드 외 작업).
 */
import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface UseRealtimeSubscriptionOptions<
  T extends Record<string, unknown>,
> {
  /** 구독 채널 이름 (고유해야 함, 예: `trips-${userId}`) */
  channelName: string
  /** 감지할 테이블명 */
  table: string
  /** 스키마 (기본 'public') */
  schema?: string
  /** 감지할 이벤트 (기본 '*') */
  event?: PostgresEvent
  /** 행 필터 (예: `user_id=eq.${userId}`) — RLS 와 별개의 서버사이드 필터 */
  filter?: string
  /** 변경 발생 시 콜백 */
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void
  /** 구독 활성화 여부 (false면 구독 생성 안 함, 기본 true) */
  enabled?: boolean
}

/** subscribe 콜백이 전달하는 상태 + 구독 전 초기 상태 */
type SubscriptionStatus =
  | 'IDLE'
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR'

export function useRealtimeSubscription<T extends Record<string, unknown>>(
  options: UseRealtimeSubscriptionOptions<T>
): { status: SubscriptionStatus } {
  const {
    channelName,
    table,
    schema = 'public',
    event = '*',
    filter,
    onChange,
    enabled = true,
  } = options

  const [status, setStatus] = useState<SubscriptionStatus>('IDLE')

  // onChange 안정화: 최신 콜백을 ref 에 보관해 effect 의존성에서 제외(재구독 폭주 방지).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled) {
      setStatus('IDLE')
      return
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // @supabase/supabase-js 의 postgres_changes 리스너 타입은 리터럴 'postgres_changes' 를 요구.
        'postgres_changes' as never,
        { event, schema, table, ...(filter ? { filter } : {}) } as never,
        (payload: RealtimePostgresChangesPayload<T>) => {
          onChangeRef.current(payload)
        }
      )
      .subscribe((subscribeStatus) => {
        setStatus(subscribeStatus as SubscriptionStatus)
      })

    return () => {
      // 채널 완전 제거(unsubscribe + client 에서 해제).
      void supabase.removeChannel(channel)
    }
  }, [channelName, table, schema, event, filter, enabled])

  return { status }
}
