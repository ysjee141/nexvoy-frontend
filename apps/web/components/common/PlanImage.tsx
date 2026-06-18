'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImageIcon } from 'lucide-react'
import { css } from 'styled-system/css'
import { useImageRecovery } from '@/hooks/useImageRecovery'
import { canStoreNow } from '@/services/PlacePhotoService'

/**
 * PlanImage — Google Place Photo 영구 저장 컴포넌트
 *
 * 상태 머신 (6개):
 *  - idle-empty        : image_url=null, photo_reference 있음, 신규(<5초). shimmer
 *  - idle-placeholder  : image_url=null, 5초 경과 또는 photo_reference=null. static placeholder
 *  - loading-img       : image_url 있음, onLoad/onError 대기. 빈 배경
 *  - loading-recovery  : image_url 있음, onError 후 복구 API 호출 중. shimmer
 *  - loaded            : 이미지 표시 (페이드인 1회)
 *  - error-final       : 복구 실패 / 쿨다운 차단. static placeholder
 *
 * UX 설계 문서: _workspace/01b_ux_design.md
 */

type PlanImageState =
    | 'idle-empty'
    | 'idle-placeholder'
    | 'loading-img'
    | 'loading-recovery'
    | 'loaded'
    | 'error-final'

export interface PlanImageProps {
    planId: string
    tripId: string
    placeId?: string | null
    imageUrl?: string | null
    photoReference?: string | null
    /** ISO 8601 문자열. 신규 생성 5초 이내인지 판정 */
    createdAt?: string | null
    variant: 'thumbnail' | 'hero'
    /** plan.title 기반 (예: "{title} 장소 사진") */
    alt: string
    onRecovered?: (newUrl: string) => void
    onRecoveryFailed?: () => void
    /** 오프라인 모드 등에서 강제 비활성화 */
    disableRecovery?: boolean
    className?: string
}

const IDLE_EMPTY_TIMEOUT_MS = 5_000
const SHIMMER_MIN_DURATION_MS = 400
const FADE_IN_THUMBNAIL_MS = 240
const FADE_IN_HERO_MS = 320

const VARIANT_RADIUS: Record<PlanImageProps['variant'], string> = {
    thumbnail: '12px',
    hero: '0px',
}

const VARIANT_ICON_SIZE: Record<PlanImageProps['variant'], number> = {
    thumbnail: 20,
    hero: 32,
}

/** `prefers-reduced-motion: reduce` 감지 */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        try {
            const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
            setReduced(mq.matches)
            const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
            if (typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', handler)
                return () => mq.removeEventListener('change', handler)
            }
            // Safari legacy fallback
            mq.addListener(handler)
            return () => mq.removeListener(handler)
        } catch (error) {
            console.warn('[PlanImage] prefers-reduced-motion 감지 실패', error)
            return undefined
        }
    }, [])

    return reduced
}

/** createdAt 기준으로 신규(5초 이내) 여부와 남은 시간(ms) 계산 */
function getNewnessInfo(createdAt: string | null | undefined): { isNew: boolean; remainingMs: number } {
    if (!createdAt) return { isNew: false, remainingMs: 0 }
    const created = new Date(createdAt).getTime()
    if (Number.isNaN(created)) return { isNew: false, remainingMs: 0 }
    const elapsed = Date.now() - created
    if (elapsed >= IDLE_EMPTY_TIMEOUT_MS) return { isNew: false, remainingMs: 0 }
    return { isNew: true, remainingMs: IDLE_EMPTY_TIMEOUT_MS - elapsed }
}

