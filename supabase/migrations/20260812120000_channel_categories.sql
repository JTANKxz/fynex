create table public.channel_categories (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32), position smallint not null default 0 check (position >= 0),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), unique (community_id, name)
);
create index channel_categories_community_position_idx on public.channel_categories(community_id, position, created_at);
alter table public.channels add column category_id uuid references public.channel_categories(id) on delete set null;
create index channels_category_position_idx on public.channels(community_id, category_id, position, created_at);
alter table public.channel_categories enable row level security;
create policy "Members can view channel categories" on public.channel_categories for select to authenticated using (exists (select 1 from public.community_members m where m.community_id = channel_categories.community_id and m.user_id = (select auth.uid())));
create policy "Channel managers can create channel categories" on public.channel_categories for insert to authenticated with check ((select private.has_community_permission(community_id, 'manage_channels')) and created_by = (select auth.uid()));
create policy "Channel managers can update channel categories" on public.channel_categories for update to authenticated using ((select private.has_community_permission(community_id, 'manage_channels'))) with check ((select private.has_community_permission(community_id, 'manage_channels')));
create policy "Channel managers can delete channel categories" on public.channel_categories for delete to authenticated using ((select private.has_community_permission(community_id, 'manage_channels')));
grant select, insert, update, delete on public.channel_categories to authenticated;
revoke all on public.channel_categories from anon;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='channel_categories') then alter publication supabase_realtime add table public.channel_categories; end if; end $$;
