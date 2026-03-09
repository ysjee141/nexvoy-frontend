import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
    try {
        const { email, tripTitle, tripId } = await req.json()

        if (!email || !tripTitle) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const { data, error } = await resend.emails.send({
            from: 'Next Voyage <onboarding@resend.dev>',
            to: [email],
            subject: `[Next Voyage] ${tripTitle} 여행에 초대되었습니다!`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; borderRadius: 12px;">
                    <h2 style="color: #4285F4;">Next Voyage 초대장 ✈️</h2>
                    <p>안녕하세요!</p>
                    <p><strong>${tripTitle}</strong> 여행의 협업자로 초대되었습니다.</p>
                    <p>아래 링크를 통해 초대 내용을 확인하고 수락해 주세요.</p>
                    <div style="margin: 30px 0;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" 
                           style="background-color: #111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                           초대 확인하기
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">본 메일은 Next Voyage 서비스에서 발송되었습니다.</p>
                </div>
            `,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
