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

import { Capacitor } from '@capacitor/core';

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

        // 3. 서버 API 호출 (CORS 회피 및 보안을 위해 서버 사이드 API 사용)
        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative ? (process.env.NEXT_PUBLIC_APP_URL || '') : '';
        const apiUrl = `${baseUrl}/api/feedback`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('피드백 전송 실패 (API 에러):', errorData);
            return { success: false, error: '전송 실패' };
        }
    } catch (error) {
        console.error('피드백 전송 중 오류 발생:', error);
        return { success: false, error: '시스템 오류' };
    }
};
