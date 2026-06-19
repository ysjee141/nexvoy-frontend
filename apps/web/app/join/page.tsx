import { Suspense } from 'react';
import JoinClient from './JoinClient';

export default function JoinPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
                <h1 className="text-xl font-bold mb-2">여정 참여 중...</h1>
            </div>
        }>
            <JoinClient />
        </Suspense>
    );
}
