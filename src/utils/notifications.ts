'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

// 브라우저 알림 권한 요청
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission === 'granted') return 'granted'
    return await Notification.requestPermission()
}

// Service Worker 등록
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null
    try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        return reg
    } catch (e) {
        console.error('SW registration failed:', e)
        return null
    }
}

// 브라우저 알림 즉시 표시
export function showNotification(title: string, body: string, url?: string) {
    if (Notification.permission !== 'granted') return
    const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `travel-pack-${Date.now()}`,
    })
    if (url) {
        n.onclick = () => {
            window.focus()
            window.location.href = url
        }
    }
}

// 알림 체크 간격 (ms)
const CHECK_INTERVAL = 60 * 1000 // 1분마다

/**
 * 로그인 유저의 다가오는 일정을 주기적으로 확인하고
 * alarm_minutes_before 설정에 맞는 일정에 브라우저 알림을 보냄
 */
export function useAlarmScheduler() {
    const supabase = createClient()

    const checkUpcomingAlarms = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (Notification.permission !== 'granted') return

        const now = new Date()

        // 사용자의 여행 목록 가져오기
        const { data: trips } = await supabase
            .from('trips')
            .select('id')
            .eq('user_id', user.id)

        if (!trips || trips.length === 0) return

        const tripIds = trips.map((t: any) => t.id)

        // 미래 24시간 이내의 알람 설정된 일정 가져오기
        const { data: plans } = await supabase
            .from('plans')
            .select('id, title, location, start_datetime_local, timezone_string, alarm_minutes_before, trip_id')
            .in('trip_id', tripIds)
            .not('alarm_minutes_before', 'is', null)
            .gt('alarm_minutes_before', 0)

        if (!plans) return

        for (const plan of plans) {
            if (!plan.start_datetime_local || !plan.alarm_minutes_before) continue

            // 현지 시간(start_datetime_local)을 UTC로 변환해서 비교
            // 단: 정확한 UTC변환 없이 시스템 타임으로 근사 처리
            const planStartLocal = new Date(plan.start_datetime_local.replace(' ', 'T'))
            const alarmTime = new Date(planStartLocal.getTime() - plan.alarm_minutes_before * 60 * 1000)

            // 알람 타이밍: 현재 시각이 알람 시각 ± 1분 이내
            const diff = Math.abs(now.getTime() - alarmTime.getTime())
            if (diff <= CHECK_INTERVAL) {
                const alreadyFired = sessionStorage.getItem(`alarm-fired-${plan.id}-${alarmTime.toISOString()}`)
                if (alreadyFired) continue

                sessionStorage.setItem(`alarm-fired-${plan.id}-${alarmTime.toISOString()}`, '1')

                const minuteLabel = plan.alarm_minutes_before >= 60
                    ? `${plan.alarm_minutes_before / 60}시간`
                    : `${plan.alarm_minutes_before}분`

                showNotification(
                    `🗓️ 일정 알림: ${plan.title}`,
                    `${minuteLabel} 후 일정이 시작됩니다.${plan.location ? `\n📍 ${plan.location}` : ''}`,
                    `/trips/detail?id=${plan.trip_id}`
                )
            }
        }
    }, [supabase])

    useEffect(() => {
        // 초기 Service Worker 등록 및 권한 확인
        registerServiceWorker()

        // 첫 번째 즉시 체크
        checkUpcomingAlarms()

        // 주기적 체크
        const timer = setInterval(checkUpcomingAlarms, CHECK_INTERVAL)
        return () => clearInterval(timer)
    }, [checkUpcomingAlarms])
}
