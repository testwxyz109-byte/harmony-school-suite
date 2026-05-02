
-- Re-set search_path on the trigger functions that didn't have it
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.check_attendance_date() SET search_path = public;

-- Revoke anon execute on internal helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_sub(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_enabled(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_student_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_attendance_date() FROM anon, authenticated;
