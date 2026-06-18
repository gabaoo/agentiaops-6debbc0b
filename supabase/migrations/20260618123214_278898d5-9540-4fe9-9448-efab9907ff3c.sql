
-- Enable RLS on realtime.messages (controls Broadcast/Presence channel access).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies we may have created (idempotent).
DROP POLICY IF EXISTS "Tenant realtime select" ON realtime.messages;
DROP POLICY IF EXISTS "Tenant realtime insert" ON realtime.messages;

-- Allow an authenticated user to READ (subscribe to) a channel only when the
-- topic encodes a conversation or instance they own. Topic format conventions:
--   conv-<conversation_id>
--   conv-list-<instance_id>
--   dashboard-<instance_id>
CREATE POLICY "Tenant realtime select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (
      realtime.topic() LIKE 'conv-%'
      AND realtime.topic() NOT LIKE 'conv-list-%'
      AND public.user_owns_conversation(
        NULLIF(substring(realtime.topic() FROM 6), '')::uuid
      )
    )
    OR (
      realtime.topic() LIKE 'conv-list-%'
      AND public.user_owns_instance(
        NULLIF(substring(realtime.topic() FROM 11), '')::uuid
      )
    )
    OR (
      realtime.topic() LIKE 'dashboard-%'
      AND public.user_owns_instance(
        NULLIF(substring(realtime.topic() FROM 11), '')::uuid
      )
    )
  );

-- Allow an authenticated user to BROADCAST on a channel they own.
CREATE POLICY "Tenant realtime insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      realtime.topic() LIKE 'conv-%'
      AND realtime.topic() NOT LIKE 'conv-list-%'
      AND public.user_owns_conversation(
        NULLIF(substring(realtime.topic() FROM 6), '')::uuid
      )
    )
    OR (
      realtime.topic() LIKE 'conv-list-%'
      AND public.user_owns_instance(
        NULLIF(substring(realtime.topic() FROM 11), '')::uuid
      )
    )
    OR (
      realtime.topic() LIKE 'dashboard-%'
      AND public.user_owns_instance(
        NULLIF(substring(realtime.topic() FROM 11), '')::uuid
      )
    )
  );
