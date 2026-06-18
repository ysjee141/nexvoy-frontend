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
        const files: { name: string, buffer: Buffer, type: string }[] = []

        if (contentType.includes('application/json')) {
            console.log('피드백 수신 (JSON/Base64 - Native App)');
            const body = await req.json()
            payloadValue = body.payload_json
            
            // Base64 파일 처리
            if (body.files && Array.isArray(body.files)) {
                for (const file of body.files) {
                    if (file.data && file.name) {
                        console.log(`Base64 파일 추출: ${file.name} (${file.type})`);
                        const buffer = Buffer.from(file.data, 'base64')
                        files.push({
                            name: file.name,
                            buffer: buffer,
                            type: file.type || 'application/octet-stream'
                        })
                    }
                }
            }
        } else {
            console.log('피드백 수신 (FormData/Multipart - Web)');
            const formData = await req.formData()
            payloadValue = formData.get('payload_json') as string
            
            // FormData에서 파일 추출
            const entries = Array.from(formData.entries());
            for (const [key, value] of entries) {
                if (value instanceof File) {
                    console.log(`Multipart 파일 추출: ${value.name} (${value.size} bytes)`);
                    const arrayBuffer = await value.arrayBuffer()
                    files.push({
                        name: value.name,
                        buffer: Buffer.from(arrayBuffer),
                        type: value.type
                    })
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
            console.log('디코 전송 시작 (내용만)');
            // 파일이 없으면 JSON 형식으로 디스크로드에 전송
            response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payloadValue,
            })
        } else {
            console.log(`디코 전송 시작 (파일 ${files.length}개 포함)`);
            // 파일이 있으면 multipart/form-data 형식으로 전송
            const discordFormData = new FormData()
            
            // JSON 데이터 추가
            discordFormData.append('payload_json', payloadValue)
            
            // 파일 데이터 추가 (규격: file[0], file[1]...)
            files.forEach((f, i) => {
                try {
                    // Buffer -> Blob 변환 과정 안정화 (Uint8Array 사용으로 타입 호환성 확보)
                    const blob = new Blob([new Uint8Array(f.buffer)], { type: f.type })
                    // 디스코드 공식 권장 필드명인 file[n] 사용
                    discordFormData.append(`file[${i}]`, blob, f.name)
                    console.log(`디코 페이로드에 파일 추가 완료: ${f.name} (as file[${i}])`);
                } catch (blobErr) {
                    console.error(`Blob 생성 오류 (${f.name}):`, blobErr);
                }
            })
            
            response = await fetch(webhookUrl, {
                method: 'POST',
                body: discordFormData,
            })
        }

        if (response.ok) {
            console.log('디스코드 최종 배달 성공!');
            return NextResponse.json({ success: true }, { headers: corsHeaders })
        } else {
            const errorText = await response.text()
            const errorStatus = response.status;
            console.error(`디스크로드 Webhook 배달 실패 (${errorStatus}):`, errorText)
            
            // 디스코드에서 상세 에러를 줄 수도 있으므로 전달
            return NextResponse.json(
                { error: 'Discord delivery failed', status: errorStatus, detail: errorText }, 
                { status: errorStatus, headers: corsHeaders }
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
