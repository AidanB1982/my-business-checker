-- Run once after 202611030001_bookkeeping.sql. No financial journals are rewritten.
begin;
create table public.bookkeeping_contacts (
 id uuid primary key,book_id uuid not null references public.bookkeeping_books(id) on delete cascade,
 kind text not null check(kind in ('customer','supplier')),name text not null check(char_length(btrim(name)) between 1 and 160),
 reference text not null default '' check(char_length(reference)<=40),email text not null default '' check(char_length(email)<=254),phone text not null default '' check(char_length(phone)<=60),address text not null default '' check(char_length(address)<=500),notes text not null default '' check(char_length(notes)<=1000),archived boolean not null default false,version integer not null default 1,created_at timestamptz not null default now(),unique(id,book_id)
);
create unique index bookkeeping_contact_name on public.bookkeeping_contacts(book_id,kind,lower(btrim(name)));
create table public.bookkeeping_contact_links (
 journal_id uuid primary key,book_id uuid not null,contact_id uuid not null,
 foreign key(journal_id,book_id) references public.bookkeeping_journals(id,book_id) on delete cascade,foreign key(contact_id,book_id) references public.bookkeeping_contacts(id,book_id)
);
create table public.bookkeeping_contact_openings (
 contact_id uuid primary key,book_id uuid not null,amount bigint not null check(amount between 0 and 100000000000),foreign key(contact_id,book_id) references public.bookkeeping_contacts(id,book_id)
);
create function public.bookkeeping_save_contact(p_book uuid,p_contact uuid,p_data jsonb,p_version integer default null,p_archived boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare c public.bookkeeping_contacts;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 select * into c from public.bookkeeping_contacts where id=p_contact;
 if found then
  if c.book_id<>p_book then raise exception 'BOOKS_PERMISSION';end if;
  if p_version is null then return c.id;end if;
  if c.version<>p_version then raise exception 'BOOKS_CONTACT_CHANGED';end if;
  if c.kind is distinct from p_data->>'kind' then raise exception 'BOOKS_CONTACT_TYPE';end if;
  update public.bookkeeping_contacts set name=btrim(p_data->>'name'),reference=coalesce(p_data->>'reference',''),email=coalesce(p_data->>'email',''),phone=coalesce(p_data->>'phone',''),address=coalesce(p_data->>'address',''),notes=coalesce(p_data->>'notes',''),archived=p_archived,version=version+1 where id=p_contact;
 else
  if p_version is not null then raise exception 'BOOKS_CONTACT_CHANGED';end if;
  if (select count(*) from public.bookkeeping_contacts where book_id=p_book)>=1000 then raise exception 'BOOKS_LIMIT';end if;
  insert into public.bookkeeping_contacts(id,book_id,kind,name,reference,email,phone,address,notes) values(p_contact,p_book,p_data->>'kind',btrim(p_data->>'name'),coalesce(p_data->>'reference',''),coalesce(p_data->>'email',''),coalesce(p_data->>'phone',''),coalesce(p_data->>'address',''),coalesce(p_data->>'notes',''));
 end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'contact',left(coalesce(p_data->>'kind','Account')||' account '||p_contact::text||' saved: '||coalesce(p_data->>'name',''),500));return p_contact;
