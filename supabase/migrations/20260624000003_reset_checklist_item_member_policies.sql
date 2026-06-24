-- Reset checklist item policies explicitly for owner/member collaboration.
-- Supabase insert().select('*') requires both INSERT and SELECT policies, so
-- this migration recreates the full checklist item policy set together.

DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items if shared or related" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Insert checklist items by checklist helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Update checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Delete checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items by trip access" ON public.checklist_items;
DROP POLICY IF EXISTS "Insert checklist items by trip member" ON public.checklist_items;
DROP POLICY IF EXISTS "Update checklist items by trip member" ON public.checklist_items;
DROP POLICY IF EXISTS "Delete checklist items by trip member" ON public.checklist_items;

CREATE POLICY "Select checklist items by trip access"
  ON public.checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
          OR public.check_is_public_trip(c.trip_id)
        )
    )
    AND (
      COALESCE(is_private, false) = false
      OR assigned_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.checklist_item_assignees a
        WHERE a.item_id = public.checklist_items.id
          AND a.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Insert checklist items by trip member"
  ON public.checklist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
        )
    )
  );

CREATE POLICY "Update checklist items by trip member"
  ON public.checklist_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
        )
    )
  );

CREATE POLICY "Delete checklist items by trip member"
  ON public.checklist_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
        )
    )
  );
