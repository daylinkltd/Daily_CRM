-- ── 033_add_workspace_default_currency.sql — Add default currency to workspaces
--
-- Adds a `default_currency` column to the `workspaces` table.
-- This bridges the upstream default currency feature into our multi-tenant model.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD';
