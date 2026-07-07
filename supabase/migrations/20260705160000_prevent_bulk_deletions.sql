-- 20260705160000_prevent_bulk_deletions.sql
-- Protects HelpHive tables from accidental mass deletions.

-- 1. Profile Deletion Blocker (All deletes blocked on profiles)
CREATE OR REPLACE FUNCTION public.prevent_profile_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_allowed TEXT;
BEGIN
    BEGIN
        v_allowed := current_setting('app.allow_profile_deletion', true);
    EXCEPTION WHEN OTHERS THEN
        v_allowed := 'false';
    END;

    IF v_allowed = 'true' THEN
        RETURN OLD;
    ELSE
        RAISE EXCEPTION 'Accidental deletion protection: Direct deletion of user profiles is disabled! If you really need to perform a hard delete, execute: SET LOCAL app.allow_profile_deletion = ''true''; before your delete query.';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER check_prevent_profile_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_delete();


-- 2. Bulk Deletion Blocker (Limits deletes to a maximum of 3 rows per statement on jobs & addresses)
CREATE OR REPLACE FUNCTION public.prevent_bulk_delete_statement()
RETURNS TRIGGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Query the transition table to count how many rows are being deleted
    SELECT COUNT(*) INTO v_deleted_count FROM old_table;

    IF v_deleted_count > 3 THEN
        RAISE EXCEPTION 'Accidental deletion protection: Bulk deletion blocked! You are attempting to delete % rows in a single query. Maximum allowed is 3.', v_deleted_count;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply statement-level trigger to jobs
CREATE OR REPLACE TRIGGER check_prevent_bulk_delete_jobs
AFTER DELETE ON public.jobs
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_bulk_delete_statement();

-- Apply statement-level trigger to user_addresses
CREATE OR REPLACE TRIGGER check_prevent_bulk_delete_addresses
AFTER DELETE ON public.user_addresses
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_bulk_delete_statement();
