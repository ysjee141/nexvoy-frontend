'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Clock3, KeyRound, Loader2 } from 'lucide-react'
import { css } from 'styled-system/css'

export type DocumentKeyProvisioningStatus =
    | 'waiting_for_material'
    | 'pending'
    | 'processing'
    | 'failed'
    | 'completed'

export interface DocumentKeyProvisioningCopy {
    label: string
    title: string
    description: string
    actionLabel: string
}

export const DOCUMENT_KEY_PROVISIONING_COPY: Record<DocumentKeyProvisioningStatus, DocumentKeyProvisioningCopy> = {
    waiting_for_material: {
        label: '기기 준비 대기',
        title: '참여 기기 정보를 기다리고 있어요',
        description: '초대받은 사용자가 이 기기의 보안 정보를 등록하면 여정 데이터를 준비할 수 있습니다.',
        actionLabel: '상태 다시 확인',
    },
    pending: {
        label: '데이터 준비 대기',
        title: '여정 데이터를 안전하게 준비하고 있어요',
        description: '참여는 완료됐지만 아직 이 기기에서 여정 데이터를 열 수 없습니다. 관리자 또는 편집자가 준비를 완료하면 다시 시도할 수 있어요.',
        actionLabel: '준비 상태 다시 확인',
    },
    processing: {
        label: '데이터 준비 중',
        title: '여정 데이터를 준비하는 중이에요',
        description: '관리자 또는 편집자 기기에서 이 참여자가 여정을 열 수 있도록 준비하고 있습니다.',
        actionLabel: '처리 중',
    },
    failed: {
        label: '다시 시도 필요',
        title: '여정 데이터 준비가 지연되고 있어요',
        description: '일시적인 문제로 여정 데이터를 열 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 준비 상태 확인을 요청해 주세요.',
        actionLabel: '다시 시도',
    },
    completed: {
        label: '데이터 준비 완료',
        title: '이 기기에서 여정 데이터를 열 수 있어요',
        description: '여정 데이터 준비가 완료되었습니다. 다시 불러오면 참여를 계속할 수 있습니다.',
        actionLabel: '여정 다시 열기',
    },
}

interface DocumentKeyProvisioningStatusBadgeProps {
    status: DocumentKeyProvisioningStatus
    count?: number
    className?: string
}

interface DocumentKeyProvisioningStatusCardProps {
    status: DocumentKeyProvisioningStatus
    memberName?: string | null
    errorCode?: string | null
    pendingCount?: number
    primaryActionLabel?: string
    primaryActionBusy?: boolean
    onPrimaryAction?: () => void
    footer?: ReactNode
    className?: string
}

const STATUS_BADGE_CLASS: Record<DocumentKeyProvisioningStatus, string> = {
    waiting_for_material: css({
        bg: 'bg.surfaceSoft',
        borderColor: 'brand.hairline',
        color: 'brand.muted',
    }),
    pending: css({
        bg: 'bg.surfaceSoft',
        borderColor: 'brand.primary',
        color: 'brand.primary',
    }),
    processing: css({
        bg: 'bg.surfaceSoft',
        borderColor: 'brand.primary',
        color: 'brand.primary',
    }),
    failed: css({
        bg: 'bg.surfaceSoft',
        borderColor: 'brand.error',
        color: 'brand.error',
    }),
    completed: css({
        bg: 'bg.surfaceSoft',
        borderColor: 'brand.success',
        color: 'brand.success',
    }),
}

const STATUS_ICON_CLASS: Record<DocumentKeyProvisioningStatus, string> = {
    waiting_for_material: css({ color: 'brand.muted' }),
    pending: css({ color: 'brand.primary' }),
    processing: css({ color: 'brand.primary', animation: 'spin 1s linear infinite' }),
    failed: css({ color: 'brand.error' }),
    completed: css({ color: 'brand.success' }),
}

const STATUS_ACTION_CLASS: Record<DocumentKeyProvisioningStatus, string> = {
    waiting_for_material: css({
        bg: 'brand.primary',
        color: 'white',
        borderColor: 'brand.primary',
        _hover: { bg: 'brand.primaryActive' },
    }),
    pending: css({
        bg: 'brand.primary',
        color: 'white',
        borderColor: 'brand.primary',
        _hover: { bg: 'brand.primaryActive' },
    }),
    processing: css({
        bg: 'brand.primary',
        color: 'white',
        borderColor: 'brand.primary',
        _hover: { bg: 'brand.primaryActive' },
    }),
    failed: css({
        bg: 'white',
        color: 'brand.error',
        borderColor: 'brand.error',
        _hover: { bg: 'bg.surfaceSoft' },
    }),
    completed: css({
        bg: 'brand.primary',
        color: 'white',
        borderColor: 'brand.primary',
        _hover: { bg: 'brand.primaryActive' },
    }),
}

