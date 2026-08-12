-- Returns only friends shared by the authenticated user and the requested profile.
-- The relationship graph itself remains protected by the friendships RLS policy.
create or replace function private.get_mutual_friends(target_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  accent_color text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  with my_friends as (
    select case when user_a = auth.uid() then user_b else user_a end as user_id
    from public.friendships
    where status = 'accepted'
      and auth.uid() in (user_a, user_b)
  ), target_friends as (
    select case when user_a = target_user_id then user_b else user_a end as user_id
    from public.friendships
    where status = 'accepted'
      and target_user_id in (user_a, user_b)
  )
  select profile.id, profile.username, profile.display_name, profile.avatar_url, profile.accent_color
  from public.profiles profile
  join my_friends mine on mine.user_id = profile.id
  join target_friends target on target.user_id = profile.id
  where auth.uid() is not null
  order by profile.display_name;
$$;

revoke all on function private.get_mutual_friends(uuid) from public, anon;
grant execute on function private.get_mutual_friends(uuid) to authenticated;

create or replace function public.get_mutual_friends(target_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  accent_color text
)
language sql
security invoker
set search_path = public, private
stable
as $$
  select * from private.get_mutual_friends(target_user_id);
$$;

revoke all on function public.get_mutual_friends(uuid) from public, anon;
grant execute on function public.get_mutual_friends(uuid) to authenticated;
