import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const { email, tripTitle, tripId } = await req.json()

        if (!email || !tripTitle) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'Resend API Key is not configured' }, { status: 500 })
        }

        // 라이브러리 대신 표준 fetch API를 사용하여 Resend REST API 호출
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Onvoy <onboarding@nexvoy.xyz>',
                to: [email],
                subject: `[Onvoy] ${tripTitle} 여행에 초대되었습니다!`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                        <h2 style="color: #10B981;">Onvoy 초대장 ✈️</h2>
                        <p>안녕하세요!</p>
                        <p><strong>${tripTitle}</strong> 여행의 협업자로 초대되었습니다.</p>
                        <p>아래 링크를 통해 초대 내용을 확인하고 수락해 주세요.</p>
                        <div style="margin: 30px 0;">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexvoy.xyz'}" 
                               style="background-color: #111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                초대 확인하기
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px;">본 메일은 Onvoy 서비스에서 발송되었습니다.</p>
                    </div>
                `,
            })
        })

        const data = await response.json()
        console.log('Resend API Response:', data)

        if (!response.ok) {
            let errorMessage = data.message || 'Failed to send email'

            // Resend Sandbox 관련 특수 안내
            if (data.message?.includes('onboarding@resend.dev') || data.code === 403) {
                errorMessage = 'Resend 무료 플랜(Sandbox)에서는 가입된 계정 이외의 이메일로 발송하려면 도메인 인증이 필요합니다.'
            }

            return NextResponse.json({
                error: errorMessage,
                details: data
            }, { status: response.status })
        }

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        console.error('Invite API Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
