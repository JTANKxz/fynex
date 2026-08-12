alter table public.community_members
  add column if not exists display_role_id uuid,
  add constraint community_members_display_role_fkey foreign key (display_role_id, community_id) references public.community_roles(id, community_id) on delete set null;

alter table public.community_roles
  add column if not exists color_mode text not null default 'solid'
  check (color_mode in ('solid', 'rgb'));

create or replace function private.can_assign_community_role(
  target_community_id uuid,
  target_user_id uuid,
  target_role_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_community_permission(target_community_id, 'manage_roles')
    and (
      (exists (select 1 from public.communities c where c.id = target_community_id and c.owner_id = target_user_id and c.owner_id = (select auth.uid())))
      or (
        not exists (select 1 from public.communities c where c.id = target_community_id and c.owner_id = target_user_id)
        and private.actor_role_position(target_community_id) > private.member_role_position(target_community_id, target_user_id)
      )
    )
    and exists (select 1 from public.community_roles r where r.id = target_role_id and r.community_id = target_community_id and r.position < private.actor_role_position(target_community_id));
$$;
