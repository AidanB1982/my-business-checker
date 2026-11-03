-- Apply once after the bookkeeping and customer/supplier account migrations.
-- Structured invoice records only: no Storage bucket, uploads or stored PDF files.
begin;
create table public.bookkeeping_invoice_profiles (
 book_id uuid primary key references public.bookkeeping_books(id) on delete cascade,details jsonb not null,
 version integer not null default 1,check(jsonb_typeof(details)='object' and octet_length(details::text)<=8192),
 check(char_length(btrim(details->>'legal_name')) between 1 and 160),check(char_length(btrim(details->>'address')) between 1 and 500),check(details->>'not_vat_registered'='true')
);
create table public.bookkeeping_invoice_sequences (
 owner_id uuid primary key references auth.users(id) on delete cascade,next_number bigint not null default 1 check(next_number between 1 and 999999999)
);
create table public.bookkeeping_invoices (
 id uuid primary key,book_id uuid not null references public.bookkeeping_books(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('customer','supplier')),contact_id uuid not null,status text not null default 'draft' check(status in ('draft','posted')),
 number text not null default '' check(char_length(number)<=80),invoice_date date not null,supply_date date not null,due_date date not null,
 lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 50 and octet_length(lines::text)<=65536),notes text not null default '' check(char_length(notes)<=2000),total bigint not null check(total between 1 and 100000000000),
 journal_id uuid unique,issuer jsonb,recipient jsonb,version integer not null default 1,created_at timestamptz not null default now(),
 foreign key(contact_id,book_id) references public.bookkeeping_contacts(id,book_id),foreign key(journal_id,book_id) references public.bookkeeping_journals(id,book_id),
 check(supply_date<=invoice_date and due_date>=invoice_date),check(invoice_date between date '2000-01-01' and date '2099-12-31'),check(due_date between date '2000-01-01' and date '2099-12-31'),
 check((status='draft' and journal_id is null) or (status='posted' and journal_id is not null and number<>''))
);
create unique index bookkeeping_issued_customer_number on public.bookkeeping_invoices(owner_id,lower(number)) where kind='customer' and status='posted';
create index bookkeeping_invoices_book on public.bookkeeping_invoices(book_id,invoice_date,id);
create function public.bookkeeping_invoice_profile(p_book uuid,p_data jsonb,p_version integer default null) returns void language plpgsql security definer set search_path='' as $$declare current_version integer;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 if jsonb_typeof(p_data)<>'object' or p_data->>'not_vat_registered' is distinct from 'true' or nullif(btrim(p_data->>'legal_name'),'') is null or nullif(btrim(p_data->>'address'),'') is null then raise exception 'BOOKS_INVOICE_PROFILE';end if;
 select version into current_version from public.bookkeeping_invoice_profiles where book_id=p_book;
 if found then if p_version is distinct from current_version then raise exception 'BOOKS_INVOICE_CHANGED';end if;update public.bookkeeping_invoice_profiles set details=p_data,version=version+1 where book_id=p_book;
 else if p_version is not null then raise exception 'BOOKS_INVOICE_CHANGED';end if;insert into public.bookkeeping_invoice_profiles(book_id,details) values(p_book,p_data);end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'invoice-profile','Invoice business details updated. Previously issued invoices unchanged.');
