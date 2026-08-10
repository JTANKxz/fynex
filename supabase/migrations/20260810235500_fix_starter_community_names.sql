-- Keep migration SQL ASCII-only while producing the Portuguese name correctly.

update public.communities
set name = 'Espa' || chr(231) || 'o de ' || split_part(name, '''s ', 1)
where description = 'Sua primeira comunidade no FYNEX.'
  and name like '%''s espa%';

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  profile_color text := '#8b5cf6';
  community_id uuid;
begin
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Invalid username' using errcode = 'check_violation';
  end if;

  if char_length(requested_name) < 2 or char_length(requested_name) > 50 then
    raise exception 'Invalid display name' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, username, display_name, accent_color)
  values (new.id, requested_username, requested_name, profile_color);

  insert into public.communities (name, description, owner_id, accent_color)
  values ('Espa' || chr(231) || 'o de ' || requested_name, 'Sua primeira comunidade no FYNEX.', new.id, profile_color)
  returning id into community_id;

  insert into public.community_members (community_id, user_id, role)
  values (community_id, new.id, 'owner');

  insert into public.channels (community_id, name, type, position)
  values (community_id, 'geral', 'text', 0), (community_id, 'conversa', 'voice', 1);

  return new;
end;
$$;
