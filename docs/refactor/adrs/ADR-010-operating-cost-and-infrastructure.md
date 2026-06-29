# ADR-010: 운영 비용 및 인프라 구성 전략

- 상태: 후속 검토
- 결정일: 미정
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
  - `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`
  - `docs/refactor/adrs/ADR-009-notification-strategy.md`

---

## 문제 정의

Local-first + P2P 구조는 중앙 서버 부하를 줄일 수 있지만, 완전 무인프라 구조는 아니다. 실제 서비스 운영에는 다음 인프라가 필요하다.

- Supabase Auth
- Supabase backup/update storage
- Supabase Realtime 또는 Edge Functions
- signaling server
- STUN/TURN
- 웹 호스팅
- push notification 인프라
- 앱스토어 계정/도메인

따라서 목표 비용과 scaling trigger를 명확히 해야 한다.

---

## 결정해야 할 질문

초기 운영에서 어떤 인프라를 무료/저비용 managed service로 시작하고, 어떤 시점에 유료/자체 운영으로 전환할 것인가?

본 ADR은 ADR-001부터 ADR-009까지의 결정사항을 `docs/refactor/TECHNICAL-SPEC.md`에 승격한 뒤 후속 검토한다.

---

## 기본 비용 가정

초기/소규모:

- Supabase: Free tier 우선
- Signaling: 무료 또는 hobby tier
- STUN: 공개 STUN
- TURN: managed provider의 무료 제공량 또는 종량제
- Web hosting: 현재 Vercel 유지 우선
- Push: Expo Push Service + Supabase Edge Function
- App Store: Apple Developer Program, Google Play Console

스케일업:

- Supabase Pro 이상
- signaling server paid instance
- TURN paid quota
- Web hosting pro tier
- monitoring/logging 도구

---

## 비용상 유리한 이유

전통적 서버 구조:

- 모든 읽기/쓰기/실시간 협업이 서버 DB와 API를 통과한다.
- 동시접속과 문서 편집량이 서버 비용에 직접 반영된다.

Local-first 구조:

- 읽기/쓰기는 로컬에서 처리한다.
- 동시 접속자는 가능하면 P2P로 sync한다.
- Supabase는 backup, restore, registry, push metadata에 집중한다.
- 서버 비용은 사용자 조작 횟수보다 backup/update batching 정책에 더 크게 좌우된다.

---

## 비용 위험 요소

- Yjs update log를 너무 자주 Supabase에 insert하면 DB write 비용이 증가한다.
- snapshot compaction 없이 update log가 누적되면 저장소 비용이 증가한다.
- TURN relay 사용량이 많아지면 네트워크 비용이 증가한다.
- Supabase Realtime을 fallback sync로 과도하게 사용하면 비용과 quota가 증가한다.
- push notification batching이 없으면 Edge Function 호출이 증가한다.
- 웹 호스팅 이전을 TURN provider 선택과 묶으면 불필요한 마이그레이션 리스크가 생긴다.

---

## 비용 제어 정책

- Yjs update는 debounce/batch 후 업로드한다.
- 일정 크기 이상 update log는 snapshot compaction한다.
- P2P 실패 시에만 TURN relay 사용한다.
- Supabase Realtime은 critical document room에 제한적으로 사용한다.
- notification event는 dedupe/batching한다.
- image/binary data는 Yjs document에 넣지 않고 Storage reference만 저장한다.
- TURN provider와 웹 호스팅 provider는 독립적으로 결정한다.

---

## STUN/TURN Provider 기준

Local-first 전환의 P2P는 optional fast path이므로, STUN/TURN 선택은 "항상 연결되어야 하는 primary sync 인프라"가 아니라 "동시 접속 중 빠른 전파를 위한 connectivity 보조 인프라" 관점에서 비용을 산정한다.

권장 기준선:

- STUN: Cloudflare STUN을 기본값으로 사용한다. Google public STUN은 연결성 검증 단계의 보조 후보로만 둔다.
- TURN: Cloudflare Realtime TURN을 managed provider 기준선으로 채택한다.
- TURN 비교 후보: Metered/OpenRelay는 Cloudflare 적용 전후의 연결성 비교 또는 장애 대응 참고 후보로만 둔다.
- TURN 대체 후보: Twilio 또는 Xirsys는 비용보다 안정성, 지원, 계약, 기업용 신뢰성이 중요해지는 시점에 별도 검토한다.

운영 방식:

- TURN credential은 클라이언트에 고정 저장하지 않는다.
- Supabase Edge Function 또는 별도 server-side endpoint가 짧은 TTL의 ICE server config를 발급한다.
- TURN relay bytes, relay 연결 비율, P2P 실패율, 연결 수립 p95 latency를 비용 관측 지표로 둔다.
- TURN 무료 제공량의 70%를 넘으면 paid quota, provider fallback, P2P 정책 조정을 검토한다.

