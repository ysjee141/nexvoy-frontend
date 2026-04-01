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

// 파일을 Base64로 변환하는 헬퍼 함수 (Native 전용)
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

        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? (process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexvoy.xyz') 
            : '';
        // 중요: next.config.ts의 trailingSlash: true 설정에 맞춰 반드시 슬래시를 포함합니다.
        const apiUrl = `${baseUrl}/api/feedback/`;

        console.log(`피드백 전송 시작 (${isNative ? 'Native' : 'Web'}): ${apiUrl}`);

        let status: number;
        let responseData: any;

        if (isNative) {
            console.log('Native 전용 JSON/Base64 데이터 구성 중...');
            
            const base64Files = [];
            if (data.files && data.files.length > 0) {
                for (const file of data.files) {
                    try {
                        const base64String = await toBase64(file);
                        base64Files.push({
                            name: file.name,
                            type: file.type,
                            data: base64String
                        });
                        console.log(`파일 변환 완료: ${file.name} (${base64String.length} bytes)`);
                    } catch (fileError) {
                        console.error(`파일 변환 실패 (${file.name}):`, fileError);
                    }
                }
            }

            const requestBody = {
                payload_json: JSON.stringify(payload),
                files: base64Files
            };

            console.log('CapacitorHttp.post 호출 직전...');
            const response = await CapacitorHttp.post({
                url: apiUrl,
                data: requestBody,
                headers: { 'Content-Type': 'application/json' },
                connectTimeout: 10000, // 타임아웃 명시
                readTimeout: 10000
            });
            
            status = response.status;
            responseData = response.data;
            console.log(`Native 응답 수신: ${status}`);
        } else {
            // [웹 환경] 표준 FormData 사용
            const formData = new FormData();
            formData.append('payload_json', JSON.stringify(payload));
            if (data.files && data.files.length > 0) {
                data.files.forEach((file, index) => {
                    formData.append(`file${index}`, file);
                });
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
            });
            status = res.status;
            responseData = await res.json().catch(() => ({}));
        }

        if (status >= 200 && status < 300) {
            console.log('피드백 전송 최종 성공!');
            return { success: true };
        } else {
            console.error('피드백 전송 실패 (API 에러):', status, JSON.stringify(responseData));
            return { 
                success: false, 
                error: '전송 실패', 
                detail: `Status: ${status}, Msg: ${typeof responseData === 'string' ? responseData : (responseData.error || 'Unknown')}` 
            };
        }
    } catch (error: any) {
        console.error('피드백 전송 중 예외 발생:', error);
        
        // 상세 에러 추출 (ProgressEvent 등 대응)
        let detail = 'Unknown Error';
        if (error instanceof Error) {
            detail = `Error: ${error.message}`;
        } else if (error && typeof error === 'object') {
            try {
                // native bridge에서 오는 상세 정보가 있을 수 있음
                const keys = Object.keys(error);
                if (keys.length > 0) {
                    detail = keys.map(k => `${k}: ${error[k]}`).join(', ');
                } else {
                    detail = JSON.stringify(error);
                    if (detail === '{}') detail = `Object(${error.toString()})`;
                }
            } catch (e) {
                detail = String(error);
            }
        } else {
            detail = String(error);
        }

        return { success: false, error: '시스템 오류', detail };
    }
};
