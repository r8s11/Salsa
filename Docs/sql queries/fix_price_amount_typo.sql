-- Fix typo: price_amaount → price_amount.
-- Idempotent: only renames if the typo column exists AND the correct one doesn't.
-- Safe to re-run.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'price_amaount'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'price_amount'
  ) then
    alter table public.events rename column price_amaount to price_amount;
  end if;
end $$;