end;$$;
create function public.bookkeeping_save_invoice(p_book uuid,p_invoice uuid,p_data jsonb,p_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookkeeping_books;c public.bookkeeping_contacts;d public.bookkeeping_invoices;item jsonb;canonical jsonb:='[]';qty numeric;price numeric;amount numeric;total_amount bigint:=0;category text;v_invoice_date date;v_supply_date date;v_due_date date;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 select * into b from public.bookkeeping_books where id=p_book for update;
 select * into c from public.bookkeeping_contacts where id=(p_data->>'contact_id')::uuid and book_id=p_book;
 if not found or c.kind is distinct from p_data->>'kind' or c.archived then raise exception 'BOOKS_CONTACT_TYPE';end if;
 v_invoice_date:=(p_data->>'invoice_date')::date;v_supply_date:=(p_data->>'supply_date')::date;v_due_date:=(p_data->>'due_date')::date;
 if v_invoice_date is null or v_supply_date is null or v_due_date is null or v_supply_date<b.start_date or v_supply_date>v_invoice_date or v_due_date<v_invoice_date or v_invoice_date>date '2099-12-31' then raise exception 'BOOKS_DATE';end if;
 if p_data->>'kind'='supplier' and nullif(btrim(p_data->>'supplier_number'),'') is null then raise exception 'BOOKS_INVOICE_NUMBER';end if;
 if jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines') not between 1 and 50 then raise exception 'BOOKS_INVOICE_LINES';end if;
 for item in select * from jsonb_array_elements(p_data->'lines') loop
  if jsonb_typeof(item->'quantity_milli') is distinct from 'number' or jsonb_typeof(item->'unit_pence') is distinct from 'number' or nullif(btrim(item->>'description'),'') is null or char_length(item->>'description')>240 then raise exception 'BOOKS_INVOICE_LINES';end if;
  qty:=(item->>'quantity_milli')::numeric;price:=(item->>'unit_pence')::numeric;category:=coalesce(item->>'category','general');
  if qty<>trunc(qty) or price<>trunc(price) or qty not between 1 and 1000000000 or price not between 0 and 100000000000 or category not in ('general','repairs','insurance','fees','utilities','travel','interest') then raise exception 'BOOKS_INVOICE_LINES';end if;
  amount:=round(qty*price/1000);if amount>100000000000 then raise exception 'BOOKS_INVOICE_LINES';end if;total_amount:=total_amount+amount::bigint;
  canonical:=canonical||jsonb_build_array(jsonb_build_object('description',btrim(item->>'description'),'quantity_milli',qty,'unit_pence',price,'category',category));
 end loop;
 if total_amount not between 1 and 100000000000 then raise exception 'BOOKS_INVOICE_LINES';end if;
 select * into d from public.bookkeeping_invoices where id=p_invoice;
 if found then
  if d.book_id<>p_book then raise exception 'BOOKS_PERMISSION';end if;if d.status<>'draft' then raise exception 'BOOKS_INVOICE_POSTED';end if;
  if p_version is null then
   if d.kind=p_data->>'kind' and d.contact_id=c.id and d.invoice_date=v_invoice_date and d.supply_date=v_supply_date and d.due_date=v_due_date and d.lines=canonical and d.notes=coalesce(p_data->>'notes','') and (d.kind='customer' or d.number=btrim(p_data->>'supplier_number')) then return d.id;end if;
   raise exception 'BOOKS_INVOICE_CHANGED';
  end if;
  if d.version<>p_version or d.kind<>p_data->>'kind' then raise exception 'BOOKS_INVOICE_CHANGED';end if;
  update public.bookkeeping_invoices set contact_id=c.id,invoice_date=v_invoice_date,supply_date=v_supply_date,due_date=v_due_date,number=case when d.kind='supplier' then btrim(p_data->>'supplier_number') else '' end,lines=canonical,notes=coalesce(p_data->>'notes',''),total=total_amount,version=version+1 where id=p_invoice;
 else
  if p_version is not null then raise exception 'BOOKS_INVOICE_CHANGED';end if;if (select count(*) from public.bookkeeping_invoices where book_id=p_book)>=5000 then raise exception 'BOOKS_LIMIT';end if;
  insert into public.bookkeeping_invoices(id,book_id,owner_id,kind,contact_id,number,invoice_date,supply_date,due_date,lines,notes,total) values(p_invoice,p_book,auth.uid(),p_data->>'kind',c.id,case when p_data->>'kind'='supplier' then btrim(p_data->>'supplier_number') else '' end,v_invoice_date,v_supply_date,v_due_date,canonical,coalesce(p_data->>'notes',''),total_amount);
 end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'invoice-draft','Invoice draft saved: '||p_invoice::text);return p_invoice;
