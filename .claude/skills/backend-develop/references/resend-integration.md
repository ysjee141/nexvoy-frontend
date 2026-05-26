# Resend 이메일 통합 가이드

## 환경변수

```
RESEND_API_KEY=re_xxxxx        # 절대 코드/응답/로그에 노출 금지
RESEND_FROM_EMAIL=...@domain   # 인증된 도메인 사용
RESEND_REPLY_TO=...@domain     # (선택)
```

`.env.local`에만 저장하고 git에 커밋되지 않게 한다. `next.config.ts`에서 클라이언트로 노출 금지 (`NEXT_PUBLIC_*` 접두사 금지).

## 발송 헬퍼 (Service 형태)

```typescript
// src/services/EmailService.ts
import { Resend } from 'resend';

export class EmailService {
  private static instance: EmailService;
  private resend: Resend;

  private constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) EmailService.instance = new EmailService();
    return EmailService.instance;
  }

  async send(params: {
    to: string;
    subject: string;
    react: React.ReactElement;
  }): Promise<{ ok: boolean; id?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: params.to,
        subject: params.subject,
        react: params.react,
      });
      if (error) {
        // 개인정보 노출 방지 -- to를 마스킹
        const masked = this.maskEmail(params.to);
        console.error('[EmailService.send] failed', { to: masked, error });
        return { ok: false };
      }
      return { ok: true, id: data?.id };
    } catch (err) {
      console.error('[EmailService.send] exception', err);
      return { ok: false }; // best-effort -- throw하지 않음
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const visible = local.slice(0, 2);
    return `${visible}***@${domain}`;
  }
}
```

## API Route에서 사용

```typescript
// src/app/api/invites/route.ts
export async function POST(req: NextRequest) {
  try {
    // ... 인증/검증 ...
    const invite = await InviteService.getInstance().create(...);

    // 이메일은 best-effort -- 실패해도 응답은 정상
    EmailService.getInstance().send({
      to: invite.email,
      subject: '여행 초대장이 도착했어요',
      react: InviteEmail({ inviteUrl: invite.url, tripName: trip.name }),
    }).catch(() => { /* 로그는 EmailService 내부에서 */ });

    return NextResponse.json({ ok: true, data: invite }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/invites]', err);
    return NextResponse.json(
      { ok: false, error: '초대 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## React 이메일 템플릿

```typescript
// src/emails/InviteEmail.tsx
import { Html, Button, Text } from '@react-email/components';

interface Props {
  inviteUrl: string;
  tripName: string;
}

export default function InviteEmail({ inviteUrl, tripName }: Props) {
  return (
    <Html>
      <Text>{tripName} 여행에 초대되었습니다.</Text>
      <Button href={inviteUrl}>초대 수락하기</Button>
    </Html>
  );
}
```

## 보안·개인정보 체크

- [ ] API 키 환경변수에서만 읽기 (코드 하드코딩 금지)
- [ ] 응답·로그에 수신자 이메일 노출 시 마스킹 (`ab***@domain.com`)
- [ ] 이메일 본문에 민감 정보(비밀번호 평문, 결제 정보 등) 포함 금지
- [ ] 매직링크는 짧은 만료 시간 (예: 15분)
- [ ] 발송 결과는 best-effort -- 사용자 흐름을 막지 않음
- [ ] 실패 시 사용자에게 "잠시 후 다시 시도" 같은 일반 메시지 (Resend 내부 에러 노출 금지)

## 로컬 개발

- Resend는 development 모드에서도 실제 발송함 (sandbox 없음)
- 개발 시 본인 이메일로 테스트하거나, `RESEND_FROM_EMAIL`을 dev 도메인으로 분리
- 또는 발송을 조건부로 skip하는 환경 플래그 (`RESEND_ENABLED=false`)
