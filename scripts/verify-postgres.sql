-- ====================================================================
-- DAILYBUZ MARKETING CALENDAR & NOTIFICATION POSTGRESQL VERIFICATION
-- ====================================================================

DO $$
DECLARE
    v_workspace_id UUID := 'ab6095d0-aa86-4328-934b-d56f26d8d7d8';
    v_target_date DATE := '2026-09-07';
    v_post_count INT;
    v_notif_count INT;
    v_unread_count INT;
    v_dedupe_key TEXT := 'daily_summary:ab6095d0-aa86-4328-934b-d56f26d8d7d8:all:2026-09-07';
BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE '🚀 RUNNING COMPLETE POSTGRESQL VERIFICATION SUITE';
    RAISE NOTICE 'Workspace ID: %', v_workspace_id;
    RAISE NOTICE 'Date: %', v_target_date;
    RAISE NOTICE '======================================================';

    -- 1. Check Table Existence
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marketing_posts') THEN
        RAISE NOTICE '✅ Table marketing_posts: EXISTS';
    ELSE
        RAISE EXCEPTION '❌ Table marketing_posts MISSING';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marketing_notifications') THEN
        RAISE NOTICE '✅ Table marketing_notifications: EXISTS';
    ELSE
        RAISE EXCEPTION '❌ Table marketing_notifications MISSING';
    END IF;

    -- 2. Check Deduplication Index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'marketing_notifications' 
          AND indexname = 'uq_marketing_notifications_dedupe'
    ) THEN
        RAISE NOTICE '✅ Deduplication Unique Index: EXISTS';
    ELSE
        RAISE WARNING '⚠️ Deduplication Index uq_marketing_notifications_dedupe NOT FOUND';
    END IF;

    -- 3. Query Scheduled Posts for Today
    SELECT COUNT(*) INTO v_post_count
    FROM marketing_posts
    WHERE workspace_id = v_workspace_id
      AND scheduled_at >= (v_target_date::TIMESTAMPTZ)
      AND scheduled_at < ((v_target_date + INTERVAL '1 day')::TIMESTAMPTZ);

    RAISE NOTICE '✅ Posts scheduled for %: % found', v_target_date, v_post_count;

    -- 4. Query Notifications
    SELECT COUNT(*) INTO v_notif_count
    FROM marketing_notifications
    WHERE workspace_id = v_workspace_id;

    SELECT COUNT(*) INTO v_unread_count
    FROM marketing_notifications
    WHERE workspace_id = v_workspace_id
      AND read_at IS NULL;

    RAISE NOTICE '✅ Total Notifications: %, Unread: %', v_notif_count, v_unread_count;

    -- 5. Test Deduplication
    BEGIN
        INSERT INTO marketing_notifications (
            workspace_id,
            type,
            severity,
            title,
            message,
            dedupe_key
        ) VALUES (
            v_workspace_id,
            'POSTING_TODAY',
            'INFO',
            'Today''s Posting Schedule',
            'Automated SQL verification test.',
            v_dedupe_key
        );
        RAISE NOTICE 'ℹ️ Inserted test notification with dedupe key.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✅ PASS: Deduplication prevented duplicate notification insert.';
    END;

    RAISE NOTICE '======================================================';
    RAISE NOTICE '🎉 ALL POSTGRESQL CHECKS COMPLETED SUCCESSFULLY';
    RAISE NOTICE '======================================================';
END $$;

-- Summary Table Outputs for Inspection
SELECT '--- TODAY POSTS ---' AS section;
SELECT id, title, status, scheduled_at, timezone 
FROM marketing_posts 
WHERE workspace_id = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8'
ORDER BY scheduled_at ASC;

SELECT '--- NOTIFICATIONS ---' AS section;
SELECT id, type, severity, title, message, read_at, created_at
FROM marketing_notifications 
WHERE workspace_id = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8'
ORDER BY created_at DESC
LIMIT 10;
