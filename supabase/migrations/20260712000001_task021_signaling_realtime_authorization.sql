-- TASK-021: Realtime Authorization RLS for the P2P signaling channel (ADR-012).
-- Signaling messages (SDP offer/answer, ICE candidate) are broadcast over a
-- private Supabase Realtime channel per document. The channel topic is a
-- deterministic hash of the document id, but the topic string itself is not
-- the access boundary — these policies are. Accepted members can receive
-- signaling broadcasts; only accepted non-viewer members can send them,
-- matching packages/core/src/sync/signalingPermissions.ts's canWriteSignalingUpdates.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

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
);
