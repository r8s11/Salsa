-- Additive claim-inbox fields. Before production rollout, compare the live
-- my_entity_claims definition and grants; apply only with separate authorization.
create or replace function public.my_entity_claims()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.entity_kind, 'entity_id', c.entity_id, 'name', r.name, 'slug', r.slug,
      'relationship', c.relationship, 'status', c.status, 'review_note', c.review_note,
      'created_at', c.created_at, 'reviewed_at', c.reviewed_at,
      'listing_status', r.status,
      'workspace_role', public.entity_workspace_role(c.entity_kind, c.entity_id)
    ) order by c.created_at desc), '[]'::jsonb)
    from public.entity_claims c
    cross join lateral public.entity_workspace_ref(c.entity_kind, c.entity_id) r
   where c.user_id = auth.uid();
$$;
revoke all on function public.my_entity_claims() from public, anon, authenticated;
grant execute on function public.my_entity_claims() to authenticated;
