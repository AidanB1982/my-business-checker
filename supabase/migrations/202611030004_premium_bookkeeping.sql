-- Small deduplicated PNG logos and a read-only portable backup. No document uploads.
begin;
create function public.bookkeeping_logo_valid(p_logo text) returns boolean language plpgsql immutable set search_path='' as $$declare b bytea;w bigint;h bigint;begin
 if p_logo is null or p_logo!~'^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' or char_length(p_logo)>43714 then return false;end if;
 b:=decode(split_part(p_logo,',',2),'base64');if octet_length(b) not between 45 and 32768 then return false;end if;
 if encode(substring(b from 1 for 8),'hex')<>'89504e470d0a1a0a' or encode(substring(b from 9 for 8),'hex')<>'0000000d49484452' or encode(substring(b from octet_length(b)-7 for 4),'hex')<>'49454e44' then return false;end if;
 w:=get_byte(b,16)::bigint*16777216+get_byte(b,17)*65536+get_byte(b,18)*256+get_byte(b,19);h:=get_byte(b,20)::bigint*16777216+get_byte(b,21)*65536+get_byte(b,22)*256+get_byte(b,23);return w between 1 and 256 and h between 1 and 256;
exception when others then return false;end;$$;
create table public.bookkeeping_brand_assets (
 id uuid primary key default gen_random_uuid(),book_id uuid not null references public.bookkeeping_books(id) on delete cascade,logo_data text not null check(public.bookkeeping_logo_valid(logo_data)),fingerprint text not null check(fingerprint=md5(logo_data)),created_at timestamptz not null default now(),unique(book_id,fingerprint)
);
alter table public.bookkeeping_brand_assets enable row level security;
revoke all on public.bookkeeping_brand_assets from public,anon,authenticated;grant select on public.bookkeeping_brand_assets to authenticated;
create policy bookkeeping_brand_assets_read on public.bookkeeping_brand_assets for select to authenticated using(public.bookkeeping_owns(book_id));
alter function public.bookkeeping_invoice_profile(uuid,jsonb,integer) rename to bookkeeping_invoice_profile_core;
revoke execute on function public.bookkeeping_invoice_profile_core(uuid,jsonb,integer) from authenticated;
create function public.bookkeeping_invoice_profile(p_book uuid,p_data jsonb,p_version integer default null) returns void language plpgsql security definer set search_path='' as $$declare logo text;asset public.bookkeeping_brand_assets;details jsonb;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;logo:=coalesce(p_data->>'logo_data','');
 if coalesce(p_data->>'brand_color','#24574a')!~'^#[0-9a-fA-F]{6}$' then raise exception 'BOOKS_BRAND';end if;
 details:=(p_data-'logo_data'-'logo_id')||jsonb_build_object('brand_color',coalesce(p_data->>'brand_color','#24574a'));
 if logo<>'' then
  if not public.bookkeeping_logo_valid(logo) then raise exception 'BOOKS_BRAND';end if;
  select * into asset from public.bookkeeping_brand_assets where book_id=p_book and fingerprint=md5(logo);
  if found then if asset.logo_data<>logo then raise exception 'BOOKS_BRAND';end if;
  else if (select count(*) from public.bookkeeping_brand_assets where book_id=p_book)>=20 then raise exception 'BOOKS_BRAND_LIMIT';end if;insert into public.bookkeeping_brand_assets(book_id,logo_data,fingerprint) values(p_book,logo,md5(logo)) returning * into asset;end if;
  details:=details||jsonb_build_object('logo_id',asset.id);
 end if;
 perform public.bookkeeping_invoice_profile_core(p_book,details,p_version);
end;$$;
alter function public.bookkeeping_invoice_detail(uuid,uuid) rename to bookkeeping_invoice_detail_core;
revoke execute on function public.bookkeeping_invoice_detail_core(uuid,uuid) from authenticated;
create function public.bookkeeping_invoice_detail(p_book uuid,p_invoice uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;logo text;begin
 result:=public.bookkeeping_invoice_detail_core(p_book,p_invoice);
 select logo_data into logo from public.bookkeeping_brand_assets where book_id=p_book and id::text=result#>>'{invoice,issuer,logo_id}';
 if logo is not null then result:=jsonb_set(result,'{invoice,issuer,logo_data}',to_jsonb(logo));end if;return result;
end;$$;
alter function public.bookkeeping_read(uuid) rename to bookkeeping_read_before_brand;
revoke execute on function public.bookkeeping_read_before_brand(uuid) from authenticated;
create function public.bookkeeping_read(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;logo text;begin
 result:=public.bookkeeping_read_before_brand(p_book);select logo_data into logo from public.bookkeeping_brand_assets where book_id=p_book and id::text=result#>>'{invoice_profile,logo_id}';
 if logo is not null then result:=jsonb_set(result,'{invoice_profile,logo_data}',to_jsonb(logo));end if;return result;
end;$$;
create function public.bookkeeping_backup(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb:='{}';t text;key text;rows jsonb;condition text;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;
 foreach t in array array['bookkeeping_books','bookkeeping_contacts','bookkeeping_journals','bookkeeping_lines','bookkeeping_contact_links','bookkeeping_contact_openings','bookkeeping_reconciliations','bookkeeping_audit','bookkeeping_invoice_profiles','bookkeeping_invoice_sequences','bookkeeping_invoices','bookkeeping_brand_assets'] loop
  key:=case t when 'bookkeeping_contact_links' then 'journal_id' when 'bookkeeping_contact_openings' then 'contact_id' when 'bookkeeping_invoice_profiles' then 'book_id' when 'bookkeeping_invoice_sequences' then 'owner_id' else 'id' end;
  condition:=case t when 'bookkeeping_books' then 'id=$1' when 'bookkeeping_invoice_sequences' then 'owner_id=$2' else 'book_id=$1' end;
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by r.%I),''[]''::jsonb) from public.%I r where %s',key,t,condition) into rows using p_book,auth.uid();result:=result||jsonb_build_object(t,rows);
 end loop;
 if octet_length(result::text)>26214400 then raise exception 'BOOKS_EXPORT_LARGE';end if;
 return jsonb_build_object('book_id',p_book,'owner_id',auth.uid(),'exported_at',now(),'tables',result);
end;$$;
revoke all on function public.bookkeeping_logo_valid(text) from public,anon,authenticated;
revoke all on function public.bookkeeping_invoice_profile(uuid,jsonb,integer),public.bookkeeping_invoice_detail(uuid,uuid),public.bookkeeping_read(uuid),public.bookkeeping_backup(uuid) from public,anon;
grant execute on function public.bookkeeping_invoice_profile(uuid,jsonb,integer),public.bookkeeping_invoice_detail(uuid,uuid),public.bookkeeping_read(uuid),public.bookkeeping_backup(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
