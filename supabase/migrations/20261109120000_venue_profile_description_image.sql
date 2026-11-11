-- Venue description/image_url are public. Phone, address_line2 and postal_code
-- stay private (venue profile plan Task 1 audit). Preserve live function ACLs.
begin;
alter table public.venues add column if not exists description text, add column if not exists image_url text;
alter table public.venues drop constraint if exists venues_description_length_check;
alter table public.venues add constraint venues_description_length_check check (description is null or char_length(description) <= 1200);
alter table public.venues drop constraint if exists venues_image_url_https_check;
alter table public.venues add constraint venues_image_url_https_check check (image_url is null or (char_length(image_url) <= 2048 and image_url ~* '^https://[^[:space:]]+$'));

create or replace function pg_temp.patch_fn(p_src text, p_old text, p_new text)
returns text language plpgsql as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'venue profile migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

do $patch$
declare v text;
begin
  v := pg_get_functiondef('public.entity_profile_save(text,uuid,jsonb)'::regprocedure);
  if position('Description must be 1,200 characters or fewer.' in v) = 0 then
    v := pg_temp.patch_fn(v,
      $old$when 'venue' then array['website', 'instagram', 'phone', 'address_line1', 'address_line2', 'postal_code']$old$,
      $new$when 'venue' then array['description', 'image_url', 'website', 'instagram', 'phone', 'address_line1', 'address_line2', 'postal_code']$new$);
    v := pg_temp.patch_fn(v, 'update public.venues set', $new$
    if char_length(btrim(p_payload->>'description')) > 1200 then
      raise exception 'Description must be 1,200 characters or fewer.' using errcode = '22023';
    end if;
    if nullif(btrim(p_payload->>'image_url'), '') is not null and
       (char_length(btrim(p_payload->>'image_url')) > 2048 or btrim(p_payload->>'image_url') !~* '^https://[^[:space:]]+$') then
      raise exception 'Image link must be a full https:// link.' using errcode = '22023';
    end if;
    update public.venues set
      description = case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'), '') else description end,
      image_url = case when p_payload ? 'image_url' then nullif(btrim(p_payload->>'image_url'), '') else image_url end,$new$);
    execute v;
  end if;
  v := pg_get_functiondef('public.entity_workspace(text,uuid)'::regprocedure);
  if position($new$'description', v.description, 'image_url', v.image_url$new$ in v) = 0 then
    v := pg_temp.patch_fn(v,
      $old$'postal_code', v.postal_code, 'website', v.website, 'instagram', v.instagram, 'phone', v.phone)$old$,
      $new$'postal_code', v.postal_code, 'website', v.website, 'instagram', v.instagram, 'phone', v.phone, 'description', v.description, 'image_url', v.image_url)$new$);
    execute v;
  end if;
  v := pg_get_functiondef('public.entity_access_public_ref(text,uuid)'::regprocedure);
  if position($new$'description',v.description,'image_url',v.image_url,'city',v.city$new$ in v) = 0 then
    v := pg_temp.patch_fn(v, $old$'description',null,'image_url',null,'city',v.city$old$, $new$'description',v.description,'image_url',v.image_url,'city',v.city$new$);
    execute v;
  end if;
  v := pg_get_functiondef('public.merge_venues(uuid,uuid)'::regprocedure);
  if position('description = coalesce(keep.description, merge.description)' in v) = 0 then
    v := pg_temp.patch_fn(v, 'phone = coalesce(keep.phone, merge.phone)',
      'phone = coalesce(keep.phone, merge.phone), description = coalesce(keep.description, merge.description), image_url = coalesce(keep.image_url, merge.image_url)');
    execute v;
  end if;
end $patch$;
notify pgrst, 'reload schema';
commit;
