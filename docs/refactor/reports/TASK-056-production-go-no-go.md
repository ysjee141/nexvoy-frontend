# TASK-056 Production Go/No-Go

- 평가일: 2026-07-23
- 코드 게이트: PASS
- DEV 배포 게이트: NO-GO
- Production 배포 게이트: NO-GO
- Legacy 물리 삭제: NO-GO

## 통과한 근거

- Entity version을 모든 일반 upsert/delete command에 부여하고, stale revision은 다른 entity일
  때만 재기준화한다. 동일 entity는 `entity_version` 충돌로 중단한다.
- Web/Mobile에서 충돌 원인과 대기 건수를 보존하며 `서버 최신 내용 사용` 또는
  `이 기기 변경 다시 적용`을 명시적으로 선택한다.
- SQL에서 여행/템플릿의 다른 entity 수렴, 동일 entity 충돌, per-user set, 보수적 whole-set,
  duplicate exactly-once를 검증했다.
- Web 동시 편집 E2E에서 두 offline outbox를 동시에 reconnect해 실제 충돌을 만들고 canonical
  선택 후 양쪽 화면이 수렴했다.
- Web IndexedDB와 Mobile SQLite에서 계정 격리, atomic outbox, ack rebase, 두 충돌 해결 경로를
  검증했다.
- 관측 이벤트는 queue age, payload bytes, RPC duration, conflict/retry/reject, revision gap,
  full refresh를 기록하며 계정/resource ID와 콘텐츠를 제거한다.
- 대표 command 2 KiB, invalidation 1 KiB 예산을 UTF-8 실제 byte 기준으로 자동 검증한다.

## 남은 차단 항목

- [ ] DEV의 9개 historical migration ledger gap을 schema fingerprint 후 repair한다.
- [ ] DEV에 `20260723000002`를 정상 migration으로 적용하고 전체 SQL/E2E를 재실행한다.
- [ ] Web/Mobile, Mobile/Mobile 실기기에서 airplane mode, 강제 종료, 계정 전환, role revoke,
  asset upload/download를 검증한다.
- [ ] DEV에서 7일간 queue/conflict/reject/gap/full-refresh/egress 지표를 수집한다.
- [ ] 별도 복구 프로젝트에서 DB export와 `place-photos` Storage export를 함께 복구한다.
- [ ] Production migration history를 독립 감사하고 pre-deploy backup을 만든다.
- [ ] 최소 Mobile 지원 버전과 단계적 traffic rollout 책임자를 지정한다.

## 판정 규칙

모든 차단 항목에 실행자, 시각, project ref, release SHA, 원시 결과 링크가 기록되어야 DEV
GO로 바뀐다. DEV 7일 관찰 후 오류율 기준을 모두 만족해야 Production GO로 바뀐다. Legacy
삭제는 별도 승인 대상이며 Production GO와 자동으로 연동되지 않는다.
