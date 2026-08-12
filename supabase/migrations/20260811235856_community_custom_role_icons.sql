create table public.community_role_icons (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  image_url text not null,
  image_file_id text not null,
  image_path text not null,
  mime_type text not null,
  file_size integer not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint community_role_icons_name_check check (char_length(btrim(name)) between 1 and 32),
  constraint community_role_icons_mime_check check (mime_type in ('image/png', 'image/svg+xml')),
  constraint community_role_icons_size_check check (file_size between 1 and 262144),
  unique (community_id, name),
  unique (id, community_id)
);

alter table public.community_roles
  add column custom_icon_id uuid;

alter table public.community_roles
  add constraint community_roles_custom_icon_fk
  foreign key (custom_icon_id, community_id)
  references public.community_role_icons(id, community_id)
  on delete set null (custom_icon_id);

create index community_role_icons_community_idx on public.community_role_icons(community_id);
create index community_roles_custom_icon_idx on public.community_roles(custom_icon_id) where custom_icon_id is not null;

alter table public.community_role_icons enable row level security;

create policy "Members can view community role icons"
on public.community_role_icons for select to authenticated
using ((select private.is_community_member(community_id)));

create policy "Role managers can create community role icons"
on public.community_role_icons for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_community_permission(community_id, 'manage_roles'))
);

create policy "Role managers can delete community role icons"
on public.community_role_icons for delete to authenticated
using ((select private.has_community_permission(community_id, 'manage_roles')));

create or replace function private.enforce_community_role_icon_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.community_id::text, 0));
  if (select count(*) from public.community_role_icons where community_id = new.community_id) >= 20 then
    raise exception 'community role icon quota exceeded';
  end if;
  return new;
end;
$$;

create trigger enforce_community_role_icon_quota
before insert on public.community_role_icons
for each row execute function private.enforce_community_role_icon_quota();

revoke all on function private.enforce_community_role_icon_quota() from public, anon, authenticated;

alter table public.community_role_icons replica identity full;
alter publication supabase_realtime add table public.community_role_icons;

grant select, insert, delete on table public.community_role_icons to authenticated;
