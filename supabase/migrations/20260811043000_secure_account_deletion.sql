-- Allow an authenticated user to permanently remove their own account.
-- The privileged operation stays outside the exposed public schema.

alter table public.community_roles
  drop constraint if exists community_roles_created_by_fkey,
  alter column created_by drop not null,
  add constraint community_roles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.community_member_roles
  drop constraint if exists community_member_roles_assigned_by_fkey,
  alter column assigned_by drop not null,
  add constraint community_member_roles_assigned_by_fkey
    foreign key (assigned_by) references public.profiles(id) on delete set null;

create or replace function private.delete_current_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  account_deleted boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Prevent refresh tokens from creating another session after deletion.
  delete from auth.sessions where user_id = current_user_id;
  delete from auth.users where id = current_user_id;
  account_deleted := found;

  if not account_deleted then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function private.delete_current_account() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.delete_current_account() to authenticated;

create or replace function public.delete_current_account()
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.delete_current_account();
$$;

revoke all on function public.delete_current_account() from public, anon;
grant execute on function public.delete_current_account() to authenticated;

comment on function public.delete_current_account() is
  'Deletes only the currently authenticated account and revokes its refresh sessions.';
