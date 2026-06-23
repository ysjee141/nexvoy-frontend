-- Break recursive RLS between checklist_items, checklist_item_assignees,
-- and checklist_item_user_checks. Policy predicates must not query tables
-- whose policies query back into checklist_items.

CREATE OR REPLACE FUNCTION public.check_can_view_checklist(_checklist_id uuid, _user_id uuid)
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
        OR public.check_is_trip_member(c.trip_id, _user_id)
        OR public.check_is_public_trip(c.trip_id)
      )
  );
$$;

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
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.check_can_view_checklist_item(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_items ci
    WHERE ci.id = _item_id
      AND public.check_can_view_checklist(ci.checklist_id, _user_id)
      AND (
        COALESCE(ci.is_private, false) = false
        OR ci.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.checklist_item_assignees a
          WHERE a.item_id = ci.id
            AND a.user_id = _user_id
        )
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

GRANT EXECUTE ON FUNCTION public.check_can_view_checklist(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_manage_checklist(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_view_checklist_item(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_manage_checklist_item(uuid, uuid) TO authenticated;

-- checklist_items ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items if shared or related" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Insert checklist items by checklist helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Update checklist items by helper" ON public.checklist_items;
DROP POLICY IF EXISTS "Delete checklist items by helper" ON public.checklist_items;

CREATE POLICY "Select checklist items by helper"
  ON public.checklist_items
  FOR SELECT
  USING (public.check_can_view_checklist_item(id, auth.uid()));

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

-- checklist_item_assignees ---------------------------------------------------
DROP POLICY IF EXISTS "Users can view assignees for accessible checklist items" ON public.checklist_item_assignees;
DROP POLICY IF EXISTS "Editors can manage assignees for checklist items" ON public.checklist_item_assignees;
DROP POLICY IF EXISTS "Select checklist item assignees by helper" ON public.checklist_item_assignees;
DROP POLICY IF EXISTS "Manage checklist item assignees by helper" ON public.checklist_item_assignees;

CREATE POLICY "Select checklist item assignees by helper"
  ON public.checklist_item_assignees
  FOR SELECT
  USING (public.check_can_view_checklist_item(item_id, auth.uid()));

CREATE POLICY "Manage checklist item assignees by helper"
  ON public.checklist_item_assignees
  FOR ALL
  USING (public.check_can_manage_checklist_item(item_id, auth.uid()))
  WITH CHECK (public.check_can_manage_checklist_item(item_id, auth.uid()));

-- checklist_item_user_checks -------------------------------------------------
DROP POLICY IF EXISTS "Users can view user checks for accessible trips" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can manage their own checks" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can view user checks for accessible checklist items" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can manage own checks for accessible checklist items" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Select checklist item user checks by helper" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Manage own checklist item user checks by helper" ON public.checklist_item_user_checks;

CREATE POLICY "Select checklist item user checks by helper"
  ON public.checklist_item_user_checks
  FOR SELECT
  USING (public.check_can_view_checklist_item(item_id, auth.uid()));

CREATE POLICY "Manage own checklist item user checks by helper"
  ON public.checklist_item_user_checks
  FOR ALL
  USING (
    user_id = auth.uid()
    AND public.check_can_view_checklist_item(item_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.check_can_view_checklist_item(item_id, auth.uid())
  );
