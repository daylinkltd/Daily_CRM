-- ============================================================
-- 126 — DailyBuz Marketing Hub Core Schema
--
-- Adds multi-tenant tables for:
-- 1. `marketing_posts` (Social posts, approval workflow, scheduling, publishing)
-- 2. `marketing_blogs` (Long-form SEO blog articles, schema, statuses)
-- 3. `marketing_templates` (Categorized social & blog structured templates)
-- 4. `marketing_audit_logs` (Full chronological audit trail)
-- 5. `marketing_campaigns` (Multi-channel campaign tracking)
-- 6. `marketing_content_ideas` (Brainstormed concepts & backlog)
-- 7. `marketing_settings` (Workspace AI brand voice, approvals, defaults)
-- 8. `marketing_generations` (Traceable generation logs with structured intent)
-- 9. `marketing_media` (Media assets with source, dimensions, and platform specs)
--
-- All tables are strictly scoped to `workspace_id` with RLS.
-- ============================================================

-- 1. Marketing Campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT,
  description       TEXT,
  objective         TEXT,
  target_audience   TEXT,
  cta               TEXT,
  start_date        DATE,
  end_date          DATE,
  budget            NUMERIC(12, 2) DEFAULT 0,
  spent             NUMERIC(12, 2) DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  platforms         TEXT[] DEFAULT ARRAY[]::TEXT[],
  metrics           JSONB DEFAULT '{}'::jsonb,
  owner_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_workspace
  ON public.marketing_campaigns (workspace_id);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_campaigns_select ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_select ON public.marketing_campaigns
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_campaigns_modify ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_modify ON public.marketing_campaigns
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER set_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Marketing Posts (Social Media & Promotional Content)
CREATE TABLE IF NOT EXISTS public.marketing_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  content_type          TEXT NOT NULL DEFAULT 'post'
                        CHECK (content_type IN ('post', 'reel', 'story', 'video', 'carousel', 'short', 'article', 'promo', 'announcement', 'educational', 'event')),
  channels              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  default_caption       TEXT NOT NULL DEFAULT '',
  short_caption         TEXT,
  cta                   TEXT,
  hashtags              TEXT[] DEFAULT ARRAY[]::TEXT[],
  keywords              TEXT[] DEFAULT ARRAY[]::TEXT[],
  media_url             TEXT,
  media_urls            TEXT[] DEFAULT ARRAY[]::TEXT[],
  media_type            TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'none')),
  media_source          TEXT DEFAULT 'UPLOADED' CHECK (media_source IN ('UPLOADED', 'AI_GENERATED', 'STOCK')),
  alt_text              TEXT,
  first_comment         TEXT,
  trending_angle        TEXT,
  creative_suggestion   TEXT,
  target_audience       TEXT,
  tone                  TEXT,
  platform_overrides    JSONB DEFAULT '{}'::jsonb,
  external_post_ids     JSONB DEFAULT '{}'::jsonb,
  campaign_id           UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  
  -- Workflow & Status Lifecycle
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft',
                          'generating',
                          'ready_for_review',
                          'ai_generated',
                          'pending_approval',
                          'changes_requested',
                          'approved',
                          'scheduled',
                          'publishing',
                          'published',
                          'failed',
                          'rejected'
                        )),
  
  -- Scheduling & Dispatch Details
  scheduled_at          TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  timezone              TEXT DEFAULT 'Asia/Kolkata',
  
  -- Governance & Ownership
  creator_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name          TEXT,
  approver_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_name         TEXT,
  rejection_reason      TEXT,
  approval_notes        TEXT,
  failure_reason        TEXT,
  
  -- Performance Metrics
  analytics             JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0, "reach": 0, "engagementRate": 0, "clicks": 0}'::jsonb,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_workspace
  ON public.marketing_posts (workspace_id);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_status
  ON public.marketing_posts (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_schedule
  ON public.marketing_posts (workspace_id, scheduled_at);

ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_posts_select ON public.marketing_posts;
CREATE POLICY marketing_posts_select ON public.marketing_posts
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_posts_modify ON public.marketing_posts;
CREATE POLICY marketing_posts_modify ON public.marketing_posts
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_marketing_posts_updated_at ON public.marketing_posts;
CREATE TRIGGER set_marketing_posts_updated_at
  BEFORE UPDATE ON public.marketing_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Marketing Blogs (Long-form SEO Articles)
CREATE TABLE IF NOT EXISTS public.marketing_blogs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  content               TEXT NOT NULL DEFAULT '',
  excerpt               TEXT,
  summary               TEXT,
  featured_image        TEXT,
  category              TEXT NOT NULL DEFAULT 'General',
  tags                  TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- SEO Metadata & Scoring
  seo_title             TEXT,
  seo_description       TEXT,
  primary_keyword       TEXT,
  secondary_keywords    TEXT[] DEFAULT ARRAY[]::TEXT[],
  seo_score             INTEGER DEFAULT 0,
  seo_report            JSONB DEFAULT '{}'::jsonb,
  faq_schema            JSONB DEFAULT '[]'::jsonb,
  headings              JSONB DEFAULT '[]'::jsonb,
  estimated_read_time   INTEGER DEFAULT 3,
  
  -- Status Lifecycle
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'generating', 'ready_for_review', 'pending_approval', 'changes_requested', 'approved', 'scheduled', 'published', 'failed', 'rejected')),
  
  published_at          TIMESTAMPTZ,
  scheduled_at          TIMESTAMPTZ,
  campaign_id           UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  author_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name           TEXT,
  rejection_reason      TEXT,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_marketing_blogs_slug_workspace UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_marketing_blogs_workspace
  ON public.marketing_blogs (workspace_id);

