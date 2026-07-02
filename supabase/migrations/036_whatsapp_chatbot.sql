-- ============================================================
-- 036_whatsapp_chatbot.sql — WhatsApp AI Chatbot Configurations
-- ============================================================

-- Create chatbot_config table
CREATE TABLE IF NOT EXISTS public.chatbot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'gemini', 'anthropic', 'grok', 'groq')),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful customer service assistant for our business.',
  business_context TEXT,
  auto_pause_duration INTEGER NOT NULL DEFAULT 60, -- In minutes, -1 = permanent, 0 = off
  response_delay INTEGER NOT NULL DEFAULT 0, -- In seconds, 0 to 10
  bot_name TEXT DEFAULT 'AI Assistant',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for workspace lookups
CREATE INDEX IF NOT EXISTS chatbot_config_workspace_id_idx ON public.chatbot_config (workspace_id);

-- Enable RLS
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage workspace chatbot config" ON public.chatbot_config;

-- Configure RLS policy using the standard public.is_workspace_member helper
CREATE POLICY "Users can manage workspace chatbot config" ON public.chatbot_config
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Apply the set_updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.chatbot_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.chatbot_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add chatbot state columns to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_status TEXT NOT NULL DEFAULT 'active' CHECK (bot_status IN ('active', 'paused'));
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_paused_until TIMESTAMPTZ;
