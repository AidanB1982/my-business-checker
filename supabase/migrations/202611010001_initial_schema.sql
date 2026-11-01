-- Apply once through Supabase migrations or the SQL editor after review.
-- No service-role credential belongs in the browser or repository.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive','active','trialing','past_due','canceled','unpaid')),
  current_period_end timestamptz,
  billing_customer_id text unique,
  updated_at timestamptz not null default now()
);
-- Subscription writes are reserved for a trusted future billing backend.
create table public.saved_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_slug text not null check (char_length(tool_slug) between 1 and 100),
  tax_year text not null check (tax_year ~ '^20[0-9]{2}/[0-9]{2}$'),
  rule_set_version text not null,
  title text not null check (char_length(title) between 1 and 150),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now()
);
create index saved_calculations_user_created_idx on public.saved_calculations(user_id,created_at desc);
create table public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  tax_year text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  sources jsonb not null check (jsonb_typeof(sources) = 'array'),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tax_year,version),
  check(status <> 'published' or (reviewed_at is not null and published_at is not null and jsonb_array_length(sources)>0))
);
create function public.protect_published_rule_sets() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('published','retired') then
    raise exception 'Published rule sets are immutable; create a new version';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger immutable_rule_sets before update or delete on public.rule_sets
for each row execute function public.protect_published_rule_sets();
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.saved_calculations enable row level security;
alter table public.rule_sets enable row level security;
revoke all on public.profiles, public.subscriptions, public.saved_calculations, public.rule_sets from anon, authenticated;
grant select,insert,update,delete on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select,insert,update,delete on public.saved_calculations to authenticated;
-- Rule administration is private. Published snapshots are checked into Git at release.
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy profiles_delete on public.profiles for delete to authenticated using ((select auth.uid())=id);
create policy subscriptions_own_read on public.subscriptions for select to authenticated using ((select auth.uid())=user_id);
-- Users may still read or delete their own saved data after a paid period expires.
create policy calculations_select on public.saved_calculations for select to authenticated using ((select auth.uid())=user_id);
create policy calculations_delete on public.saved_calculations for delete to authenticated using ((select auth.uid())=user_id);
create policy calculations_insert on public.saved_calculations for insert to authenticated with check (
  (select auth.uid())=user_id and exists(select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing') and s.current_period_end>now())
);
create policy calculations_update on public.saved_calculations for update to authenticated using (
  (select auth.uid())=user_id and exists(select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing') and s.current_period_end>now())
) with check (
  (select auth.uid())=user_id and exists(select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing') and s.current_period_end>now())
);
commit;
