-- Supabase grants EXECUTE on new public functions to anon/authenticated, exposing them via PostgREST RPC.
-- The trigger function is only ever invoked by the trigger (EXECUTE is not checked at fire time).
revoke execute on function public.handle_new_user_household() from public, anon, authenticated;

-- authenticated keeps EXECUTE: the household RLS policies call this function as that role.
revoke execute on function public.current_household_id() from public, anon;
