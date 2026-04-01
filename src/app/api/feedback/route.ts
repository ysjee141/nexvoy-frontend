import { NextRequest, NextResponse } from 'next/server'

/**
 * 테스터 피드백을 디스코드 Webhook으로 전달하는 서버 사이드 API
 * 클라이언트의 CORS 문제를 방지하고 Webhook URL을 숨기기 위해 사용합니다.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL

        if (!webhookUrl) {
            console.error('Discord Webhook URL이 설정되어 있지 않습니다.')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // 디스크로드로 보낼 새로운 FormData 구성
        const discordFormData = new FormData()
        
        // payload_json 전달
        const payloadJson = formData.get('payload_json')
        if (payloadJson) {
            discordFormData.append('payload_json', payloadJson)
        }

        // 모든 파일 필드 찾아서 전달 (file0, file1, ...)
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('file') && value instanceof File) {
                discordFormData.append(key, value)
            }
        }

        // 디스크로드 Webhook 호출
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: discordFormData,
        })

        if (response.ok) {
            return NextResponse.json({ success: true })
        } else {
            const errorText = await response.text()
            console.error('Discord Webhook 호출 실패:', errorText)
            return NextResponse.json({ error: 'Discord delivery failed' }, { status: response.status })
        }
    } catch (err: any) {
        console.error('Feedback API Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
