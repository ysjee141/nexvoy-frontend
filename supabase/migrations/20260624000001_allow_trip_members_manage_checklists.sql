-- Allow accepted trip members to collaborate on trip checklists.
-- Checklist UI supports companion assignment/progress, so item creation and
-- assignee sync should follow trip membership instead of editor-only access.

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

GRANT EXECUTE ON FUNCTION public.check_can_manage_checklist(uuid, uuid) TO authenticated;
