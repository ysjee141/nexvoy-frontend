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

// 파일을 Base64로 변환하는 헬퍼 함수
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
});

export const sendBugReportToDiscord = async (data: BugReportData) => {
    try {
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

        // 2. 파일 데이터를 Base64 배열로 변환
        const base64Files = [];
        if (data.files && data.files.length > 0) {
            for (const file of data.files) {
                const base64String = await toBase64(file);
                base64Files.push({
                    name: file.name,
                    type: file.type,
                    data: base64String
                });
            }
        }

        // 3. 서버 API 호출
        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? (process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexvoy.xyz') 
            : '';
        const apiUrl = `${baseUrl}/api/feedback/`;

        console.log(`피드백 전송 시작 (${isNative ? 'Native' : 'Web'}): ${apiUrl}`);

        const requestBody = {
            payload_json: JSON.stringify(payload),
            files: base64Files
        };

        let status: number;
        let responseData: any;

        if (isNative) {
            // 네이티브 환경에서는 CapacitorHttp를 사용하여 CORS를 우회하고 
            // 모든 데이터를 JSON으로 전송하여 전송 안정성을 최대화합니다.
            const response = await CapacitorHttp.post({
                url: apiUrl,
                data: requestBody,
                headers: { 'Content-Type': 'application/json' }
            });
            status = response.status;
            responseData = response.data;
        } else {
            // 웹 환경에서도 동일한 JSON 구조 사용
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            status = res.status;
            responseData = await res.json().catch(() => ({}));
        }

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
