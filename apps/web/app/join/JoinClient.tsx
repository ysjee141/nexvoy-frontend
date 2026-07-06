'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    acceptInvitationWithLegacyFallback,
    createInvitationRepository,
    getInvitationSummaryWithLegacyFallback,
    type DocumentInvitationSummary,
    type LegacyTripInvitationSummary,
} from '@nexvoy/core/supabase/invitationRepository';
import type { DocumentKeyProvisioningStatusRecord } from '@nexvoy/core/sync/keyProvisioning';
import {
    DocumentKeyProvisioningStatusCard,
    type DocumentKeyProvisioningStatus,
} from '@/components/trips/DocumentKeyProvisioningStatus';
import { ensureWebDeviceKeyMaterial, getOrCreateWebDeviceId } from '@/lib/local-first/keyProvisioningService';

type JoinSummary =
    | { source: 'document'; tripId: string; destination: string | null; startDate: string | null; endDate: string | null; ownerNickname: string | null; role: 'editor' | 'viewer' }
    | { source: 'legacy'; tripId: string; destination: string; startDate: string; endDate: string; ownerNickname: string | null; role: 'editor' }

type JoinInput = { token?: string; inviteCode?: string };

const INVALID_INVITE_COPY = '유효하지 않거나 만료된 초대입니다.';

