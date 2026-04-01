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
        const contentType = req.headers.get('content-type') || ''
        let payloadValue: string | null = null
        const files: { key: string, value: File }[] = []

        if (contentType.includes('application/json')) {
            const body = await req.json()
            payloadValue = body.payload_json
        } else {
            const formData = await req.formData()
            payloadValue = formData.get('payload_json') as string
            
            // 파일 필드 추출
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('file') && value instanceof File) {
                    files.push({ key, value })
                }
            }
        }

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'Server configuration error', detail: 'Discord Webhook URL is missing' }, 
                { status: 500, headers: corsHeaders }
            )
        }

        if (!payloadValue || typeof payloadValue !== 'string') {
            return NextResponse.json(
                { error: 'Invalid request data', detail: 'payload_json is missing or invalid' }, 
                { status: 400, headers: corsHeaders }
            )
        }

        let response
        if (files.length === 0) {
            // 파일이 없으면 JSON 형식으로 디스크로드에 전송 (가장 안정적)
            response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payloadValue,
            })
        } else {
            // 파일이 있으면 multipart/form-data 형식으로 전송
            const discordFormData = new FormData()
            discordFormData.append('payload_json', payloadValue)
            files.forEach(f => discordFormData.append(f.key, f.value))
            
            response = await fetch(webhookUrl, {
                method: 'POST',
                body: discordFormData,
            })
        }

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
