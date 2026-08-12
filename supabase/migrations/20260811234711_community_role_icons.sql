alter table public.community_roles
  add column if not exists icon text not null default 'shield'
  check (icon in ('shield', 'star', 'crown', 'swords', 'code', 'palette', 'gamepad', 'music', 'heart', 'sparkles'));
