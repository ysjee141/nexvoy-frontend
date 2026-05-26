# Supabase RLS 정책 패턴

## 기본 원칙
- 모든 신규 테이블에 RLS 활성화 (예외 없음)
- 정책은 `auth.uid()` 기반으로 작성
- INSERT/UPDATE에는 반드시 `with check` 절 포함

## 패턴 1: Owner Only (개인 데이터)

소유자 본인만 CRUD 가능.

```sql
alter table public.{table} enable row level security;

create policy "{table}_owner_all"
  on public.{table}
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**적용 대상:** 개인 노트, 개인 설정, 본인만 보는 데이터

## 패턴 2: Owner + Shared Members (공유 데이터)

소유자는 CRUD, 멤버는 read.

```sql
alter table public.{table} enable row level security;

-- Owner
create policy "{table}_owner_all"
  on public.{table}
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared Read
create policy "{table}_shared_read"
  on public.{table}
  for select
  using (
    auth.uid() in (
      select member_id from trip_members
      where trip_id = {table}.trip_id
    )
  );
```

**중요:** Shared Policy를 Owner Policy에 OR 조건으로 합치지 말 것. 분리해야 의도가 명확하고 디버깅이 쉽다.

**적용 대상:** Trip, Plan, Checklist (공유 가능 도메인)

## 패턴 3: 멤버 자가 등록

본인을 멤버로 INSERT 가능, UPDATE/DELETE는 trip owner만.

```sql
create policy "trip_members_self_insert"
  on public.trip_members
  for insert
  with check (auth.uid() = member_id);

create policy "trip_members_owner_modify"
  on public.trip_members
  for update
  using (
    auth.uid() in (
      select user_id from trips where id = trip_members.trip_id
    )
  );

create policy "trip_members_owner_delete"
  on public.trip_members
  for delete
  using (
    auth.uid() in (
      select user_id from trips where id = trip_members.trip_id
    )
  );
```

## 패턴 4: Public Read + Owner Write (템플릿)

모두가 read, 작성자만 write.

```sql
alter table public.templates enable row level security;

create policy "templates_public_read"
  on public.templates
  for select
  using (is_public = true);

create policy "templates_owner_read"
  on public.templates
  for select
  using (auth.uid() = user_id);

create policy "templates_owner_write"
  on public.templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 빈틈 점검

새 테이블 작성 후 다음을 확인:

- [ ] `alter table ... enable row level security` 실행됨
- [ ] SELECT/INSERT/UPDATE/DELETE 모두 정책 커버
- [ ] `auth.uid()` 직접 사용 (클라이언트가 보낸 user_id 비교 금지)
- [ ] Service Role 키 우회 가능성 -- 클라이언트 코드에서 Service Role 사용 금지
- [ ] Storage 버킷 정책: `trips/[user_id]/[trip_id]/[filename]` 형식의 path RLS 적용

## Storage 정책 예시

```sql
-- trips 버킷: 본인 폴더만 read/write
create policy "trips_owner_read"
  on storage.objects
  for select
  using (
    bucket_id = 'trips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "trips_owner_write"
  on storage.objects
  for insert
  with check (
    bucket_id = 'trips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```
