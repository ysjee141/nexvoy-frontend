-- Emergency RLS repair for trip/checklist visibility after checklist alignment.
-- Keep trip listing independent and restore explicit owner/member access.

CREATE TABLE IF NOT EXISTS public.checklist_item_assignees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.checklist_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

-- Trips ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Access trips by owner, member, or public share" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;

CREATE POLICY "Access trips by owner, member, or public share"
  ON public.trips
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = public.trips.id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_shares ts
      WHERE ts.trip_id = public.trips.id
        AND ts.share_type = 'public'
    )
  );

-- Checklists -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Select checklists if shared or related" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists if editor or owner" ON public.checklists;

CREATE POLICY "Select checklists if shared or related"
  ON public.checklists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = public.checklists.trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
          )
          OR EXISTS (
            SELECT 1
            FROM public.trip_shares ts
            WHERE ts.trip_id = t.id
              AND ts.share_type = 'public'
          )
        )
    )
  );

CREATE POLICY "Manage checklists if editor or owner"
  ON public.checklists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = public.checklists.trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
              AND tm.role IN ('owner', 'editor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = public.checklists.trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
              AND tm.role IN ('owner', 'editor')
          )
        )
    )
  );

-- Checklist items ------------------------------------------------------------
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
      JOIN public.trips t ON t.id = c.trip_id
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
          )
          OR EXISTS (
            SELECT 1
            FROM public.trip_shares ts
            WHERE ts.trip_id = t.id
              AND ts.share_type = 'public'
          )
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
      JOIN public.trips t ON t.id = c.trip_id
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
              AND tm.role IN ('owner', 'editor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      JOIN public.trips t ON t.id = c.trip_id
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_members tm
            WHERE tm.trip_id = t.id
              AND tm.user_id = auth.uid()
              AND tm.status = 'accepted'
              AND tm.role IN ('owner', 'editor')
          )
        )
    )
  );
