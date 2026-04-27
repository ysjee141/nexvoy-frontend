'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collaboration } from '@/utils/collaboration';
import { createClient } from '@/utils/supabase/client';

export default function JoinClient() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tripSummary, setTripSummary] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Fetch trip summary by token
                const { data: summary, error: summaryError } = await collaboration.getTripSummaryByToken(token);
                if (summaryError) throw summaryError;
                
                setTripSummary(summary);

                // 2. Check auth
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    // Redirect to login with next parameter
                    router.replace(`/login?next=/join/${token}`);
                    return;
                }

                // 3. Join trip
                const { data: tripId, error: joinError } = await collaboration.joinTripViaToken(token);
                if (joinError) throw joinError;

                // 4. Redirect to trip detail
                router.replace(`/trips/detail?id=${tripId}`);

            } catch (err: any) {
                console.error(err);
                setError(err.message || '링크 처리 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            init();
        }
    }, [token, router]);

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
                <button
                    onClick={() => router.replace('/')}
                    className="px-6 py-2 bg-primary-500 text-white rounded-full font-medium"
                >
                    홈으로 가기
                </button>
            </div>
        );
    }

    return null;
}
