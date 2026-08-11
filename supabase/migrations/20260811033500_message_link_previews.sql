alter table public.messages
  add column if not exists link_preview_url text,
  add column if not exists link_preview_title text,
  add column if not exists link_preview_description text,
  add column if not exists link_preview_site_name text;

alter table public.messages
  add constraint messages_link_preview_url_length check (link_preview_url is null or char_length(link_preview_url) <= 2048),
  add constraint messages_link_preview_title_length check (link_preview_title is null or char_length(link_preview_title) <= 200),
  add constraint messages_link_preview_description_length check (link_preview_description is null or char_length(link_preview_description) <= 500),
  add constraint messages_link_preview_site_name_length check (link_preview_site_name is null or char_length(link_preview_site_name) <= 100);
