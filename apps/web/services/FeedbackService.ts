import { apiService } from './ApiService';

export interface BugReportData {
  userEmail: string;
  userId: string;
  content: string;
  currentUrl: string;
  browserInfo: string;
  files?: File[];
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

class FeedbackService {
  private readonly apiUrl = '/api/feedback/';

  public async sendBugReport(data: BugReportData): Promise<FeedbackResponse> {
    try {
      const payload = {
        content: `📢 **신규 버그 제보가 도착했습니다!** (v${process.env.NEXT_PUBLIC_VERSION || '1.0.0'})`,
        embeds: [
          {
            title: "📝 테스터 피드백",
            color: 0x3B82F6,
            fields: [
              { name: "👤 테스터", value: `${data.userEmail} (${data.userId})`, inline: true },
              { name: "📍 위치", value: data.currentUrl, inline: true },
              { name: "💬 내용", value: data.content, inline: false },
              { name: "🌐 환경", value: data.browserInfo, inline: false },
            ],
            footer: { text: "OnVoy Beta Test" },
            timestamp: new Date().toISOString(),
          }
        ]
      };

      // Web 환경: FormData(multipart) 사용
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify(payload));
      if (data.files && data.files.length > 0) {
        data.files.forEach((file, index) => {
          formData.append(`file${index}`, file);
        });
      }

      const response = await apiService.post(this.apiUrl, formData);

      return {
        success: response.status >= 200 && response.status < 300,
        error: response.status >= 400 ? '전송 실패' : undefined,
        detail: response.status >= 400 ? `Status: ${response.status}` : undefined
      };
    } catch (error: any) {
      console.error('[FeedbackService] Error:', error);
      return {
        success: false,
        error: '시스템 오류',
        detail: error.message || String(error)
      };
    }
  }
}

export const feedbackService = new FeedbackService();
