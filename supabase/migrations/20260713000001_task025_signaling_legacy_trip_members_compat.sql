-- TASK-025 follow-up: allow P2P signaling during the legacy trip_members ->
-- document_members transition.
--
-- Checklist P2P currently derives its peer set from the legacy trip snapshot
-- (trips.user_id + trip_members), while the TASK-021 Realtime Authorization
-- policy only checked document_members. That made accepted legacy collaborators
-- fail private channel authorization before WebRTC could request ICE servers.

DROP POLICY IF EXISTS "accepted document members can receive signaling broadcast"
ON realtime.messages;

DROP POLICY IF EXISTS "accepted non-viewer document members can send signaling broadcast"
ON realtime.messages;

CREATE POLICY "accepted document members can receive signaling broadcast"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.document_members dm
    WHERE dm.user_id = (SELECT auth.uid())
      AND dm.status = 'accepted'
      AND realtime.topic() = 'signaling:' || public.document_registry_hash(dm.document_id::text)
  )
  OR EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE realtime.topic() = 'signaling:' || public.document_registry_hash(t.id::text)
      AND (
        public.check_is_trip_owner(t.id, (SELECT auth.uid()))
        OR public.check_is_trip_member(t.id, (SELECT auth.uid()))
      )
  )
);

CREATE POLICY "accepted non-viewer document members can send signaling broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.document_members dm
    WHERE dm.user_id = (SELECT auth.uid())
      AND dm.status = 'accepted'
      AND dm.role IN ('owner', 'editor')
      AND realtime.topic() = 'signaling:' || public.document_registry_hash(dm.document_id::text)
  )
  OR EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE realtime.topic() = 'signaling:' || public.document_registry_hash(t.id::text)
      AND (
        public.check_is_trip_owner(t.id, (SELECT auth.uid()))
        OR public.check_is_trip_editor(t.id, (SELECT auth.uid()))
      )
  )
);
