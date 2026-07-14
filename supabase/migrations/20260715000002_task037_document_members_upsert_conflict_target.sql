-- TASK-037 follow-up: Supabase/PostgREST upsert with
-- on_conflict=document_id,user_id requires a non-partial unique/exclusion
-- target. The original document_members index is partial
-- (WHERE user_id IS NOT NULL), so `.upsert(..., { onConflict:
-- 'document_id,user_id' })` fails with 42P10 in production.
--
-- PostgreSQL unique indexes allow multiple NULL values, so a full unique index
-- still permits invited-email rows with user_id NULL while making authenticated
-- member upserts work.

WITH ranked_members AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY document_id, user_id
      ORDER BY
        CASE status
          WHEN 'accepted' THEN 0
          WHEN 'pending' THEN 1
          ELSE 2
        END,
        CASE role
          WHEN 'owner' THEN 0
          WHEN 'editor' THEN 1
          ELSE 2
        END,
        updated_at DESC,
        created_at DESC,
        id DESC
    ) AS keep_rank
  FROM public.document_members
  WHERE user_id IS NOT NULL
)
DELETE FROM public.document_members dm
USING ranked_members ranked
WHERE dm.id = ranked.id
  AND ranked.keep_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS document_members_document_id_user_id_full_key
  ON public.document_members(document_id, user_id);
