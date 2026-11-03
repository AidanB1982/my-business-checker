-- Apply after Shopify membership migration 202611010002. No entitlements are granted here.
begin;
create table public.shopify_membership_checks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 next_check_at timestamptz not null
);
alter table public.shopify_membership_checks enable row level security;
revoke all on public.shopify_membership_checks from public,anon,authenticated;
grant all on public.shopify_membership_checks to service_role;
create function public.claim_shopify_membership_check(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$declare claimed uuid;begin
 insert into public.shopify_membership_checks(user_id,next_check_at) values(p_user,now()+interval '1 minute')
 on conflict(user_id) do update set next_check_at=excluded.next_check_at where public.shopify_membership_checks.next_check_at<=now()
 returning user_id into claimed;return claimed is not null;
end;$$;
revoke all on function public.claim_shopify_membership_check(uuid) from public,anon,authenticated;
grant execute on function public.claim_shopify_membership_check(uuid) to service_role;
notify pgrst,'reload schema';commit;