function StatusIcon({ status }: { status: DocumentKeyProvisioningStatus }) {
    const className = STATUS_ICON_CLASS[status]

    if (status === 'completed') return <CheckCircle2 size={18} className={className} aria-hidden />
    if (status === 'failed') return <AlertCircle size={18} className={className} aria-hidden />
    if (status === 'processing') return <Loader2 size={18} className={className} aria-hidden />
    if (status === 'waiting_for_material') return <KeyRound size={18} className={className} aria-hidden />
    return <Clock3 size={18} className={className} aria-hidden />
}

export function DocumentKeyProvisioningStatusBadge({
    status,
    count,
    className,
}: DocumentKeyProvisioningStatusBadgeProps) {
    const copy = DOCUMENT_KEY_PROVISIONING_COPY[status]
    const text = typeof count === 'number' ? `${copy.label} ${count}건` : copy.label

    return (
        <span
            className={[
                css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    minH: '24px',
                    px: '8px',
                    py: '3px',
                    borderRadius: '9999px',
                    border: '1px solid',
                    fontSize: '11px',
                    fontWeight: '700',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                }),
                STATUS_BADGE_CLASS[status],
                className,
            ].filter(Boolean).join(' ')}
        >
            <StatusIcon status={status} />
            {text}
        </span>
    )
}

export function DocumentKeyProvisioningStatusCard({
    status,
    memberName,
    errorCode,
    pendingCount,
    primaryActionLabel,
    primaryActionBusy = false,
    onPrimaryAction,
    footer,
    className,
}: DocumentKeyProvisioningStatusCardProps) {
    const copy = DOCUMENT_KEY_PROVISIONING_COPY[status]
    const actionLabel = primaryActionLabel ?? copy.actionLabel
    const shouldDisableAction = primaryActionBusy || status === 'processing'

    return (
        <section
            aria-live={status === 'completed' ? 'polite' : 'assertive'}
            className={[
                css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    p: '16px',
                    bg: 'white',
                    border: '1px solid',
                    borderColor: 'brand.hairline',
                    borderRadius: '16px',
                    boxShadow: 'shadow.sm',
                }),
                className,
            ].filter(Boolean).join(' ')}
        >
            <div className={css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' })}>
                <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '10px', minW: 0 })}>
                    <div className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        w: '36px',
                        h: '36px',
                        borderRadius: '12px',
                        bg: 'bg.surfaceSoft',
                        border: '1px solid',
                        borderColor: 'brand.hairline',
                    })}>
                        <StatusIcon status={status} />
                    </div>
                    <div className={css({ minW: 0 })}>
                        <h3 className={css({ color: 'brand.ink', fontSize: '15px', fontWeight: '700', lineHeight: 1.35 })}>
                            {memberName ? `${memberName}님 데이터 준비 상태` : copy.title}
                        </h3>
                        <p className={css({ mt: '4px', color: 'brand.muted', fontSize: '13px', fontWeight: '500', lineHeight: 1.55, wordBreak: 'keep-all' })}>
                            {memberName ? copy.title : copy.description}
                        </p>
                    </div>
                </div>
                <DocumentKeyProvisioningStatusBadge status={status} count={pendingCount} />
            </div>

            {memberName ? (
                <p className={css({ color: 'brand.muted', fontSize: '13px', lineHeight: 1.55, wordBreak: 'keep-all' })}>
                    {copy.description}
                </p>
            ) : null}

            {errorCode ? (
                <p className={css({
                    p: '10px 12px',
                    bg: 'bg.surfaceSoft',
                    borderRadius: '8px',
                    color: 'brand.muted',
                    fontSize: '12px',
                    fontWeight: '600',
                    lineHeight: 1.45,
                })}>
                    준비가 지연되고 있어요. 잠시 후 다시 시도해 주세요.
                </p>
            ) : null}

            {onPrimaryAction ? (
                <button
                    type="button"
                    onClick={onPrimaryAction}
                    disabled={shouldDisableAction}
                    className={[
                        css({
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            minH: '44px',
                            px: '16px',
                            py: '10px',
                            border: '1px solid',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            _active: { transform: 'scale(0.98)' },
                            _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none' },
                        }),
                        STATUS_ACTION_CLASS[status],
                    ].join(' ')}
                >
                    {primaryActionBusy ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} aria-hidden /> : null}
                    {actionLabel}
                </button>
            ) : null}

            {footer}
        </section>
    )
}