exception when unique_violation then raise exception 'BOOKS_CONTACT_EXISTS';
end;$$;
-- Payments and document reversals derive their account from the original document.
-- Cash entries and their reversals derive it from the original paid entry.
create function public.bookkeeping_contact_for(p_journal uuid) returns uuid language sql stable security definer set search_path='' as $$select l.contact_id from public.bookkeeping_journals j join public.bookkeeping_contact_links l on l.journal_id=coalesce(j.document_id,j.reversal_of,j.id) where j.id=p_journal$$;
create function public.bookkeeping_contact_opening_paid(p_book uuid,p_contact uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when c.kind='customer' then l.credit-l.debit else l.debit-l.credit end),0)::bigint from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id join public.bookkeeping_contacts c on c.id=p_contact and c.book_id=p_book where j.book_id=p_book and l.account=case when c.kind='customer' then 'receivable' else 'payable' end and public.bookkeeping_contact_for(j.id)=p_contact and (j.kind in ('opening-receipt','opening-bill-payment') or j.reversal_of in (select id from public.bookkeeping_journals where book_id=p_book and kind in ('opening-receipt','opening-bill-payment')))
$$;
create function public.bookkeeping_contact_opening(p_book uuid,p_contact uuid,p_amount bigint) returns void language plpgsql security definer set search_path='' as $$declare c public.bookkeeping_contacts;available bigint;other bigint;paid bigint;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;select * into c from public.bookkeeping_contacts where id=p_contact and book_id=p_book;if not found then raise exception 'BOOKS_CONTACT';end if;
 if p_amount is null or p_amount<0 or p_amount>100000000000 then raise exception 'BOOKS_INPUT';end if;
 select coalesce(sum(case when c.kind='customer' then l.debit-l.credit else l.credit-l.debit end),0) into available from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and j.kind='opening' and l.account=case when c.kind='customer' then 'receivable' else 'payable' end;
 select coalesce(sum(o.amount),0) into other from public.bookkeeping_contact_openings o join public.bookkeeping_contacts p on p.id=o.contact_id where o.book_id=p_book and p.kind=c.kind and p.id<>p_contact;
 paid:=public.bookkeeping_contact_opening_paid(p_book,p_contact);
 if p_amount+other>available or p_amount<paid then raise exception 'BOOKS_CONTACT_OPENING';end if;
 insert into public.bookkeeping_contact_openings(contact_id,book_id,amount) values(p_contact,p_book,p_amount) on conflict(contact_id) do update set amount=excluded.amount;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'contact-opening','Allocated existing opening balance to '||p_contact::text||' '||c.name||': '||p_amount::text||' pence');
end;$$;
create function public.bookkeeping_link_contact(p_book uuid,p_journal uuid,p_contact uuid) returns void language plpgsql security definer set search_path='' as $$declare j public.bookkeeping_journals;c public.bookkeeping_contacts;expected text;amount bigint;remaining bigint;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;select * into j from public.bookkeeping_journals where id=p_journal and book_id=p_book;
 if not found or j.kind not in ('invoice','bill','income','expense','equipment','property','opening-receipt','opening-bill-payment') then raise exception 'BOOKS_CONTACT';end if;
 expected:=case when j.kind in ('invoice','income','opening-receipt') then 'customer' else 'supplier' end;
 if p_contact is not null then
  select * into c from public.bookkeeping_contacts where id=p_contact and book_id=p_book;
  if not found or c.kind<>expected then raise exception 'BOOKS_CONTACT_TYPE';end if;
  if j.kind in ('opening-receipt','opening-bill-payment') then
   select coalesce(sum(case when c.kind='customer' then l.credit-l.debit else l.debit-l.credit end),0) into amount from public.bookkeeping_lines l where l.journal_id=j.id and l.account=case when c.kind='customer' then 'receivable' else 'payable' end;
   select coalesce((select o.amount from public.bookkeeping_contact_openings o where contact_id=c.id),0)-public.bookkeeping_contact_opening_paid(p_book,c.id) into remaining;
   if public.bookkeeping_contact_for(j.id)=p_contact then remaining:=remaining+amount;end if;
   if amount>remaining then raise exception 'BOOKS_CONTACT_OPENING';end if;
  end if;
  insert into public.bookkeeping_contact_links(journal_id,book_id,contact_id) values(j.id,p_book,c.id) on conflict(journal_id) do update set contact_id=excluded.contact_id;
 else delete from public.bookkeeping_contact_links where journal_id=j.id;end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'contact-link',left('Entry '||j.id::text||' account assignment changed: '||j.description||' → '||coalesce(c.name,'Unassigned')||'. Journal amounts unchanged.',500));
