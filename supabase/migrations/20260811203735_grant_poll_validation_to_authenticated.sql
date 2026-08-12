-- This function is referenced by a CHECK constraint on public.messages.
-- The inserting role must be allowed to execute it for PostgreSQL to
-- evaluate the constraint, while anon remains unable to call it.
grant execute on function private.valid_poll_options(jsonb) to authenticated;
