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
        // 1. 디스코드 페이로드 구성
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

        // 2. FormData 구성
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(payload));

        if (data.files && data.files.length > 0) {
            data.files.forEach((file, index) => {
                // 키 이름은 서버(route.ts)에서 인식하는 'file' 프리픽스를 사용합니다.
                formData.append(`file${index}`, file);
            });
        }

        // 3. 서버 API 호출
        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? (process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexvoy.xyz') 
            : '';
        // 엔드포인트에서 슬래시(/)를 제거하여 리다이렉트 가능성을 방지합니다.
        const apiUrl = `${baseUrl}/api/feedback/`;

        console.log(`피드백 전송 시작 (${isNative ? 'Native' : 'Web'}): ${apiUrl}`);


        let status: number;
        let responseData: any;

        if (isNative) {
            // 네이티브 환경에서는 CapacitorHttp를 사용하여 CORS를 우회합니다.
            // 중요: FormData 사용 시 'Content-Type' 헤더를 명시하지 않아야 바운더리가 자동 생성됩니다.
            const response = await CapacitorHttp.post({
                url: apiUrl,
                data: formData,
                // headers: { 'Content-Type': 'multipart/form-data' } // 절대 수동 지정 금지
            });
            status = response.status;
            responseData = response.data;
        } else {
            // 웹 환경 (fetch 사용 시에도 Content-Type은 브라우저에 맡김)
            const res = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
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
            try { 
                // CapacitorHttp 에러 객체의 경우 more info가 있을 수 있음
                detail = JSON.stringify(error); 
            } catch (e) { 
                detail = String(error); 
            }
        }

        return { success: false, error: '시스템 오류', detail };
    }
};