end;$$;
create function public.bookkeeping_issue_invoice(p_book uuid,p_invoice uuid,p_version integer,p_contact_version integer,p_profile_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookkeeping_books;d public.bookkeeping_invoices;c public.bookkeeping_contacts;profile public.bookkeeping_invoice_profiles;next_n bigint;v_number text;journal uuid;post_lines jsonb;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 -- One number sequence per owner across all business/property books.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,88));select * into b from public.bookkeeping_books where id=p_book for update;
 select * into d from public.bookkeeping_invoices where id=p_invoice and book_id=p_book for update;if not found then raise exception 'BOOKS_INVOICE';end if;if d.status='posted' then return d.journal_id;end if;
 if d.version is distinct from p_version or exists(select 1 from public.bookkeeping_journals where book_id=p_book and request_id=d.id) then raise exception 'BOOKS_INVOICE_CHANGED';end if;
 select * into c from public.bookkeeping_contacts where id=d.contact_id and book_id=p_book;if c.version is distinct from p_contact_version or c.archived then raise exception 'BOOKS_INVOICE_CHANGED';end if;
 select * into profile from public.bookkeeping_invoice_profiles where book_id=p_book;
 if d.kind='customer' then
  if not found or profile.details->>'not_vat_registered' is distinct from 'true' then raise exception 'BOOKS_INVOICE_PROFILE';end if;
  if profile.version is distinct from p_profile_version then raise exception 'BOOKS_INVOICE_CHANGED';end if;
  if nullif(btrim(c.address),'') is null then raise exception 'BOOKS_INVOICE_ADDRESS';end if;
  insert into public.bookkeeping_invoice_sequences(owner_id) values(auth.uid()) on conflict do nothing;
  select next_number into next_n from public.bookkeeping_invoice_sequences where owner_id=auth.uid() for update;
  loop
   v_number:='INV-'||lpad(next_n::text,greatest(6,length(next_n::text)),'0');
   exit when not exists(select 1 from public.bookkeeping_journals j join public.bookkeeping_books books on books.id=j.book_id where books.owner_id=auth.uid() and j.kind='invoice' and lower(btrim(j.reference))=lower(v_number));next_n:=next_n+1;
  end loop;
  update public.bookkeeping_invoice_sequences set next_number=next_n+1 where owner_id=auth.uid();
  post_lines:=jsonb_build_array(jsonb_build_object('account','receivable','debit',d.total,'credit',0),jsonb_build_object('account',case when b.type='landlord' then 'rent' else 'sales' end,'debit',0,'credit',d.total));
 else
  v_number:=d.number;
  if exists(select 1 from public.bookkeeping_journals j where j.book_id=p_book and j.kind='bill' and lower(btrim(j.reference))=lower(v_number) and public.bookkeeping_contact_for(j.id)=d.contact_id and not exists(select 1 from public.bookkeeping_journals r where r.reversal_of=j.id)) then raise exception 'BOOKS_INVOICE_DUPLICATE';end if;
  select jsonb_agg(jsonb_build_object('account',category,'debit',amount,'credit',0)) into post_lines from (select e->>'category' category,sum(round((e->>'quantity_milli')::numeric*(e->>'unit_pence')::numeric/1000))::bigint amount from jsonb_array_elements(d.lines) e group by e->>'category') costs where amount>0;
  post_lines:=post_lines||jsonb_build_array(jsonb_build_object('account','payable','debit',0,'credit',d.total));
 end if;
 journal:=public.bookkeeping_post(p_book,d.id,d.invoice_date,left(case when d.kind='customer' then 'Invoice ' else 'Supplier invoice ' end||v_number,160),case when d.kind='customer' then 'invoice' else 'bill' end,post_lines,null,c.name,v_number,d.contact_id);
 update public.bookkeeping_invoices set status='posted',number=v_number,journal_id=journal,version=version+1,
 issuer=case when d.kind='customer' then profile.details else jsonb_build_object('legal_name',c.name,'address',c.address,'email',c.email,'phone',c.phone) end,
 recipient=case when d.kind='customer' then jsonb_build_object('name',c.name,'address',c.address,'email',c.email,'reference',c.reference) else coalesce(profile.details,jsonb_build_object('legal_name',b.name,'address','')) end where id=d.id;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'invoice-posted',case when d.kind='customer' then 'Customer invoice issued: ' else 'Supplier invoice recorded: ' end||v_number);return journal;
