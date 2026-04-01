# 비공개 테스트 버그 제보 시스템 가이드

본 문서는 서비스의 비공개 테스트(Beta) 기간 동안 외부 스토리지를 활용하여 버그를 수집하고 미디어(이미지/동영상)를 관리하는 방안을 정리합니다. 

## 🎯 요구 사항
1. **서버 리소스 최소화**: 서비스 내부 DB나 Storage를 사용하지 않고 외부 3rd-party 활용.
2. **미디어 지원**: 텍스트 설명뿐만 아니라 스크린샷 및 화면 녹화 파일 전송 가능.
3. **대상 한정**: 특정 테스터(ID 기반)에게만 제보 기능을 노출.
4. **실시간 알림**: 개발자가 제보 내용을 즉시 확인할 수 있는 채널 확보.

---

## 🛠️ 제안 방식 비교

### 1. Discord Webhook (가장 강력 추천)
디스코드의 웹훅 API를 활용하여 텍스트와 파일을 전송하는 방식입니다.

- **장점**: 
    - **무제한 미디어 저장**: 디스코드 서버가 호스팅 역할을 하므로 서버 용량 걱정이 없음.
    - **즉각성**: 디스코드 채널로 푸시 알림이 오며 이미지/영상을 즉시 미리보기 가능.
    - **간편함**: 별도의 SDK 설치 없이 표준 `fetch` API만으로 구현 가능.

- **구현 가이드**:
  ```typescript
  // multipart/form-data 전송 예시
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('payload_json', JSON.stringify({
    content: `[버그 제보] ${user.email}`,
    embeds: [{
      title: "제보 내용",
      description: textContent,
      fields: [
        { name: "Page", value: window.location.href },
        { name: "Device", value: navigator.userAgent }
      ]
    }]
  }));

  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    body: formData
  });
  ```

---

### 2. Sentry User Feedback (통합 관리형)
이미 프로젝트에 설치된 Sentry의 내장 피드백 기능을 활용합니다.

- **장점**: 
    - **통합 로그**: 제보 시점 직전의 콘솔 로그, 네트워크 요청 내역(Breadcrumbs)이 함께 전송됨.
    - **스크린샷**: Sentry 위젯에서 현재 화면을 즉시 캡처하여 첨부 가능.
- **구현 가이드**:
  ```typescript
  import * as Sentry from "@sentry/nextjs";

  const openFeedback = () => {
    // Sentry 유저 피드백 다이얼로그 호출
    Sentry.showReportDialog({
      title: "버그를 발견하셨나요?",
      subtitle: "테스터님의 소중한 제보가 더 좋은 서비스를 만듭니다.",
      labelSubmit: "제보하기",
      user: { name: user.name, email: user.email }
    });
  };
  ```

---

### 3. Tally.so / Google Forms (노코드 방식)
외부 설문 도구 링크를 제공하거나 임베드합니다.

- **장점**: 
    - **체계적 수집**: 질문 항목을 자유롭게 구성 가능.
    - **데이터 연동**: 노션(Notion) 등으로 데이터를 자동 전송하여 문서화하기 좋음.
- **제한**: 
    - 앱 외부로 이동하거나 iframe을 사용해야 하므로 UX가 다소 단절됨.

---

## 👥 테스터 식별 및 노출 로직

테스터에게만 기능을 노출하기 위해 프론트엔드 코드에 간단한 필터를 적용합니다.

```typescript
// /src/constants/testers.ts
export const BETA_TESTERS = [
  'uuid-user-a', // 홍길동 (담당자별 주석 권장)
  'uuid-user-b'
];

// UI 컴포넌트 내 사용
const BugReportButton = () => {
  const { user } = useAuth();
  
  // 테스터가 아니면 렌더링하지 않음
  if (!user || !BETA_TESTERS.includes(user.id)) return null;

  return (
    <button onClick={openModal}>
      🐞 버그 제보하기
    </button>
  );
};
```

## 🚀 향후 로드맵
1. **단기**: Discord Webhook을 통한 텍스트+이미지 제보 기능 구현.
2. **중기**: Sentry와 연동하여 에러 로그가 포함된 리포트 시스템 구축.
3. **장기**: 정식 런칭 시 고객센터(Channel.io 등) 솔루션 도입 검토.
