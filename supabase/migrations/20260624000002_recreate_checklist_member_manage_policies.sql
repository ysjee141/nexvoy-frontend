-- Recreate checklist RLS policies so accepted trip members can collaborate.
-- Some environments may still have older owner/editor-only policies, so this
-- migration updates both helper functions and the policies that call them.

CREATE OR REPLACE FUNCTION public.check_can_manage_checklist(_checklist_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklists c
    WHERE c.id = _checklist_id
      AND (
        public.check_is_trip_owner(c.trip_id, _user_id)
        OR public.check_is_trip_editor(c.trip_id, _user_id)
        OR public.check_is_trip_member(c.trip_id, _user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.check_can_manage_checklist_item(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_items ci
    WHERE ci.id = _item_id
      AND public.check_can_manage_checklist(ci.checklist_id, _user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_can_manage_checklist(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_manage_checklist_item(uuid, uuid) TO authenticated;

-- Checklists -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklists for their trips" ON public.checklists;
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists if editor or owner" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists by member helper" ON public.checklists;

CREATE POLICY "Manage checklists by member helper"
  ON public.checklists
  FOR ALL
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
  )
  WITH CHECK (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
  );

-- Checklist items ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;
DROP POLICY IF EXISTS "Insert checklist items by checklist helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Update checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Delete checklist items by helper" ON public.checklist_items;

CREATE POLICY "Insert checklist items by checklist helper"
  ON public.checklist_items
  FOR INSERT
  WITH CHECK (public.check_can_manage_checklist(checklist_id, auth.uid()));

CREATE POLICY "Update checklist items by helper"
  ON public.checklist_items
  FOR UPDATE
  USING (public.check_can_manage_checklist_item(id, auth.uid()))
  WITH CHECK (public.check_can_manage_checklist(checklist_id, auth.uid()));

CREATE POLICY "Delete checklist items by helper"
  ON public.checklist_items
  FOR DELETE
  USING (public.check_can_manage_checklist_item(id, auth.uid()));

-- Checklist item assignees ---------------------------------------------------
DROP POLICY IF EXISTS "Editors can manage assignees for checklist items" ON public.checklist_item_assignees;
DROP POLICY IF EXISTS "Manage checklist item assignees by helper" ON public.checklist_item_assignees;

CREATE POLICY "Manage checklist item assignees by helper"
  ON public.checklist_item_assignees
  FOR ALL
  USING (public.check_can_manage_checklist_item(item_id, auth.uid()))
  WITH CHECK (public.check_can_manage_checklist_item(item_id, auth.uid()));
