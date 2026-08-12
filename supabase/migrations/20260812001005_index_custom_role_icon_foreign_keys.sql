create index community_role_icons_created_by_idx
  on public.community_role_icons(created_by);

drop index if exists public.community_roles_custom_icon_idx;
create index community_roles_custom_icon_community_idx
  on public.community_roles(custom_icon_id, community_id)
  where custom_icon_id is not null;
