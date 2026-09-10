-- Read-only diagnostic — no inserts/updates/deletes/DDL. Safe to run against
-- production. Checks whether reconcile-prod-schema.sql (the pre-existing,
-- separate events-admin gap noted in reconcile-prod-schema.sql's
-- header) was ever applied.

select
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='events' and column_name='host'))              as host_col_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='events' and column_name='recurrence'))         as recurrence_col_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='events' and column_name='gallery'))            as gallery_col_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='events' and column_name='contact_email'))      as contact_email_col_exists,
  (select exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
     where c.relname='events' and p.polname='Admins can view all events'))                      as admin_select_policy_exists,
  (select exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
     where c.relname='events' and p.polname='Admins can update events'))                        as admin_update_policy_exists,
  (select exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
     where c.relname='events' and p.polname='Admins can delete events'))                        as admin_delete_policy_exists,
  (select exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
     where c.relname='events' and p.polname='Admins can insert events'))                        as admin_insert_policy_exists,
  (select exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
     where c.relname='events' and p.polname='Users can view own submissions'))                  as own_submissions_policy_exists;
