/**
 * Discord Webhook을 통한 버그 제보 데이터 전송 유틸리티
 */

interface BugReportData {
    userEmail: string;
    userId: string;
    content: string;
    currentUrl: string;
    browserInfo: string;
    files?: File[];
}

import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const sendBugReportToDiscord = async (data: BugReportData) => {
    try {
        const formData = new FormData();
        
        // 1. 기본 메시지 내용 구성
        const payload = {
            content: `📢 **신규 버그 제보가 도착했습니다!** (v${process.env.NEXT_PUBLIC_VERSION || '1.0.0'})`,
            embeds: [
                {
                    title: "📝 테스터 피드백",
                    color: 0x3B82F6, // Blue
                    fields: [
                        { name: "👤 테스터", value: `${data.userEmail} (${data.userId})`, inline: true },
                        { name: "📍 위치", value: data.currentUrl, inline: true },
                        { name: "💬 내용", value: data.content, inline: false },
                        { name: "🌐 환경", value: data.browserInfo, inline: false },
                    ],
                    footer: { text: "NexVoy Beta Test" },
                    timestamp: new Date().toISOString(),
                }
            ]
        };

        // 클라이언트에서 payload_json을 문자열로 추가
        formData.append('payload_json', JSON.stringify(payload));

        // 2. 파일 첨부 (있을 경우)
        if (data.files && data.files.length > 0) {
            data.files.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });
        }

        // 3. 서버 API 호출
        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? (process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexvoy.xyz') 
            : '';
        const apiUrl = `${baseUrl}/api/feedback/`;

        console.log(`피드백 전송 시작 (${isNative ? 'Native' : 'Web'}): ${apiUrl}`);

        // 리다이렉트와 CORS 문제가 해결되었으므로, 
        // FormData를 가장 표준적으로 처리하는 fetch를 다시 사용합니다.
        const res = await fetch(apiUrl, {
            method: 'POST',
            body: formData,
        });

        const status = res.status;
        const responseData = await res.json().catch(() => ({}));

        if (status >= 200 && status < 300) {
            console.log('피드백 전송 성공!');
            return { success: true };
        } else {
            console.error('피드백 전송 실패 (API 에러):', status, JSON.stringify(responseData));
            return { 
                success: false, 
                error: '전송 실패', 
                detail: `Status: ${status}, Msg: ${responseData.error || 'Unknown'}` 
            };
        }
    } catch (error: any) {
        console.error('피드백 전송 중 예외 발생:', error);
        
        let detail = 'Unknown Error';
        if (error instanceof Error) {
            detail = error.message;
        } else if (error && typeof error === 'object') {
            try { detail = JSON.stringify(error); } catch (e) { detail = 'Non-serializable object'; }
        }

        return { success: false, error: '시스템 오류', detail };
    }
};