export default function JoinClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const code = searchParams.get('code');

    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<JoinSummary | null>(null);
    const [codeInput, setCodeInput] = useState('');
    const [activeInput, setActiveInput] = useState<JoinInput | null>(null);
    const [provisioningRequired, setProvisioningRequired] = useState(false);
    const [acceptedDocumentId, setAcceptedDocumentId] = useState<string | null>(null);
    const [provisioningStatus, setProvisioningStatus] = useState<DocumentKeyProvisioningStatusRecord | null>(null);
    const [statusChecking, setStatusChecking] = useState(false);

    const resolveInvitation = async (input: JoinInput) => {
        setLoading(true);
        setError(null);
        setProvisioningRequired(false);
        setAcceptedDocumentId(null);
        setProvisioningStatus(null);
        try {
            const supabase = createClient();
            const result = await getInvitationSummaryWithLegacyFallback(supabase, input);
            if (!result.summary) throw new Error(INVALID_INVITE_COPY);

            const normalizedSummary = normalizeSummary(result.source, result.summary);
            setSummary(normalizedSummary);
            setActiveInput(input);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace(`/login?next=${encodeURIComponent(buildJoinPath(input))}`);
                return;
            }
        } catch {
            setSummary(null);
            setActiveInput(null);
            setError(INVALID_INVITE_COPY);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const input = token ? { token } : code ? { inviteCode: code } : null;
        if (input) {
            void resolveInvitation(input);
        } else {
            setLoading(false);
            setError('초대 코드 또는 링크를 입력해 주세요.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, code]);

    const handleCodeSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const inviteCode = sanitizeInviteCode(codeInput);
        if (!inviteCode) {
            setError('초대 코드를 입력해 주세요.');
            return;
        }
        void resolveInvitation({ inviteCode });
    };

    const handleAccept = async () => {
        if (!activeInput || !summary || accepting) return;
        setAccepting(true);
        setError(null);
        setProvisioningRequired(false);
        try {
            const supabase = createClient();
            let deviceId: string | null = null;
            if (summary.source === 'document') {
                const material = await ensureWebDeviceKeyMaterial(supabase);
                deviceId = material.deviceId;
            }
            const result = await acceptInvitationWithLegacyFallback(supabase, activeInput);
            if (result.source === 'document') {
                if (result.result.requiresKeyProvisioning) {
                    const status = await loadProvisioningStatus(result.result.documentId, deviceId ?? getOrCreateWebDeviceId());
                    setAcceptedDocumentId(result.result.documentId);
                    setProvisioningStatus(status);
                    setProvisioningRequired(true);
                    return;
                }
                router.replace(`/trips/detail?id=${result.result.documentId}`);
                return;
            }
            router.replace(`/trips/detail?id=${result.tripId ?? summary.tripId}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            setError(message.toLowerCase().includes('already')
                ? '이미 참여 중인 여정입니다.'
                : '초대를 수락하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setAccepting(false);
        }
    };

    const loadProvisioningStatus = async (
        documentId: string,
        deviceId: string,
        options: { requestIfNeeded?: boolean } = { requestIfNeeded: true },
    ): Promise<DocumentKeyProvisioningStatusRecord> => {
        const supabase = createClient();
        const repository = createInvitationRepository(supabase);
        try {
            const status = await repository.getMyDocumentKeyProvisioningStatus({
                documentId,
                deviceId,
                keyVersion: 1,
            });
            if ((status.status === 'none' || status.status === 'failed') && options.requestIfNeeded !== false) {
                return repository.requestDocumentKeyProvisioning({
                    documentId,
                    deviceId,
                    keyVersion: 1,
                });
            }
            return status;
        } catch {
            if (options.requestIfNeeded === false) throw new Error('status_failed');
            return repository.requestDocumentKeyProvisioning({
                documentId,
                deviceId,
                keyVersion: 1,
            });
        }
    };

    const handleProvisioningRetry = async () => {
        const documentId = acceptedDocumentId ?? (summary?.source === 'document' ? summary.tripId : null);
        if (!documentId || statusChecking) return;

        setStatusChecking(true);
        setError(null);
        try {
            const supabase = createClient();
            const { deviceId } = await ensureWebDeviceKeyMaterial(supabase);
            const status = await loadProvisioningStatus(documentId, deviceId);
            setAcceptedDocumentId(documentId);
            setProvisioningStatus(status);
            setProvisioningRequired(!status.hasActiveKey && status.status !== 'completed');
            if (status.hasActiveKey || status.status === 'completed') {
                router.replace(`/trips/detail?id=${documentId}`);
            }
        } catch {
            setError('여정 데이터 준비 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setStatusChecking(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
                <h1 className="text-xl font-bold mb-2">여정 참여 중...</h1>
                <p className="text-gray-500">잠시만 기다려주세요.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">참여 실패</h1>
                <p className="text-gray-500 mb-6">{error}</p>
                <form onSubmit={handleCodeSubmit} className="w-full max-w-sm mb-4">
                    <input
                        value={codeInput}
                        onChange={(event) => setCodeInput(formatInviteCode(event.target.value))}
                        placeholder="초대 코드 입력"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center font-bold tracking-widest mb-3"
                    />
                    <button
                        type="submit"
                        className="w-full px-6 py-3 bg-primary-500 text-white rounded-full font-medium"
                    >
                        초대 확인
                    </button>
                </form>
                <button
                    onClick={() => router.replace('/')}
                    className="px-6 py-2 border border-gray-200 text-gray-700 rounded-full font-medium"
                >
                    홈으로 가기
                </button>
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary-500">
                    ✈
                </div>
                <h1 className="text-xl font-bold mb-2">
                    {summary.destination ? `${summary.destination} 여정에 초대받았어요` : '여정에 초대받았어요'}
                </h1>
                <p className="text-gray-500 mb-4">
                    {summary.ownerNickname ? `${summary.ownerNickname}님이 초대했습니다.` : '초대 정보를 확인했습니다.'}
                </p>
                <div className="text-sm text-gray-600 mb-6 space-y-1">
                    <p>권한: {summary.role === 'editor' ? '편집자' : '뷰어'}</p>
                    {summary.startDate && summary.endDate ? <p>기간: {summary.startDate} ~ {summary.endDate}</p> : null}
                </div>
                {provisioningRequired && provisioningStatus ? (
                    <DocumentKeyProvisioningStatusCard
                        status={toDisplayProvisioningStatus(provisioningStatus.status)}
                        errorCode={provisioningStatus.errorCode}
                        primaryActionLabel={provisioningStatus.hasActiveKey || provisioningStatus.status === 'completed'
                            ? '여정 열기'
                            : '준비 상태 다시 확인'}
                        primaryActionBusy={statusChecking}
                        onPrimaryAction={handleProvisioningRetry}
                        className="mb-4 text-left"
                    />
                ) : null}
                {error ? <p className="text-sm text-red-500 mb-4">{error}</p> : null}
                <button
                    onClick={provisioningRequired ? handleProvisioningRetry : handleAccept}
                    disabled={accepting || statusChecking}
                    className="w-full px-6 py-3 bg-primary-500 text-white rounded-full font-medium disabled:opacity-50"
                >
                    {accepting || statusChecking ? '확인 중...' : provisioningRequired ? '준비 상태 다시 확인' : '여정에 참여하기'}
                </button>
                <button
                    onClick={() => {
                        setSummary(null);
                        setActiveInput(null);
                        setError('초대 코드를 입력해 주세요.');
                    }}
                    className="mt-3 text-sm font-medium text-gray-500"
                >
                    초대 코드로 다시 입력
                </button>
            </div>
        </div>
    );
}

function normalizeSummary(source: 'document' | 'legacy', value: DocumentInvitationSummary | LegacyTripInvitationSummary): JoinSummary {
    if (source === 'document') {
        const summary = value as DocumentInvitationSummary;
        return {
            source,
            tripId: summary.documentId,
            destination: summary.destination,
            startDate: summary.startDate,
            endDate: summary.endDate,
            ownerNickname: summary.ownerNickname,
            role: summary.role,
        };
    }

    const summary = value as LegacyTripInvitationSummary;
    return {
        source,
        tripId: summary.trip_id,
        destination: summary.destination,
        startDate: summary.start_date,
        endDate: summary.end_date,
        ownerNickname: summary.owner_nickname,
        role: 'editor',
    };
}

function buildJoinPath(input: JoinInput): string {
    if (input.token) return `/join?token=${encodeURIComponent(input.token)}`;
    if (input.inviteCode) return `/join?code=${encodeURIComponent(input.inviteCode)}`;
    return '/join';
}

function sanitizeInviteCode(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function formatInviteCode(value: string): string {
    return sanitizeInviteCode(value).replace(/(.{4})(?=.)/g, '$1-');
}

function toDisplayProvisioningStatus(status: DocumentKeyProvisioningStatusRecord['status']): DocumentKeyProvisioningStatus {
    if (status === 'waiting_for_material' || status === 'pending' || status === 'processing' || status === 'failed' || status === 'completed') {
        return status;
    }
    return status === 'none' ? 'pending' : 'failed';
}