---

## Cloudflare 웹 호스팅 이전 검토

Cloudflare Realtime TURN 채택 여부와 웹 호스팅 이전 여부는 분리해서 결정한다. Cloudflare TURN을 사용하더라도 Vercel 웹 호스팅을 즉시 이전할 필요는 없다.

현재 판단:

- 단기: Vercel 웹 호스팅을 유지하고 Cloudflare TURN만 독립 도입할 수 있다.
- 중기: Local-first 전환으로 서버 의존도가 줄어든 뒤 Cloudflare Pages/Workers 이전을 별도 PoC로 검토한다.
- 이전 판단은 비용 절감뿐 아니라 Next.js 호환성, API Route, auth middleware, Sentry/analytics, image handling 차이를 함께 검증해야 한다.

Cloudflare 이전이 유리해지는 조건:

- Vercel seat 비용 또는 사용량 과금이 지속적으로 증가한다.
- 웹 앱이 정적 UI와 client-side local-first 동작 중심으로 단순해진다.
- server-side Next.js 기능 의존도가 줄고, Edge Function 성격의 API만 남는다.
- Cloudflare Pages/Workers PoC에서 `proxy.ts`, App Router API Route, Supabase Auth callback이 안정적으로 동작한다.

Vercel 유지가 유리한 조건:

- 현재 월 비용이 낮고 운영 문제가 없다.
- Next.js 16 기능, middleware/proxy, image optimization, API Route 호환성 리스크가 크다.
- Cloudflare 이전으로 절감되는 비용보다 마이그레이션 및 검증 비용이 크다.

결론적으로 웹 호스팅 이전은 Local-first refactor의 필수 조건이 아니다. `Cloudflare TURN 도입`과 `Cloudflare 웹 호스팅 이전`은 별도 ADR 또는 후속 비용 검토 항목으로 관리한다.

---

## Scaling Trigger

다음 기준 중 하나를 만족하면 인프라 업그레이드를 검토한다.

- Supabase DB 저장소 70% 초과
- monthly active users가 free tier 한계의 70% 초과
- Edge Function invocation이 free quota의 70% 초과
- TURN relay 사용량이 무료 제공량의 70% 초과
- signaling server 동시 연결이 hobby tier 한계의 70% 초과
- backup restore p95 latency가 제품 기준 초과
- Vercel 사용량/seat 비용이 Cloudflare 이전 PoC 비용보다 커짐

---

## 현재 기준선

ADR-001부터 ADR-009까지의 현재 결정 기준선은 다음과 같다.

- Supabase는 Auth, encrypted backup, permission registry, invitation registry, index, notification metadata를 담당한다.
- P2P는 optional fast path이며 기본 sync는 Supabase backup pull/push다.
- 모바일 WebRTC는 dev client/EAS Build 기반 native provider로 검증한다.
- 백업 blob은 암호화하고 Server-wrapped key model을 사용한다.
- Trip document는 초기에는 단일 Yjs document다.
- index는 hybrid index를 사용한다.
- guest local-first 사용 후 로그인 승격을 허용한다.
- 알림은 로컬 알림과 서버 metadata push를 분리한다.

이 기준선에서 초기에는 managed/free tier 중심으로 시작한다.

- Supabase Free/Pro 후보
- Vercel 또는 현재 웹 배포 환경
- Expo Push Service
- Cloudflare STUN
- Cloudflare Realtime TURN
- Metered/OpenRelay는 제한적 비교 후보
- Twilio/Xirsys는 fallback 또는 enterprise-grade 대체 후보
- signaling은 P2P optional phase에서만 검토
- 기본 sync 비용은 Supabase backup/update write volume으로 산정
- 웹 호스팅은 단기적으로 Vercel 유지, Cloudflare Pages/Workers 이전은 별도 후속 검토

자체 signaling server 운영은 사용자 규모와 P2P 품질 요구가 검증된 뒤 별도 결정한다.

---

## 승인 기준

- 1인 개발자가 운영 가능한 비용/복잡도여야 한다.
- P2P 실패 fallback 비용을 예측할 수 있어야 한다.
- update batching/compaction 정책이 있어야 한다.
- 비용 관측 지표가 정의되어야 한다.

---

## 후속 작업

- Supabase backup write volume 추정
- TURN relay 사용량 PoC
- Cloudflare Realtime TURN 기반 ICE server config 발급 PoC
- Cloudflare STUN/TURN Web/RN 연결성 검증
- Metered/OpenRelay provider 비교는 필요 시 제한적으로 수행
- signaling server 후보 비교
- Cloudflare Pages/Workers 이전 가능성 및 비용 PoC
- monthly cost dashboard 항목 정의
- update batching 정책과 비용 영향 테스트
