-- ============================================================
-- 062: Add 'viewer' to the workspace_role enum.
--
-- Why: the UI/API role model (AccountRole in src/lib/auth/roles.ts)
-- has four roles — owner, admin, agent, viewer — but the DB enum
-- from migration 009 only had owner/admin/member. Both 'agent' and
-- 'viewer' were collapsed onto 'member' on write and mapped back to
-- 'agent' on read, so demoting someone to read-only "viewer"
-- silently left them with full agent permissions.
--
-- This migration ONLY adds the enum value. The policies and RPCs
-- that use it live in 063_viewer_read_only.sql, because Postgres
-- forbids using a new enum value in the same transaction that adds
-- it. When applying manually to production: run this file, commit,
-- THEN run 063.
-- ============================================================

ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'viewer';
