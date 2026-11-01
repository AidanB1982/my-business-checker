-- Run once after the initial migration. Private Shopify billing ledger; no credentials belong here.
begin;
alter table public.saved_calculations add constraint saved_calculation_size_limit check (octet_length(inputs::text)<=16384 and octet_length(result::text)<=65536);
create table public.shopify_checkout_links (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 variant_id text not null,expires_at timestamptz not null,
 created_at timestamptz not null default now(),redeemed_order_id text
);
create index shopify_checkout_user_idx on public.shopify_checkout_links(user_id,created_at desc);
create table public.shopify_membership_customers (
 shop_domain text not null,customer_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(shop_domain,customer_id)
);
create table public.shopify_membership_orders (
 shop_domain text not null,order_id text not null,customer_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 line_item_id text not null,paid_at timestamptz not null,period_end timestamptz not null,
 refunded boolean not null default false,
 primary key(shop_domain,order_id)
);
create index shopify_orders_user_idx on public.shopify_membership_orders(user_id,period_end desc);
create table public.shopify_membership_reversals (
 shop_domain text not null,event_id text not null,order_id text not null,
 line_item_ids text[] not null,complete boolean not null default false,
 created_at timestamptz not null default now(),primary key(shop_domain,event_id)
);
alter table public.shopify_checkout_links enable row level security;
alter table public.shopify_membership_customers enable row level security;
alter table public.shopify_membership_orders enable row level security;
alter table public.shopify_membership_reversals enable row level security;
revoke all on public.shopify_checkout_links,public.shopify_membership_customers,public.shopify_membership_orders,public.shopify_membership_reversals from public,anon,authenticated;
grant all on public.shopify_checkout_links,public.shopify_membership_customers,public.shopify_membership_orders,public.shopify_membership_reversals to service_role;
create function public.refresh_shopify_membership(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_end timestamptz;v_customer text;
begin
 perform id from auth.users where id=p_user for update;
 select max(period_end) into v_end from public.shopify_membership_orders where user_id=p_user and not refunded;
 select 'shopify:'||shop_domain||':'||customer_id into v_customer from public.shopify_membership_orders where user_id=p_user order by paid_at desc limit 1;
 insert into public.subscriptions(user_id,status,current_period_end,billing_customer_id,updated_at)
 values(p_user,case when v_end>now() then 'active' else 'canceled' end,v_end,v_customer,now())
 on conflict(user_id) do update set status=excluded.status,current_period_end=excluded.current_period_end,billing_customer_id=excluded.billing_customer_id,updated_at=now();
end;
$$;
create function public.apply_shopify_membership_payment(p_shop text,p_order text,p_customer text,p_line text,p_paid_at timestamptz,p_period_end timestamptz,p_token_hash text,p_variant text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid;v_link public.shopify_checkout_links%rowtype;v_reversed boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_shop||':'||p_order,0));
 if exists(select 1 from public.shopify_membership_orders where shop_domain=p_shop and order_id=p_order) then return false;end if;
 if p_paid_at>now()+interval '5 minutes' or p_period_end<p_paid_at+interval '27 days' or p_period_end>p_paid_at+interval '32 days' then raise exception 'Invalid paid period';end if;
 select user_id into v_user from public.shopify_membership_customers where shop_domain=p_shop and customer_id=p_customer;
 if p_token_hash is not null then select * into v_link from public.shopify_checkout_links where token_hash=p_token_hash for update;end if;
 if v_user is null then
  if v_link.user_id is null or v_link.variant_id<>p_variant or v_link.expires_at<p_paid_at or v_link.created_at>p_paid_at+interval '5 minutes' or v_link.redeemed_order_id is not null then raise exception 'Missing or expired account link';end if;
  v_user:=v_link.user_id;
 elsif v_link.user_id is not null and v_link.user_id<>v_user then raise exception 'Customer belongs to another account';end if;
 perform id from auth.users where id=v_user for update;
 -- Recheck after the lock, so duplicate delivery cannot extend access twice.
 if exists(select 1 from public.shopify_membership_orders where shop_domain=p_shop and order_id=p_order) then return false;end if;
 insert into public.shopify_membership_customers(shop_domain,customer_id,user_id) values(p_shop,p_customer,v_user) on conflict do nothing;
 if not exists(select 1 from public.shopify_membership_customers where shop_domain=p_shop and customer_id=p_customer and user_id=v_user) then raise exception 'Customer already linked';end if;
 select exists(select 1 from public.shopify_membership_reversals where shop_domain=p_shop and order_id=p_order and (complete or p_line=any(line_item_ids))) into v_reversed;
 insert into public.shopify_membership_orders(shop_domain,order_id,customer_id,user_id,line_item_id,paid_at,period_end,refunded) values(p_shop,p_order,p_customer,v_user,p_line,p_paid_at,p_period_end,v_reversed);
 if v_link.user_id=v_user and v_link.redeemed_order_id is null then update public.shopify_checkout_links set redeemed_order_id=p_order where token_hash=p_token_hash;end if;
 perform public.refresh_shopify_membership(v_user);
 return not v_reversed;
end;
$$;
create function public.reverse_shopify_membership_payment(p_shop text,p_order text,p_event text,p_lines text[],p_complete boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_shop||':'||p_order,0));
 insert into public.shopify_membership_reversals(shop_domain,event_id,order_id,line_item_ids,complete) values(p_shop,p_event,p_order,p_lines,p_complete) on conflict do nothing;
 select user_id into v_user from public.shopify_membership_orders where shop_domain=p_shop and order_id=p_order;
 if v_user is null then return false;end if;
 perform id from auth.users where id=v_user for update;
 update public.shopify_membership_orders set refunded=true where shop_domain=p_shop and order_id=p_order and (p_complete or line_item_id=any(p_lines));
 perform public.refresh_shopify_membership(v_user);
 return true;
end;
$$;
revoke all on function public.refresh_shopify_membership(uuid),public.apply_shopify_membership_payment(text,text,text,text,timestamptz,timestamptz,text,text),public.reverse_shopify_membership_payment(text,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.refresh_shopify_membership(uuid),public.apply_shopify_membership_payment(text,text,text,text,timestamptz,timestamptz,text,text),public.reverse_shopify_membership_payment(text,text,text,text[],boolean) to service_role;
commit;
