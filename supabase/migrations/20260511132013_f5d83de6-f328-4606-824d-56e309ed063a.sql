
-- Enums
CREATE TYPE public.conversation_status AS ENUM ('open', 'in_progress', 'closed', 'waiting_human');
CREATE TYPE public.message_sender AS ENUM ('user', 'ai', 'human');
CREATE TYPE public.message_type AS ENUM ('text', 'audio', 'image', 'video', 'document');
CREATE TYPE public.sentiment_type AS ENUM ('positive', 'neutral', 'negative');

-- conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT,
  phone TEXT NOT NULL,
  status public.conversation_status NOT NULL DEFAULT 'open',
  intent TEXT,
  sentiment public.sentiment_type,
  needs_human BOOLEAN NOT NULL DEFAULT false,
  fallback_count INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_phone ON public.conversations(phone);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender public.message_sender NOT NULL,
  content TEXT NOT NULL,
  message_type public.message_type NOT NULL DEFAULT 'text',
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id, created_at);

-- metrics_daily
CREATE TABLE public.metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day DATE NOT NULL UNIQUE,
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_daily_day ON public.metrics_daily(day DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_metrics_daily_updated_at
  BEFORE UPDATE ON public.metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update conversation aggregates + metrics_daily on new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message = LEFT(NEW.content, 500),
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    fallback_count = fallback_count + CASE WHEN NEW.is_fallback THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  INSERT INTO public.metrics_daily (day, total_messages, total_conversations)
  VALUES (CURRENT_DATE, 1, 0)
  ON CONFLICT (day) DO UPDATE
    SET total_messages = public.metrics_daily.total_messages + 1,
        updated_at = now();

  RETURN NEW;
END $$;

CREATE TRIGGER trg_messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

CREATE OR REPLACE FUNCTION public.handle_new_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.metrics_daily (day, total_messages, total_conversations)
  VALUES (CURRENT_DATE, 0, 1)
  ON CONFLICT (day) DO UPDATE
    SET total_conversations = public.metrics_daily.total_conversations + 1,
        updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_conversations_after_insert
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_conversation();

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update conversations" ON public.conversations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete conversations" ON public.conversations
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update messages" ON public.messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete messages" ON public.messages
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read metrics" ON public.metrics_daily
  FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
