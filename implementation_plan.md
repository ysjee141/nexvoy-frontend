# TASK-030 Implementation Plan

## Goal

Create the shared document-primary repository layer that Web/Mobile screen cutover tasks can use without knowing
Supabase rows, Yjs internals, P2P, or backup queue implementation details.

## Non-goals

- No Web/Mobile screen migration.
- No DB schema migration.
- No production backup queue implementation.
- No P2P peer discovery changes.

## Planned Changes

1. Add `TemplateDocumentV1` and template document factory.
2. Add document mutation writer contracts:
   - `DocumentMutationResult`
   - `DocumentMutationPublisher`
   - `LocalDocumentStore`
   - changed entity metadata
3. Add pure trip/template document writers that return encoded Yjs updates.
4. Expand repository contracts for:
   - trip
   - plan
   - checklist
   - template
   - member
5. Add core tests for:
   - plan mutation
   - checklist mutation
   - member revoke
   - template document mutation
   - template apply into trip checklist
6. Update exports and refactor task docs.

## SQL / Query Files

No SQL or Supabase migration file is planned for TASK-030. If this changes during implementation, the query file will
be called out explicitly in `walkthrough.md` and the final report.
