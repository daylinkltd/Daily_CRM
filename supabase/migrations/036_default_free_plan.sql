-- Update default workspace plan to 'free' (Free Trial)
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'free';

ALTER TABLE public.workspaces ALTER COLUMN plan_limits SET DEFAULT '{
  "max_members": 2,
  "max_workspaces": 1,
  "max_storage_gb": 5,
  "channels": ["whatsapp", "instagram", "messenger", "email"],
  "max_automations": 3,
  "max_messages": 500
}'::jsonb;
