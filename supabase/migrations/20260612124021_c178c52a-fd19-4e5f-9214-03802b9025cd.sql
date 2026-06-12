
-- 1. Wipe existing data
TRUNCATE public.messages, public.conversations, public.metrics_daily RESTART IDENTITY CASCADE;

-- 2. Create instances table
CREATE TABLE public.instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  whatsapp_number text NOT NULL,
  evolution_instance_id text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, evolution_instance_id),
  UNIQUE (evolution_instance_id)
);
CREATE INDEX instances_user_id_idx ON public.instances(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instances TO authenticated;
GRANT ALL ON public.instances TO service_role;

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own instances" ON public.instances
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER instances_set_updated_at
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add instance_id to conversations
ALTER TABLE public.conversations
  ADD COLUMN instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS conversations_phone_idx;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_phone_key;
CREATE UNIQUE INDEX conversations_instance_phone_idx
  ON public.conversations(instance_id, phone);
CREATE INDEX conversations_instance_last_msg_idx
  ON public.conversations(instance_id, last_message_at DESC NULLS LAST);

-- 4. Add instance_id to metrics_daily, replace UNIQUE(day)
ALTER TABLE public.metrics_daily
  ADD COLUMN instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE;

ALTER TABLE public.metrics_daily DROP CONSTRAINT IF EXISTS metrics_daily_day_key;
DROP INDEX IF EXISTS metrics_daily_day_key;
CREATE UNIQUE INDEX metrics_daily_instance_day_idx
  ON public.metrics_daily(instance_id, day);

-- 5. Helper functions (SECURITY DEFINER, no EXECUTE to anon/auth/public)
CREATE OR REPLACE FUNCTION public.user_owns_instance(_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instances
    WHERE id = _instance_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_owns_conversation(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.instances i ON i.id = c.instance_id
    WHERE c.id = _conversation_id AND i.user_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.user_owns_instance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_conversation(uuid) FROM PUBLIC, anon, authenticated;
-- Functions are called from RLS USING clauses, which run as table-owner context

-- 6. Replace RLS policies on conversations
DROP POLICY IF EXISTS "Authenticated can read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can write conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can delete conversations" ON public.conversations;

CREATE POLICY "Tenant read conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.user_owns_instance(instance_id));
CREATE POLICY "Tenant write conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_instance(instance_id));
CREATE POLICY "Tenant update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.user_owns_instance(instance_id))
  WITH CHECK (public.user_owns_instance(instance_id));
CREATE POLICY "Tenant delete conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (public.user_owns_instance(instance_id));

-- 7. Replace RLS policies on messages
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can write messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can delete messages" ON public.messages;

CREATE POLICY "Tenant read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.user_owns_conversation(conversation_id));
CREATE POLICY "Tenant write messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_conversation(conversation_id));
CREATE POLICY "Tenant update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.user_owns_conversation(conversation_id))
  WITH CHECK (public.user_owns_conversation(conversation_id));
CREATE POLICY "Tenant delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (public.user_owns_conversation(conversation_id));

-- 8. Replace RLS on metrics_daily
DROP POLICY IF EXISTS "Authenticated can read metrics" ON public.metrics_daily;

CREATE POLICY "Tenant read metrics" ON public.metrics_daily
  FOR SELECT TO authenticated
  USING (public.user_owns_instance(instance_id));

-- 9. Update triggers to be instance-aware
CREATE OR REPLACE FUNCTION public.handle_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.metrics_daily (instance_id, day, total_messages, total_conversations)
  VALUES (NEW.instance_id, CURRENT_DATE, 0, 1)
  ON CONFLICT (instance_id, day) DO UPDATE
    SET total_conversations = public.metrics_daily.total_conversations + 1,
        updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _instance_id uuid;
BEGIN
  UPDATE public.conversations
  SET
    last_message = LEFT(NEW.content, 500),
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    fallback_count = fallback_count + CASE WHEN NEW.is_fallback THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE id = NEW.conversation_id
  RETURNING instance_id INTO _instance_id;

  INSERT INTO public.metrics_daily (instance_id, day, total_messages, total_conversations)
  VALUES (_instance_id, CURRENT_DATE, 1, 0)
  ON CONFLICT (instance_id, day) DO UPDATE
    SET total_messages = public.metrics_daily.total_messages + 1,
        updated_at = now();

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_message() FROM PUBLIC, anon, authenticated;

-- Ensure triggers exist (recreate to be safe)
DROP TRIGGER IF EXISTS on_new_conversation ON public.conversations;
CREATE TRIGGER on_new_conversation
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_conversation();

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();
