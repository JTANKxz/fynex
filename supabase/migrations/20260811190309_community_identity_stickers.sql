-- Server-scoped identity, tags and sticker library.
alter table public.community_members add column nickname text;
alter table public.community_members add constraint community_members_nickname_check
  check (nickname is null or char_length(btrim(nickname)) between 1 and 32);

create table public.community_tags (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint community_tags_name_check check (char_length(btrim(name)) between 1 and 24),
  constraint community_tags_color_check check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique (community_id, name),
  unique (id, community_id)
);

create table public.community_member_tags (
  community_id uuid not null,
  user_id uuid not null,
  tag_id uuid not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (community_id, user_id, tag_id),
  foreign key (community_id, user_id) references public.community_members(community_id, user_id) on delete cascade,
  foreign key (tag_id, community_id) references public.community_tags(id, community_id) on delete cascade
);

create table public.community_stickers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  image_url text not null,
  image_file_id text not null,
  image_path text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint community_stickers_name_check check (char_length(btrim(name)) between 1 and 32),
  unique (community_id, name)
);

create index community_tags_community_idx on public.community_tags(community_id);
create index community_member_tags_member_idx on public.community_member_tags(community_id, user_id);
create index community_stickers_community_idx on public.community_stickers(community_id);

alter table public.community_tags enable row level security;
alter table public.community_member_tags enable row level security;
alter table public.community_stickers enable row level security;

create policy "Members can view community tags" on public.community_tags for select to authenticated
  using ((select private.is_community_member(community_id)));
create policy "Members can view assigned community tags" on public.community_member_tags for select to authenticated
  using ((select private.is_community_member(community_id)));
create policy "Members can view community stickers" on public.community_stickers for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Role managers can create tags" on public.community_tags for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_community_permission(community_id, 'manage_roles')));
create policy "Role managers can delete tags" on public.community_tags for delete to authenticated
  using ((select private.has_community_permission(community_id, 'manage_roles')));
create policy "Role managers can assign tags" on public.community_member_tags for insert to authenticated
  with check (assigned_by = (select auth.uid()) and (select private.has_community_permission(community_id, 'manage_members')));
create policy "Role managers can remove tags" on public.community_member_tags for delete to authenticated
  using ((select private.has_community_permission(community_id, 'manage_members')));
create policy "Role managers can create stickers" on public.community_stickers for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_community_permission(community_id, 'manage_roles')));
create policy "Role managers can delete stickers" on public.community_stickers for delete to authenticated
  using ((select private.has_community_permission(community_id, 'manage_roles')));

create policy "Members can update their own nickname" on public.community_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.community_members replica identity full;
alter table public.community_tags replica identity full;
alter table public.community_member_tags replica identity full;
alter table public.community_stickers replica identity full;
