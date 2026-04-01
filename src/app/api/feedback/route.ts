import { NextRequest, NextResponse } from 'next/server'

/**
 * 테스터 피드백을 디스코드 Webhook으로 전달하는 서버 사이드 API
 * 클라이언트의 CORS 문제를 방지하고 Webhook URL을 숨기기 위해 사용합니다.
 */
export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    })
}

export async function POST(req: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    try {
        const formData = await req.formData()
        const receivedKeys = Array.from(formData.keys())
        console.log('Feedback API 수신 데이터 키:', receivedKeys)

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL

        if (!webhookUrl) {
            console.error('Discord Webhook URL이 설정되어 있지 않습니다.')
            return NextResponse.json(
                { error: 'Server configuration error', detail: 'Discord Webhook URL is missing in server environment' }, 
                { status: 500, headers: corsHeaders }
            )
        }

        // 디스크로드로 보낼 새로운 FormData 구성 (Discord API 호환)
        const discordFormData = new FormData()
        
        // payload_json 전달
        const payloadValue = formData.get('payload_json')
        if (payloadValue && typeof payloadValue === 'string') {
            discordFormData.append('payload_json', payloadValue)
        } else {
            console.error('payload_json 필드가 없거나 문자열이 아닙니다.', receivedKeys)
            return NextResponse.json(
                { error: 'Invalid request data', detail: 'Missing or invalid payload_json field', keys: receivedKeys }, 
                { status: 400, headers: corsHeaders }
            )
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
            return NextResponse.json({ success: true }, { headers: corsHeaders })
        } else {
            const errorText = await response.text()
            console.error('Discord Webhook 호출 실패:', errorText)
            return NextResponse.json(
                { error: 'Discord delivery failed', detail: errorText }, 
                { status: response.status, headers: corsHeaders }
            )
        }
    } catch (err: any) {
        console.error('Feedback API Error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' }, 
            { status: 500, headers: corsHeaders }
        )
    }
}
