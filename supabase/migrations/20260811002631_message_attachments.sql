alter table public.messages
  add column attachment_kind text,
  add column attachment_url text,
  add column attachment_file_id text,
  add column attachment_path text,
  add column attachment_mime text,
  add column attachment_size bigint,
  add column attachment_width integer,
  add column attachment_height integer,
  add column attachment_name text;

alter table public.messages
  alter column content set default '',
  drop constraint messages_content_length,
  add constraint messages_content_length check (
    content = btrim(content)
    and char_length(content) <= 2000
    and (char_length(content) >= 1 or attachment_url is not null)
  ),
  add constraint messages_attachment_complete check (
    (
      attachment_kind is null
      and attachment_url is null
      and attachment_file_id is null
      and attachment_path is null
      and attachment_mime is null
      and attachment_size is null
      and attachment_width is null
      and attachment_height is null
      and attachment_name is null
    )
    or
    (
      attachment_kind in ('image', 'video')
      and attachment_url is not null
      and attachment_file_id is not null
      and attachment_path is not null
      and attachment_mime is not null
      and attachment_size is not null
      and attachment_name is not null
      and attachment_url like 'https://ik.imagekit.io/2wfump8c3/fynex/users/%'
      and attachment_path like '/fynex/users/' || author_id::text || '/messages/%'
      and attachment_file_id ~ '^[A-Za-z0-9_-]{8,200}$'
      and char_length(attachment_path) <= 500
      and char_length(attachment_name) between 1 and 255
      and (attachment_width is null or attachment_width > 0)
      and (attachment_height is null or attachment_height > 0)
      and (
        (
          attachment_kind = 'image'
          and attachment_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
          and attachment_size between 1 and 8000000
        )
        or
        (
          attachment_kind = 'video'
          and attachment_mime in ('video/mp4', 'video/webm', 'video/quicktime')
          and attachment_size between 1 and 20000000
        )
      )
    )
  );

comment on column public.messages.attachment_file_id is
  'ImageKit file identifier retained for verification and future cleanup.';
