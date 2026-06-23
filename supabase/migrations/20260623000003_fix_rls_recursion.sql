-- Fix RLS recursion introduced by direct table lookups inside trip policies.
-- Access checks must go through SECURITY DEFINER helpers so policy evaluation
-- does not recursively evaluate trips/trip_members policies.

CREATE OR REPLACE FUNCTION public.check_is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = _trip_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _trip_id
      AND user_id = _user_id
      AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_trip_editor(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _trip_id
      AND user_id = _user_id
      AND status = 'accepted'
      AND role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_public_trip(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_shares
    WHERE trip_id = _trip_id
      AND share_type = 'public'
  );
$$;

-- Trips ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Access trips by owner, member, or public share" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
DROP POLICY IF EXISTS "Users can view own trips." ON public.trips;

CREATE POLICY "Access trips by owner, member, or public share"
  ON public.trips
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.check_is_trip_member(id, auth.uid())
    OR public.check_is_public_trip(id)
  );

-- Checklists -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklists for their trips" ON public.checklists;
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Select checklists if shared or related" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists if editor or owner" ON public.checklists;

CREATE POLICY "Select checklists if shared or related"
  ON public.checklists
  FOR SELECT
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
    OR public.check_is_public_trip(trip_id)
  );

CREATE POLICY "Manage checklists if editor or owner"
  ON public.checklists
  FOR ALL
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  )
  WITH CHECK (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  );

-- Checklist items ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items if shared or related" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;

CREATE POLICY "Select checklist items if shared or related"
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

CREATE POLICY "Manage checklist items if editor or owner"
  ON public.checklist_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
        )
    )
  );
