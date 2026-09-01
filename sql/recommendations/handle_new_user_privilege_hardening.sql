-- Manual review only. Not applied to production.
--
-- Observation:
--   GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated
-- was granted historically. The function is ONLY ever called by the
-- on_auth_user_created trigger (AFTER INSERT ON auth.users), which fires
-- under the DEFINER's privileges (postgres), NOT the caller's.
-- 'authenticated' therefore does not need direct EXECUTE privilege.
--
-- The function is NOT a security risk in its current form:
--   * SECURITY DEFINER, owned by postgres
--   * search_path = public (fixed)
--   * body inserts ONE profiles row keyed on new.id with fixed role 'user'
--   * ON CONFLICT (id) DO NOTHING — no overwrite of existing rows
--
-- The grant is simply over-broad (least-privilege violation) — not a vuln.
--
-- Recommended (review-then-apply):
--   REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
--   GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
--
-- This keeps the trigger working while removing the unnecessary public/authenticated
-- surface. No profile-creation flow depends on authenticated being able to call it
-- directly; the trigger is the only caller.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
