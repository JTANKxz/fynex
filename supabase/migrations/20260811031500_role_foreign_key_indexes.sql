create index channels_created_by_idx on public.channels (created_by)
  where created_by is not null;
create index community_roles_created_by_idx on public.community_roles (created_by);
create index community_member_roles_assigned_by_idx on public.community_member_roles (assigned_by);
create index community_member_roles_role_community_idx
  on public.community_member_roles (role_id, community_id);
