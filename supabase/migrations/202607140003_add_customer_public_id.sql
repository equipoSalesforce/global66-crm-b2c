begin;

create extension if not exists pgcrypto;

alter table public.customers
  add column if not exists public_id text,
  add column if not exists customer_id text;

update public.customers
set public_id = 'cus_' || encode(gen_random_bytes(10), 'hex')
where public_id is null;

alter table public.customers
  alter column public_id set default ('cus_' || encode(gen_random_bytes(10), 'hex')),
  alter column public_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_public_id_key'
  ) then
    alter table public.customers
      add constraint customers_public_id_key unique (public_id);
  end if;
end
$$;

commit;