end;$$;
create function public.bookkeeping_delete_invoice(p_book uuid,p_invoice uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 delete from public.bookkeeping_invoices where id=p_invoice and book_id=p_book and version=p_version and status='draft';if not found then raise exception 'BOOKS_INVOICE_CHANGED';end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'invoice-draft-deleted','Unposted draft deleted: '||p_invoice::text);
end;$$;
create function public.bookkeeping_invoice_detail(p_book uuid,p_invoice uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare d public.bookkeeping_invoices;balance bigint:=0;reversed boolean:=false;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;select * into d from public.bookkeeping_invoices where id=p_invoice and book_id=p_book;if not found then raise exception 'BOOKS_INVOICE';end if;
 if d.journal_id is not null then
  select coalesce(sum(case when d.kind='customer' then l.debit-l.credit else l.credit-l.debit end),0) into balance from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and (j.id=d.journal_id or j.document_id=d.journal_id) and l.account=case when d.kind='customer' then 'receivable' else 'payable' end;
  reversed:=exists(select 1 from public.bookkeeping_journals where reversal_of=d.journal_id and book_id=p_book);
 end if;
 return jsonb_build_object('invoice',to_jsonb(d)-'owner_id'-'created_at','balance',balance,'reversed',reversed);
end;$$;
-- Issued itemised documents cannot silently move to a different account.
alter function public.bookkeeping_link_contact(uuid,uuid,uuid) rename to bookkeeping_link_contact_accounts;
revoke execute on function public.bookkeeping_link_contact_accounts(uuid,uuid,uuid) from authenticated;
create function public.bookkeeping_link_contact(p_book uuid,p_journal uuid,p_contact uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 if exists(select 1 from public.bookkeeping_invoices where book_id=p_book and journal_id=p_journal and status='posted' and contact_id is distinct from p_contact) then raise exception 'BOOKS_INVOICE_POSTED';end if;
 perform public.bookkeeping_link_contact_accounts(p_book,p_journal,p_contact);
end;$$;
revoke all on function public.bookkeeping_link_contact(uuid,uuid,uuid) from public,anon;
grant execute on function public.bookkeeping_link_contact(uuid,uuid,uuid) to authenticated;
alter function public.bookkeeping_read(uuid) rename to bookkeeping_read_with_accounts;
revoke execute on function public.bookkeeping_read_with_accounts(uuid) from authenticated;
create function public.bookkeeping_read(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 result:=public.bookkeeping_read_with_accounts(p_book);
 return result||jsonb_build_object('invoices',(select coalesce(jsonb_agg(to_jsonb(d) order by d.invoice_date desc,d.id),'[]') from (select id,book_id,kind,contact_id,status,number,invoice_date,supply_date,due_date,total,journal_id,version from public.bookkeeping_invoices where book_id=p_book) d),'invoice_profile',(select details||jsonb_build_object('version',version) from public.bookkeeping_invoice_profiles where book_id=p_book));
end;$$;
alter table public.bookkeeping_invoice_profiles enable row level security;alter table public.bookkeeping_invoice_sequences enable row level security;alter table public.bookkeeping_invoices enable row level security;
revoke all on public.bookkeeping_invoice_profiles,public.bookkeeping_invoice_sequences,public.bookkeeping_invoices from public,anon,authenticated;
grant select on public.bookkeeping_invoice_profiles,public.bookkeeping_invoices to authenticated;
create policy bookkeeping_invoice_profiles_read on public.bookkeeping_invoice_profiles for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_invoices_read on public.bookkeeping_invoices for select to authenticated using(public.bookkeeping_owns(book_id));
revoke all on function public.bookkeeping_invoice_profile(uuid,jsonb,integer),public.bookkeeping_save_invoice(uuid,uuid,jsonb,integer),public.bookkeeping_issue_invoice(uuid,uuid,integer,integer,integer),public.bookkeeping_delete_invoice(uuid,uuid,integer),public.bookkeeping_invoice_detail(uuid,uuid),public.bookkeeping_read(uuid) from public,anon;
grant execute on function public.bookkeeping_invoice_profile(uuid,jsonb,integer),public.bookkeeping_save_invoice(uuid,uuid,jsonb,integer),public.bookkeeping_issue_invoice(uuid,uuid,integer,integer,integer),public.bookkeeping_delete_invoice(uuid,uuid,integer),public.bookkeeping_invoice_detail(uuid,uuid),public.bookkeeping_read(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
