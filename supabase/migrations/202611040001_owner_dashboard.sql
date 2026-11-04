-- Apply after 202611010001_initial_schema.sql. Owner access is assigned separately
-- by a trusted database administrator; membership never confers owner access.
begin;
create table public.app_owners (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_owners enable row level security;
revoke all on public.app_owners from public,anon,authenticated;
create function public.is_app_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_owners where user_id=auth.uid());
$$;
revoke all on function public.is_app_owner() from public,anon;
grant execute on function public.is_app_owner() to authenticated;

-- One row per consenting signed-in account, UTC day and allowlisted page.
-- No financial values, URLs, queries, emails, IPs or user agents are stored.
create table public.app_activity (
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_day date not null default (now() at time zone 'UTC')::date,
 page text not null check (page in ('workspace','projects','bookkeeping','tools','guides','sole-traders','landlords',
 'self-employed-tax-calculator','vat-threshold-checker','mtd-checker','salary-dividend-calculator','business-mileage-calculator',
 'salary-take-home-calculator','pension-pot-predictor','sole-trader-working-sheet','landlord-rent-reconciliation',
 'property-maintenance-reserve','rental-yield-mortgage-planner')),
 primary key(user_id,activity_day,page)
);
create index app_activity_day_idx on public.app_activity(activity_day);
alter table public.app_activity enable row level security;
revoke all on public.app_activity from public,anon,authenticated;
create function public.record_app_activity(p_page text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise insufficient_privilege using message='Sign in required'; end if;
 -- Invalid page labels fail the table constraint; user identity and day cannot be supplied.
 insert into public.app_activity(user_id,page) values(auth.uid(),p_page) on conflict do nothing;
 delete from public.app_activity where activity_day < (now() at time zone 'UTC')::date-89;
end;$$;
create function public.delete_my_app_activity() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in required'; end if;
 delete from public.app_activity where user_id=auth.uid();
end;$$;
revoke all on function public.record_app_activity(text),public.delete_my_app_activity() from public,anon;
grant execute on function public.record_app_activity(text),public.delete_my_app_activity() to authenticated;

create function public.owner_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; result jsonb;
begin
 if not public.is_app_owner() then raise insufficient_privilege using message='Owner access required'; end if;
 select jsonb_build_object(
  'registeredUsers',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
  'newUsers30',(select count(*) from auth.users where not coalesce(is_anonymous,false) and created_at >= now()-interval '30 days'),
  'advancedMembers',(select count(*) from public.subscriptions s join auth.users u on u.id=s.user_id where s.status in ('active','trialing') and s.current_period_end>now() and not coalesce(u.is_anonymous,false)),
  'activeUsers7',(select count(distinct user_id) from public.app_activity where activity_day>=today-6),
  'activeUsers30',(select count(distinct user_id) from public.app_activity where activity_day>=today-29),
  'recordingSince',(select min(activity_day) from public.app_activity where activity_day>=today-89),
  'topTools',coalesce((select jsonb_agg(t order by t.users desc,t.page) from (
   select page,count(distinct user_id) as users from public.app_activity
   where activity_day>=today-29 and page not in ('workspace','projects','bookkeeping','tools','guides','sole-traders','landlords')
   group by page order by users desc,page limit 11
  ) t),'[]'::jsonb),
  'dailyActivity',coalesce((select jsonb_agg(d order by d.day) from (
   select day::date as day,count(distinct a.user_id) as users
   from generate_series(today-29,today,interval '1 day') day
   left join public.app_activity a on a.activity_day=day::date
   group by day
  ) d),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function public.owner_dashboard_stats() from public,anon;
grant execute on function public.owner_dashboard_stats() to authenticated;
-- No authenticated role can read user-level activity or assign an owner, even
-- via the Data API. Only the owner-gated aggregate function exposes statistics.
notify pgrst,'reload schema';
commit;
