# TASK-058: Production P0 통합 테스트 자동화

- 상태: 대기
- 선행 작업: `TASK-057`
- 해소 대상: `B-03`, `B-11` 계약 부분

## 목적

사람의 반복 확인에 의존하는 핵심 데이터·권한 회귀를 로컬 Supabase 기반 자동 테스트로 고정한다.
원격 DEV나 Production에서는 service role seed와 파괴적 cleanup을 실행하지 않는다.

## 범위

- 이메일·링크·코드 초대와 수락
- owner/editor/viewer/revoked 권한 전이
- 동일 브라우저 계정 전환과 IndexedDB 격리
- 템플릿 생성·수정·복사·삭제
- asset upload/download 권한과 metadata 정합성
- Web/Mobile이 같은 place ID에 동일 canonical hash와 object path를 사용하는 공통 Core 계약
- tombstone, 중복 command, 재시작·재시도·충돌 회귀
- CI에서 Core, SQL, Web E2E를 한 release SHA로 실행

세부 케이스와 우선순위는
[Production 통합 테스트 케이스](../test-plans/TASK-057-production-integration-test-cases.md)를 따른다.

## 완료 조건

- `NEW-A01`~`NEW-A13`이 구현되고 모두 PASS한다.
- 모든 P0 테스트가 실패 원인을 식별할 수 있는 assertion과 artifact를 남긴다.
- local-only 보호 장치 우회가 없고 원격 project ref를 넣으면 즉시 중단된다.
- 전체 자동 Gate 명령과 CI URL을 release 증적에 기록한다.

## 제외 범위

- 원격 migration 적용
- 실기기·7일 관측·복구·Production 출시
