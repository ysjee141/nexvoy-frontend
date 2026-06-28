export type LegalListItem = {
  title?: string
  text: string
}

export type LegalBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'list'; items: LegalListItem[] }

export type LegalSection = {
  title: string
  blocks: LegalBlock[]
}

export type LegalDocument = {
  title: string
  intro: string
  sections: LegalSection[]
  footer: {
    noticeDate: string
    effectiveDate: string
    previousVersion: string
  }
}

export const ONVOY_TERMS_DOCUMENT: LegalDocument = {
  title: '이용약관 및 개인정보 처리방침',
  intro: '온여정(OnVoy)은 이용자의 개인정보를 소중히 다루며, 관련 법령을 투명하게 준수합니다.',
  sections: [
    {
      title: '제1조 개인정보의 수집 및 이용 목적',
      blocks: [
        {
          type: 'paragraph',
          text: '회사는 다음의 목적을 위해 필요한 최소한의 개인정보를 수집하며, 수집된 정보는 목적 이외의 용도로는 사용되지 않습니다.',
        },
        {
          type: 'list',
          items: [
            { title: '이용자 식별 및 본인 확인', text: '[필수] 이메일 주소, 비밀번호, 닉네임' },
            { title: '서비스 이용에 따른 민원 처리 및 고지사항 전달', text: '[필수] 이메일 주소, 닉네임' },
            { title: '서비스 분석 및 UX 개선 (Google Analytics, Firebase 이용)', text: '[선택] 서비스 이용 기록, 접속 로그, 쿠키, IP 정보' },
            { title: '비인가 사용 방지 및 서비스 안정성 유지', text: '[자동수집] 접속 IP, 서비스 이용 기록' },
          ],
        },
      ],
    },
    {
      title: '제2조 개인정보의 처리 및 보유 기간',
      blocks: [
        {
          type: 'paragraph',
          text: '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.',
        },
        {
          type: 'list',
          items: [
            { title: '보유 기간', text: '원칙적으로 이용자가 서비스 회원 자격을 유지하는 동안 보관하며, 회원 탈퇴 시 즉시 파기합니다.' },
            { text: '단, 관계 법령(전자상거래법 등)에 따라 보존할 필요가 있는 경우 해당 법령이 정한 기간 동안 보관합니다.' },
          ],
        },
      ],
    },
    {
      title: '제3조 개인정보의 파기절차 및 방법',
      blocks: [
        {
          type: 'paragraph',
          text: '회사는 개인정보 처리 목적이 달성된 후 다음과 같은 절차 및 방법에 따라 개인정보를 파기합니다.',
        },
        { type: 'subheading', text: '1. 파기절차' },
        {
          type: 'paragraph',
          text: '개인정보는 처리 목적이 달성된 후 별도의 DB로 옮겨져(지류의 경우 별도의 서류함) 관련 법령 및 내부 방침에 따라 일정 기간 보관된 후 파기됩니다. 해당 개인정보는 법률에 의한 경우가 아니고서는 보유되는 이외의 다른 목적으로 이용되지 않습니다.',
        },
        { type: 'subheading', text: '2. 파기방법' },
        {
          type: 'list',
          items: [
            { title: '전자적 파일 형태', text: '기록을 재생할 수 없는 기술적 방법을 사용하여 영구 삭제합니다.' },
            { title: '종이에 출력된 개인정보', text: '분쇄기로 분쇄하거나 소각을 통해 파기합니다.' },
          ],
        },
      ],
    },
    {
      title: '제4조 개인정보 처리 위탁',
      blocks: [
        {
          type: 'paragraph',
          text: '회사는 원활한 서비스 제공을 위해 아래와 같은 외부 전문업체에 개인정보 처리를 위탁하고 있습니다. 위탁 시 관련 법령에 따라 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있으며 위탁 업무 내용이 변경될 경우 공지사항을 통해 안내합니다.',
        },
        {
          type: 'list',
          items: [
            { title: 'Vercel, Inc.', text: '호스팅 및 인프라 관리' },
            { title: 'Supabase, Inc.', text: '회원 인증(Auth), 데이터베이스 및 보안 관리' },
            { title: 'Google LLC (Google Analytics/Firebase)', text: '서비스 로그 분석 및 앱 안정성 확인' },
            { title: 'Resend Labs', text: '서비스 공지 및 알림 메일 발송' },
          ],
        },
      ],
    },
    {
      title: '제5조 정보주체와 법정대리인의 권리·의무 및 행사방법',
      blocks: [
        {
          type: 'paragraph',
          text: '정보주체는 언제든지 자신의 개인정보를 조회, 수정, 삭제 요청하거나 서비스 탈퇴를 통해 개인정보 수집 동의를 철회할 수 있습니다.',
        },
        {
          type: 'list',
          items: [
            { title: '행사 방법', text: "서비스 내 '마이페이지' > '프로필 수정' 또는 이메일 문의를 통해 본인 확인 절차를 거친 후 서면, 전자우편 등을 통해 권리를 행사하실 수 있습니다." },
            { text: '정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.' },
          ],
        },
      ],
    },
    {
      title: '제6조 국외 이전 및 데이터 리전',
      blocks: [
        {
          type: 'paragraph',
          text: '본 서비스는 글로벌 클라우드 인프라를 활용하여 운영되며, 데이터의 안정성과 성능을 위해 아래의 리전에서 처리됩니다.',
        },
        {
          type: 'list',
          items: [
            { title: '이전 국가 및 데이터 리전', text: '대한민국 서울 (ap-northeast-2)' },
            { text: '회사는 향후 글로벌 서비스 확장에 따라 리전이 추가될 수 있으며, 이 경우 약관 개정을 통해 사전에 공지하겠습니다.' },
          ],
        },
      ],
    },
    {
      title: '제7조 개인정보의 안전성 확보 조치',
      blocks: [
        {
          type: 'paragraph',
          text: '회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.',
        },
        {
          type: 'list',
          items: [
            { title: '관리적 조치', text: '내부관리계획 수립 및 시행, 개인정보 보호 교육 실시 등' },
            { title: '기술적 조치', text: '개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치' },
            { title: '물리적 조치', text: '클라우드 인프라의 물리적 접근 통제 및 보안 구역 설정' },
          ],
        },
      ],
    },
    {
      title: '제8조 개인정보 보호 책임자',
      blocks: [
        {
          type: 'paragraph',
          text: '개인정보와 관련한 문의, 불만 처리 등은 아래의 책임자에게 문의하실 수 있습니다.',
        },
        {
          type: 'list',
          items: [
            { title: '담당자', text: '지윤성 (개인 운영자)' },
            { title: '문의처', text: 'ysjee141@gmail.com' },
          ],
        },
        {
          type: 'paragraph',
          text: '개인정보 침해에 대한 신고나 상담이 필요한 경우 아래의 기관에 문의하실 수 있습니다.',
        },
        {
          type: 'list',
          items: [
            { text: '개인정보침해신고센터: privacy.kisa.or.kr (국번없이 118)' },
            { text: '대검찰청 사이버 수사과: www.spo.go.kr (국번없이 1301)' },
            { text: '경찰청 사이버 안전국: https://ecrm.police.go.kr/ (국번없이 182)' },
          ],
        },
      ],
    },
  ],
  footer: {
    noticeDate: '2026년 4월 8일',
    effectiveDate: '2026년 4월 8일',
    previousVersion: '현재 버전이 최초 제정된 방침입니다.',
  },
}
