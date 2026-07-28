-- ============================================================
-- 053_conversation_unread_increment.sql
--
-- Atomic inbound-conversation bump for the WhatsApp webhook.
--
-- The webhook previously did a client-side read-modify-write on
-- conversations.unread_count. Two messages arriving in one webhook
-- batch (or two concurrent deliveries) both read N and both wrote
-- N+1 — one unread was lost permanently. Same pattern already fixed
-- for automations in migration 007.
-- ============================================================

CREATE OR REPLACE FUNCTION record_inbound_conversation_update(
  p_conversation_id UUID,
  p_last_message_text TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversations
  SET
    last_message_text = p_last_message_text,
    last_message_at = now(),
    unread_count = COALESCE(unread_count, 0) + 1,
    updated_at = now()
  WHERE id = p_conversation_id;
$$;

REVOKE ALL ON FUNCTION record_inbound_conversation_update(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_inbound_conversation_update(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION record_inbound_conversation_update(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_inbound_conversation_update(UUID, TEXT) TO service_role;