export function PlanImage(props: PlanImageProps) {
    const {
        planId,
        tripId,
        placeId,
        imageUrl,
        photoReference,
        createdAt,
        variant,
        alt,
        onRecovered,
        onRecoveryFailed,
        disableRecovery = false,
        className,
    } = props

    const reducedMotion = usePrefersReducedMotion()
    const { recover } = useImageRecovery()

    /** 현재 렌더링 중인 URL (복구 후 갱신 시 변경) */
    const [activeUrl, setActiveUrl] = useState<string | null>(imageUrl ?? null)
    /** 신규 생성 5초 타임아웃 경과 여부 */
    const [isNewnessExpired, setIsNewnessExpired] = useState<boolean>(() => {
        return !getNewnessInfo(createdAt).isNew
    })
    /** 복구 시도 진행 중 여부 */
    const [isRecovering, setIsRecovering] = useState(false)
    /** 복구 시도 종료(성공/실패) 후 final 처리 여부 */
    const [recoveryFailed, setRecoveryFailed] = useState(false)
    /** 이미지 onLoad/onError 도달 여부 */
    const [imgLoaded, setImgLoaded] = useState(false)
    /** 자발 복구 요청 플래그 (image_url=null 케이스에서 shimmer 표시용) */
    const [recoveryRequested, setRecoveryRequested] = useState(false)
    /** 깜박임 방지: shimmer 표시 시작 시각 */
    const recoveryStartedAtRef = useRef<number | null>(null)
    /** 마운트 사이클 내 자발 트리거 1회 가드 */
    const autoTriggerAttemptedRef = useRef(false)

    /** 외부에서 imageUrl이 갱신되면 activeUrl 동기화 + 상태 리셋 */
    useEffect(() => {
        if (imageUrl === activeUrl) return
        setActiveUrl(imageUrl ?? null)
        setImgLoaded(false)
        setRecoveryFailed(false)
        setIsRecovering(false)
        setRecoveryRequested(false)
        recoveryStartedAtRef.current = null
        autoTriggerAttemptedRef.current = false
    }, [imageUrl, activeUrl])

    /** createdAt 기반 idle-empty 타임아웃 처리 */
    useEffect(() => {
        const { isNew, remainingMs } = getNewnessInfo(createdAt)
        if (!isNew) {
            setIsNewnessExpired(true)
            return
        }
        setIsNewnessExpired(false)
        const timer = setTimeout(() => setIsNewnessExpired(true), remainingMs)
        return () => clearTimeout(timer)
    }, [createdAt])

    /** 현재 상태 계산 (single source of truth) */
    const state: PlanImageState = useMemo(() => {
        if (recoveryFailed) return 'error-final'
        if (isRecovering) return 'loading-recovery'
        if (activeUrl) {
            return imgLoaded ? 'loaded' : 'loading-img'
        }
        // image_url 없음 분기
        if (disableRecovery) return 'idle-placeholder'
        // 자발 복구가 예약/진행 중인 경우 → shimmer
        if (recoveryRequested) return 'idle-empty'
        if (!photoReference && !placeId) return 'idle-placeholder'
        if (!photoReference) {
            // photoReference는 없지만 placeId가 있어 서버 fallback 가능 — 신규 5초 동안만 shimmer
            return isNewnessExpired ? 'idle-placeholder' : 'idle-empty'
        }
        if (isNewnessExpired) return 'idle-placeholder'
        return 'idle-empty'
    }, [activeUrl, imgLoaded, isRecovering, recoveryFailed, photoReference, placeId, disableRecovery, isNewnessExpired, recoveryRequested])

    /** 이미지 onError → 복구 시도 트리거 */
    const handleImgError = useCallback(async () => {
        if (disableRecovery || !placeId) {
            setRecoveryFailed(true)
            onRecoveryFailed?.()
            return
        }
        setIsRecovering(true)
        recoveryStartedAtRef.current = Date.now()
        try {
            const result = await recover({ planId, tripId, placeId, photoReference })
            // shimmer 최소 표시 시간 보장 (깜박임 방지)
            const startedAt = recoveryStartedAtRef.current ?? Date.now()
            const elapsed = Date.now() - startedAt
            const wait = Math.max(0, SHIMMER_MIN_DURATION_MS - elapsed)
            if (wait > 0) {
                await new Promise<void>((resolve) => setTimeout(resolve, wait))
            }
            if (result?.imageUrl) {
                setActiveUrl(result.imageUrl)
                setImgLoaded(false)
                setRecoveryFailed(false)
                onRecovered?.(result.imageUrl)
            } else {
                setRecoveryFailed(true)
                onRecoveryFailed?.()
            }
        } catch (error) {
            // Zero Noise: 토스트 없이 콘솔 로그만
            console.error('[PlanImage] recovery error', error)
            setRecoveryFailed(true)
            onRecoveryFailed?.()
        } finally {
            setIsRecovering(false)
            recoveryStartedAtRef.current = null
        }
    }, [planId, tripId, placeId, photoReference, disableRecovery, recover, onRecovered, onRecoveryFailed])

    /**
     * image_url=null 자발 복구 트리거
     * - 마운트 시점에 image_url=null && placeId 존재 시 자동으로 recover 호출
     * - 단발성 보장 (autoTriggerAttemptedRef)
     * - PlacePhotoService.canStoreNow + in-flight dedup으로 중복 차단
     */
    useEffect(() => {
        if (disableRecovery) return
        if (activeUrl) return
        if (!placeId) return
        if (!planId || !tripId) return
        if (isRecovering || recoveryFailed) return
        if (autoTriggerAttemptedRef.current) return
        if (!canStoreNow(planId)) return

        autoTriggerAttemptedRef.current = true

        let cancelled = false
        const run = async () => {
            setIsRecovering(true)
            setRecoveryRequested(true)
            recoveryStartedAtRef.current = Date.now()
            try {
                const result = await recover({ planId, tripId, placeId, photoReference })
                if (cancelled) return
                const startedAt = recoveryStartedAtRef.current ?? Date.now()
                const elapsed = Date.now() - startedAt
                const wait = Math.max(0, SHIMMER_MIN_DURATION_MS - elapsed)
                if (wait > 0) {
                    await new Promise<void>((resolve) => setTimeout(resolve, wait))
                }
                if (cancelled) return
                if (result?.imageUrl) {
                    setActiveUrl(result.imageUrl)
                    setImgLoaded(false)
                    setRecoveryFailed(false)
                    onRecovered?.(result.imageUrl)
                } else {
                    // 실패 시: photoReference 없으면 placeholder로 회귀(소프트), 있으면 error-final
                    if (photoReference) {
                        setRecoveryFailed(true)
                        onRecoveryFailed?.()
                    } else {
                        setRecoveryRequested(false)
                        onRecoveryFailed?.()
                    }
                }
            } catch (error) {
                console.error('[PlanImage] auto recovery error', error)
                if (cancelled) return
                setRecoveryFailed(true)
                onRecoveryFailed?.()
            } finally {
                if (!cancelled) {
                    setIsRecovering(false)
                    recoveryStartedAtRef.current = null
                }
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [
        activeUrl,
        placeId,
        planId,
        tripId,
        photoReference,
        disableRecovery,
        isRecovering,
        recoveryFailed,
        recover,
        onRecovered,
        onRecoveryFailed,
    ])

    /** 페이드인 duration (variant + reduced-motion 반영) */
    const fadeInMs = reducedMotion ? 0 : variant === 'hero' ? FADE_IN_HERO_MS : FADE_IN_THUMBNAIL_MS

    /** variant별 동적 스타일 (인라인 — Panda 정적 추출 보장) */
    const containerInlineStyle = useMemo<React.CSSProperties>(
        () => ({
            borderRadius: VARIANT_RADIUS[variant],
        }),
        [variant],
    )

    /** loaded 상태일 때의 backgroundImage 동적 값 (인라인 처리) */
    const loadedBackgroundStyle = useMemo<React.CSSProperties | undefined>(() => {
        if (!activeUrl) return undefined
        return { backgroundImage: `url("${activeUrl}")` }
    }, [activeUrl])

    return (
        <div
            className={[
                css({
                    position: 'relative',
                    w: '100%',
                    h: '100%',
                    overflow: 'hidden',
                    bg: 'bg.surfaceSoft',
                }),
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            style={containerInlineStyle}
            role={state === 'loaded' ? undefined : 'img'}
            aria-label={state === 'loaded' ? undefined : getAriaLabel(state, alt)}
            aria-busy={state === 'idle-empty' || state === 'loading-recovery' || state === 'loading-img'}
        >
            {/* 숨겨진 <img>로 로드/에러 감지 (loaded 상태에서만 backgroundImage 사용) */}
            {activeUrl && !imgLoaded && !recoveryFailed && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={activeUrl}
                    src={activeUrl}
                    alt=""
                    aria-hidden="true"
                    onLoad={() => setImgLoaded(true)}
                    onError={handleImgError}
                    className={css({
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        opacity: 0,
                        pointerEvents: 'none',
                    })}
                />
            )}

            <AnimatePresence mode="wait">
                {(state === 'idle-empty' || state === 'loading-recovery') && (
                    <motion.div
                        key="shimmer"
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.12, ease: 'easeOut' }}
                        className={css({
                            position: 'absolute',
                            inset: 0,
                            background:
                                'linear-gradient(90deg, token(colors.bg.surfaceSoft) 25%, token(colors.brand.hairline) 50%, token(colors.bg.surfaceSoft) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s infinite linear',
                        })}
                        style={reducedMotion ? { animation: 'none' } : undefined}
                    />
                )}

                {(state === 'idle-placeholder' || state === 'error-final') && (
                    <motion.div
                        key="placeholder"
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
                        className={css({
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bg: 'bg.surfaceSoft',
                        })}
                    >
                        <ImageIcon
                            size={VARIANT_ICON_SIZE[variant]}
                            aria-hidden="true"
                            className={css({ color: 'brand.muted' })}
                        />
                    </motion.div>
                )}

                {state === 'loaded' && activeUrl && (
                    <motion.div
                        key={`loaded-${activeUrl}`}
                        initial={reducedMotion ? false : { opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: fadeInMs / 1000, ease: 'easeOut' }}
                        className={css({
                            position: 'absolute',
                            inset: 0,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                        })}
                        style={loadedBackgroundStyle}
                        role="img"
                        aria-label={alt}
                    />
                )}

                {state === 'loading-img' && (
                    <motion.div
                        key="loading-img"
                        initial={false}
                        animate={{ opacity: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.12, ease: 'easeOut' }}
                        className={css({
                            position: 'absolute',
                            inset: 0,
                            bg: 'bg.surfaceSoft',
                        })}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function getAriaLabel(state: PlanImageState, alt: string): string {
    switch (state) {
        case 'idle-empty':
            return '이미지 불러오는 중'
        case 'loading-recovery':
            return '이미지 복구 중'
        case 'loading-img':
            return '이미지 표시 준비 중'
        case 'idle-placeholder':
        case 'error-final':
            return '장소 사진 없음'
        default:
            return alt
    }
}

export default PlanImage
