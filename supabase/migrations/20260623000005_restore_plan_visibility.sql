-- Restore trip plan visibility after checklist/RLS rollout.
-- Existing trip detail screens read plans and plan_urls directly, so these
-- policies must stay aligned with trips/checklists access rules.

-- Plans ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage plans for their trips" ON public.plans;
DROP POLICY IF EXISTS "Users with edit permission can manage plans" ON public.plans;
DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
DROP POLICY IF EXISTS "Public select plans if shared" ON public.plans;
DROP POLICY IF EXISTS "Select plans if shared or related" ON public.plans;
DROP POLICY IF EXISTS "Manage plans if editor or owner" ON public.plans;

CREATE POLICY "Select plans if shared or related"
  ON public.plans
  FOR SELECT
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
    OR public.check_is_public_trip(trip_id)
  );

CREATE POLICY "Manage plans if editor or owner"
  ON public.plans
  FOR ALL
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  )
  WITH CHECK (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  );

-- Plan URLs ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage plan urls for their trips" ON public.plan_urls;
DROP POLICY IF EXISTS "Allow members and public to view plan urls" ON public.plan_urls;
DROP POLICY IF EXISTS "Allow editors to manage plan urls" ON public.plan_urls;

CREATE POLICY "Allow members and public to view plan urls"
  ON public.plan_urls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id
        AND (
          public.check_is_trip_owner(p.trip_id, auth.uid())
          OR public.check_is_trip_member(p.trip_id, auth.uid())
          OR public.check_is_public_trip(p.trip_id)
        )
    )
  );

CREATE POLICY "Allow editors to manage plan urls"
  ON public.plan_urls
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id
        AND (
          public.check_is_trip_owner(p.trip_id, auth.uid())
          OR public.check_is_trip_editor(p.trip_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id
        AND (
          public.check_is_trip_owner(p.trip_id, auth.uid())
          OR public.check_is_trip_editor(p.trip_id, auth.uid())
        )
    )
  );