CREATE INDEX IF NOT EXISTS idx_marketing_blogs_status
  ON public.marketing_blogs (workspace_id, status);

ALTER TABLE public.marketing_blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_blogs_select ON public.marketing_blogs;
CREATE POLICY marketing_blogs_select ON public.marketing_blogs
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_blogs_modify ON public.marketing_blogs;
CREATE POLICY marketing_blogs_modify ON public.marketing_blogs
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_marketing_blogs_updated_at ON public.marketing_blogs;
CREATE TRIGGER set_marketing_blogs_updated_at
  BEFORE UPDATE ON public.marketing_blogs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. Marketing Templates
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('social', 'blog')),
  content_type      TEXT NOT NULL,
  structure         TEXT NOT NULL,
  prompt_template   TEXT NOT NULL,
  example_topic     TEXT,
  platforms         TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_system         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_templates_workspace
  ON public.marketing_templates (workspace_id);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_templates_select ON public.marketing_templates;
CREATE POLICY marketing_templates_select ON public.marketing_templates
  FOR SELECT
  USING (
    workspace_id IS NULL 
    OR public.is_active_workspace_member(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS marketing_templates_modify ON public.marketing_templates;
CREATE POLICY marketing_templates_modify ON public.marketing_templates
  FOR ALL
  USING (
    workspace_id IS NOT NULL 
    AND public.is_active_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IS NOT NULL 
    AND public.is_active_workspace_member(workspace_id, auth.uid())
  );


-- 5. Marketing Audit Logs (Full Lifecycle Audit Trail)
CREATE TABLE IF NOT EXISTS public.marketing_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('post', 'blog', 'campaign', 'template')),
  entity_id         UUID NOT NULL,
  action            TEXT NOT NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name         TEXT,
  user_role         TEXT,
  comment           TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_audit_logs_lookup
  ON public.marketing_audit_logs (workspace_id, entity_type, entity_id);

ALTER TABLE public.marketing_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_audit_logs_select ON public.marketing_audit_logs;
CREATE POLICY marketing_audit_logs_select ON public.marketing_audit_logs
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_audit_logs_insert ON public.marketing_audit_logs;
CREATE POLICY marketing_audit_logs_insert ON public.marketing_audit_logs
  FOR INSERT
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));


-- 6. Marketing Content Ideas
CREATE TABLE IF NOT EXISTS public.marketing_content_ideas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  notes             TEXT,
  platforms         TEXT[] DEFAULT ARRAY[]::TEXT[],
  tags              TEXT[] DEFAULT ARRAY[]::TEXT[],
  campaign_id       UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  creator_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_content_ideas_workspace
  ON public.marketing_content_ideas (workspace_id);

ALTER TABLE public.marketing_content_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_content_ideas_select ON public.marketing_content_ideas;
CREATE POLICY marketing_content_ideas_select ON public.marketing_content_ideas
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_content_ideas_modify ON public.marketing_content_ideas;
CREATE POLICY marketing_content_ideas_modify ON public.marketing_content_ideas
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));


-- 7. Marketing Settings
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  workspace_id          UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  default_timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_platform      TEXT NOT NULL DEFAULT 'linkedin',
  approval_required     BOOLEAN NOT NULL DEFAULT true,
  approval_levels       TEXT NOT NULL DEFAULT 'single',
  rejection_behavior    TEXT NOT NULL DEFAULT 'return_to_creator',
  ai_tone               TEXT NOT NULL DEFAULT 'engaging',
  ai_brand_voice        TEXT DEFAULT 'Modern, helpful, professional, and data-driven CRM software for growing teams.',
  ai_language           TEXT NOT NULL DEFAULT 'English',
  hashtag_count         INTEGER NOT NULL DEFAULT 5,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_settings_select ON public.marketing_settings;
CREATE POLICY marketing_settings_select ON public.marketing_settings
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_settings_modify ON public.marketing_settings;
CREATE POLICY marketing_settings_modify ON public.marketing_settings
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));


-- 8. Traceable Generation Logs
CREATE TABLE IF NOT EXISTS public.marketing_generations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id     TEXT NOT NULL UNIQUE,
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  original_input    TEXT NOT NULL,
  structured_intent JSONB DEFAULT '{}'::jsonb,
  prompt_version    TEXT DEFAULT 'v2.0',
  generated_content JSONB NOT NULL,
  generated_media   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_generations_lookup
  ON public.marketing_generations (workspace_id, generation_id);

ALTER TABLE public.marketing_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_generations_select ON public.marketing_generations;
CREATE POLICY marketing_generations_select ON public.marketing_generations
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_generations_insert ON public.marketing_generations;
CREATE POLICY marketing_generations_insert ON public.marketing_generations
  FOR INSERT
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));


-- 9. Marketing Media Registry
CREATE TABLE IF NOT EXISTS public.marketing_media (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        UUID,
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  media_type        TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  url               TEXT NOT NULL,
  thumbnail_url     TEXT,
  dimensions        TEXT,
  aspect_ratio      TEXT,
  file_size_mb      NUMERIC(8, 2),
  source            TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (source IN ('UPLOADED', 'AI_GENERATED', 'STOCK')),
  prompt            TEXT,
  alt_text          TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_media_workspace
  ON public.marketing_media (workspace_id, content_id);

ALTER TABLE public.marketing_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_media_select ON public.marketing_media;
CREATE POLICY marketing_media_select ON public.marketing_media
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_media_modify ON public.marketing_media;
CREATE POLICY marketing_media_modify ON public.marketing_media
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));
