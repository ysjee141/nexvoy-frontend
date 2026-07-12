# TASK-025: P2P Connection Status UI

## 목적

`TASK-021`~`TASK-024`로 P2P 연결과 실제 데이터 동기화가 동작해도, 사용자가 이를 인지하거나 실패
시 무슨 일이 일어나는지 알 방법이 없다. `TASK-020`이 mobile restore에 대해 만든
"raw error 없이 generic copy" 패턴을 그대로 따라, P2P 연결 상태에 대한 최소한의 사용자 UX를
추가한다.

## 범위

- trip 화면 내 연결 상태 표시(작은 인디케이터/배지): 연결 시도 중 / 연결됨(빠른 동기화 중) / 사용
  불가(기존 방식으로 동기화 중) 세 가지 정도의 상태
- 실패 시 raw WebRTC/시그널링 에러 노출 금지, `TASK-020`과 동일한 원칙으로 generic copy만 노출
- P2P가 사용자에게 새로운 개념(피어, 시그널링, ICE 등)을 노출하지 않도록 카피 작성(Clear Departure
  톤 유지)
- P2P on/off를 사용자가 직접 끌 수 있는 설정이 필요한지 여부 결정(기본값: 항상 자동 시도, 실패 시
  조용히 backup 경로로 폴백 — 별도 토글 없이 시작하고, 필요성이 확인되면 후속으로 추가)

제외:

- 상세 진단 화면(연결 타입 direct/relay, RTT 등 개발자용 정보) — 필요하면 별도 관리자/디버그 화면으로
  분리하고 이 task 범위에 넣지 않는다.

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-024-p2p-data-channel-yjs-update-exchange.md` (사용자에게 보여줄 실질적인 의미가 생기는
  시점 — 연결 증명만으로는 사용자에게 보여줄 이유가 약하다)
- Clear Departure 디자인 시스템(`docs/develop-context/design-guide.md`)

## 변경 대상

- ux-designer 산출물(와이어프레임, 상태별 카피)
- ui-developer: 인디케이터 컴포넌트(Panda CSS, 디자인 토큰)
- frontend-developer: `connectWebP2PPeer()`/Mobile 대응 함수의 연결 상태를 화면 상태(zustand 등)에
  연결하는 지점
- `docs/refactor/tasks/README.md`

## 구현 단계

1. (ux-designer) 연결 상태 3~4가지에 대한 와이어프레임과 generic copy 초안을 작성한다. 기술 용어
   노출 여부, 색상/아이콘을 Clear Departure 가이드에 맞춰 정한다.
2. (ui-developer) 인디케이터 컴포넌트를 구현한다(a11y: 색상만으로 상태를 구분하지 않도록 텍스트/아이콘
   병행).
3. (frontend-developer) trip 화면에서 `connectWebP2PPeer()`(Web)/Mobile 대응 함수의 `peerConnection`
   상태 변화, handshake 완료 여부를 컴포넌트 상태로 연결한다.
4. 실패 케이스(시그널링 거부, ICE 실패, 데이터 채널 미개방)를 모두 동일한 "사용 불가 → 기존 방식
   사용 중" 상태로 수렴시켜 raw reason을 노출하지 않는다.

## 데이터 호환성 고려사항

- 해당 없음(UI 전용 task, 데이터 모델 변경 없음).

## 검증 방법

- 실제 두 세션에서 연결 성공/실패/진행 상태 전환이 화면에 올바르게 표시되는지 확인한다.
- 스크린리더로 상태 변화가 인지 가능한지 확인한다(a11y).
- 반응형 레이아웃(모바일 웹/네이티브 뷰포트)에서 인디케이터가 깨지지 않는지 확인한다.
- reviewer의 디자인 시스템 감사 통과

## 롤백 방법

- 인디케이터 컴포넌트와 연결 지점을 제거해도 P2P 로직 자체(TASK-021~024)에는 영향이 없다 — UI는
  순수하게 상태를 구독만 한다.

## 완료 조건

- 사용자가 raw WebRTC 개념 없이 "지금 빠르게 동기화되고 있는지, 아니면 기존 방식으로 동기화되고
  있는지"를 이해할 수 있다.
- 모든 실패 케이스가 raw error 없이 generic copy로 수렴한다.