end;$$;
-- Preserve the original atomic ledger engine, but remove its direct client entry point.
alter function public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text) rename to bookkeeping_post_core;
revoke execute on function public.bookkeeping_post_core(uuid,uuid,date,text,text,jsonb,uuid,text,text) from authenticated;
create function public.bookkeeping_post(p_book uuid,p_request uuid,p_date date,p_description text,p_kind text,p_lines jsonb,p_document uuid default null,p_counterparty text default '',p_reference text default '',p_contact uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;c public.bookkeeping_contacts;party uuid;expected text;remaining bigint;payment bigint;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 select id into result from public.bookkeeping_journals where book_id=p_book and request_id=p_request;if found then return result;end if;
 if p_kind in ('invoice-payment','bill-payment') then
  party:=public.bookkeeping_contact_for(p_document);
  if p_contact is not null and p_contact is distinct from party then raise exception 'BOOKS_CONTACT_TYPE';end if;
 else party:=p_contact;end if;
 if p_kind in ('invoice','bill','opening-receipt','opening-bill-payment') and party is null then raise exception 'BOOKS_CONTACT_REQUIRED';end if;
 if party is not null then
  expected:=case when p_kind in ('invoice','income','invoice-payment','opening-receipt') then 'customer' when p_kind in ('bill','expense','equipment','property','bill-payment','opening-bill-payment') then 'supplier' else null end;
  select * into c from public.bookkeeping_contacts where id=party and book_id=p_book;
  if not found or expected is null or c.kind<>expected then raise exception 'BOOKS_CONTACT_TYPE';end if;
  if c.archived and p_kind not in ('invoice-payment','bill-payment','opening-receipt','opening-bill-payment') then raise exception 'BOOKS_CONTACT_ARCHIVED';end if;
  if p_kind in ('opening-receipt','opening-bill-payment') then
   select coalesce((select amount from public.bookkeeping_contact_openings where contact_id=party),0)-public.bookkeeping_contact_opening_paid(p_book,party) into remaining;
   select coalesce(sum(case when expected='customer' then (e->>'credit')::bigint else (e->>'debit')::bigint end),0) into payment from jsonb_array_elements(p_lines) e where e->>'account'=case when expected='customer' then 'receivable' else 'payable' end;
   if payment<=0 or payment>remaining then raise exception 'BOOKS_CONTACT_OPENING';end if;
  end if;
 end if;
 result:=public.bookkeeping_post_core(p_book,p_request,p_date,p_description,p_kind,p_lines,p_document,coalesce(c.name,p_counterparty),p_reference);
 if party is not null and p_kind not in ('invoice-payment','bill-payment') then insert into public.bookkeeping_contact_links(journal_id,book_id,contact_id) values(result,p_book,party);end if;
 return result;
end;$$;
alter function public.bookkeeping_read(uuid) rename to bookkeeping_read_core;
revoke execute on function public.bookkeeping_read_core(uuid) from authenticated;
create function public.bookkeeping_read(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 result:=public.bookkeeping_read_core(p_book);
 return result||jsonb_build_object('contacts',(select coalesce(jsonb_agg(to_jsonb(c)-'created_at' order by c.name,c.id),'[]') from public.bookkeeping_contacts c where book_id=p_book),'contact_links',(select coalesce(jsonb_agg(jsonb_build_object('journal_id',l.journal_id,'contact_id',l.contact_id)),'[]') from public.bookkeeping_contact_links l where book_id=p_book),'contact_openings',(select coalesce(jsonb_agg(jsonb_build_object('contact_id',o.contact_id,'amount',o.amount)),'[]') from public.bookkeeping_contact_openings o where book_id=p_book));
end;$$;
alter table public.bookkeeping_contacts enable row level security;alter table public.bookkeeping_contact_links enable row level security;alter table public.bookkeeping_contact_openings enable row level security;
revoke all on public.bookkeeping_contacts,public.bookkeeping_contact_links,public.bookkeeping_contact_openings from public,anon,authenticated;
grant select on public.bookkeeping_contacts,public.bookkeeping_contact_links,public.bookkeeping_contact_openings to authenticated;
create policy bookkeeping_contacts_read on public.bookkeeping_contacts for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_contact_links_read on public.bookkeeping_contact_links for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_contact_openings_read on public.bookkeeping_contact_openings for select to authenticated using(public.bookkeeping_owns(book_id));
revoke all on function public.bookkeeping_save_contact(uuid,uuid,jsonb,integer,boolean),public.bookkeeping_contact_for(uuid),public.bookkeeping_contact_opening_paid(uuid,uuid),public.bookkeeping_contact_opening(uuid,uuid,bigint),public.bookkeeping_link_contact(uuid,uuid,uuid),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid),public.bookkeeping_read(uuid) from public,anon;
revoke all on function public.bookkeeping_contact_for(uuid),public.bookkeeping_contact_opening_paid(uuid,uuid) from authenticated;
grant execute on function public.bookkeeping_save_contact(uuid,uuid,jsonb,integer,boolean),public.bookkeeping_contact_opening(uuid,uuid,bigint),public.bookkeeping_link_contact(uuid,uuid,uuid),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid),public.bookkeeping_read(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
