-- Apply once after the existing migrations. GBP bookkeeping, not a tax-filing service.
begin;
create table public.bookkeeping_books (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 160),type text not null check(type in ('sole-trader','landlord')),
 start_date date not null check(start_date between date '2000-01-01' and date '2099-12-31'),locked_through date,opening_set boolean not null default false,created_at timestamptz not null default now()
);
create table public.bookkeeping_journals (
 id uuid primary key default gen_random_uuid(),book_id uuid not null references public.bookkeeping_books(id) on delete cascade,
 request_id uuid not null,entry_date date not null,description text not null check(char_length(btrim(description)) between 1 and 160),
 kind text not null check(kind in ('opening','income','expense','owner-in','drawings','loan-in','mortgage-in','opening-receipt','opening-bill-payment','loan-payment','mortgage-payment','equipment','property','deposit-in','deposit-out','invoice','bill','invoice-payment','bill-payment','transfer','depreciation','reversal')),
 document_id uuid,counterparty text not null default '' check(char_length(counterparty)<=120),reference text not null default '' check(char_length(reference)<=80),reversal_of uuid,created_at timestamptz not null default now(),
 unique(id,book_id),unique(book_id,request_id),unique(reversal_of),foreign key(document_id,book_id) references public.bookkeeping_journals(id,book_id),foreign key(reversal_of,book_id) references public.bookkeeping_journals(id,book_id)
);
create index bookkeeping_journals_book_date on public.bookkeeping_journals(book_id,entry_date,id);
create table public.bookkeeping_lines (
 id bigint generated always as identity primary key,journal_id uuid not null,book_id uuid not null,
 account text not null check(account in ('bank','cash','receivable','equipment','property','payable','loan','mortgage','deposits','capital','drawings','sales','rent','general','repairs','insurance','fees','utilities','travel','interest','depreciation')),
 debit bigint not null check(debit between 0 and 100000000000),credit bigint not null check(credit between 0 and 100000000000),check((debit>0 and credit=0) or (credit>0 and debit=0)),
 foreign key(journal_id,book_id) references public.bookkeeping_journals(id,book_id) on delete cascade
);
create index bookkeeping_lines_book on public.bookkeeping_lines(book_id,journal_id);
create table public.bookkeeping_reconciliations (
 id uuid primary key default gen_random_uuid(),book_id uuid not null references public.bookkeeping_books(id) on delete cascade,statement_date date not null,
 opening_balance bigint not null check(abs(opening_balance)<=100000000000),closing_balance bigint not null check(abs(closing_balance)<=100000000000),journal_ids uuid[] not null,created_at timestamptz not null default now(),unique(book_id,statement_date)
);
create table public.bookkeeping_audit (
 id bigint generated always as identity primary key,book_id uuid not null references public.bookkeeping_books(id) on delete cascade,action text not null,description text not null,created_at timestamptz not null default now()
);
create function public.bookkeeping_owns(p_book uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.bookkeeping_books where id=p_book and owner_id=auth.uid())$$;
create function public.bookkeeping_paid() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.subscriptions where user_id=auth.uid() and status in ('active','trialing') and current_period_end>now())$$;
create function public.bookkeeping_create(p_name text,p_type text,p_start date) returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 if auth.uid() is null then raise exception 'BOOKS_AUTH';end if;
 if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,88));
 if (select count(*) from public.bookkeeping_books where owner_id=auth.uid())>=20 then raise exception 'BOOKS_LIMIT';end if;
 insert into public.bookkeeping_books(owner_id,name,type,start_date) values(auth.uid(),btrim(p_name),p_type,p_start) returning id into result;
 insert into public.bookkeeping_audit(book_id,action,description) values(result,'created','Book created');return result;
end;$$;
-- A deferred database constraint verifies every committed journal, including RPC writes.
create function public.bookkeeping_balanced() returns trigger language plpgsql security definer set search_path='' as $$declare jid uuid;bid uuid;n integer;d bigint;c bigint;begin
 if tg_table_name='bookkeeping_journals' then jid:=new.id;bid:=new.book_id;else jid:=new.journal_id;bid:=new.book_id;end if;
 select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from public.bookkeeping_lines where journal_id=jid and book_id=bid;
 if n<2 or n>12 or d<>c or d=0 then raise exception 'BOOKS_UNBALANCED';end if;return null;
end;$$;
create constraint trigger bookkeeping_journal_balanced after insert on public.bookkeeping_journals deferrable initially deferred for each row execute function public.bookkeeping_balanced();
create constraint trigger bookkeeping_lines_balanced after insert on public.bookkeeping_lines deferrable initially deferred for each row execute function public.bookkeeping_balanced();
create function public.bookkeeping_post(p_book uuid,p_request uuid,p_date date,p_description text,p_kind text,p_lines jsonb,p_document uuid default null,p_counterparty text default '',p_reference text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookkeeping_books;result uuid;item jsonb;total_d bigint:=0;total_c bigint:=0;n integer:=0;doc public.bookkeeping_journals;outstanding bigint;payment bigint;rec public.bookkeeping_reconciliations;
begin
 set constraints public.bookkeeping_journal_balanced, public.bookkeeping_lines_balanced deferred;
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;
 if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 select * into b from public.bookkeeping_books where id=p_book for update;
 select id into result from public.bookkeeping_journals where book_id=p_book and request_id=p_request;if found then return result;end if;
 if p_kind='reversal' then raise exception 'BOOKS_INPUT';end if;
 if p_date is null or p_date<b.start_date or p_date>date '2099-12-31' or p_date>current_date then raise exception 'BOOKS_DATE';end if;
 if b.locked_through is not null and p_date<=b.locked_through then raise exception 'BOOKS_LOCKED';end if;
 -- No backdated bank movement can invalidate an already signed-off statement.
 if exists(select 1 from public.bookkeeping_reconciliations where book_id=p_book and statement_date>=p_date) and exists(select 1 from jsonb_array_elements(p_lines) e where e->>'account'='bank') then raise exception 'BOOKS_RECONCILED';end if;
 if (select count(*) from public.bookkeeping_journals where book_id=p_book)>=5000 then raise exception 'BOOKS_LIMIT';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 2 and 12 then raise exception 'BOOKS_UNBALANCED';end if;
 for item in select * from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(item->'debit')<>'number' or jsonb_typeof(item->'credit')<>'number' or (item->>'debit')::numeric<>trunc((item->>'debit')::numeric) or (item->>'credit')::numeric<>trunc((item->>'credit')::numeric) then raise exception 'BOOKS_INPUT';end if;
  total_d:=total_d+(item->>'debit')::bigint;total_c:=total_c+(item->>'credit')::bigint;n:=n+1;
 end loop;
 if total_d<>total_c or total_d<=0 then raise exception 'BOOKS_UNBALANCED';end if;
 if p_kind='opening' then
  if b.opening_set or exists(select 1 from public.bookkeeping_journals where book_id=p_book) then raise exception 'BOOKS_OPENING';end if;
  if p_date<>b.start_date or exists(select 1 from jsonb_array_elements(p_lines) e where e->>'account' not in ('bank','cash','receivable','equipment','property','payable','loan','mortgage','deposits','capital')) then raise exception 'BOOKS_INPUT';end if;
 elsif not b.opening_set then raise exception 'BOOKS_OPENING_REQUIRED';end if;
 if p_kind in ('invoice-payment','bill-payment') then
  select * into doc from public.bookkeeping_journals where id=p_document and book_id=p_book;
  if not found or doc.kind<>(case when p_kind='invoice-payment' then 'invoice' else 'bill' end) or p_date<doc.entry_date or exists(select 1 from public.bookkeeping_journals where reversal_of=doc.id) then raise exception 'BOOKS_DOCUMENT';end if;
  select coalesce(sum(case when doc.kind='invoice' then l.debit-l.credit else l.credit-l.debit end),0) into outstanding from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and (j.id=doc.id or j.document_id=doc.id) and l.account=case when doc.kind='invoice' then 'receivable' else 'payable' end;
  select coalesce(sum(case when doc.kind='invoice' then (e->>'credit')::bigint else (e->>'debit')::bigint end),0) into payment from jsonb_array_elements(p_lines) e where e->>'account'=case when doc.kind='invoice' then 'receivable' else 'payable' end;
  if payment<=0 or payment>outstanding then raise exception 'BOOKS_OVERPAYMENT';end if;
 elsif p_document is not null then raise exception 'BOOKS_DOCUMENT';end if;
 if p_kind in ('opening-receipt','opening-bill-payment') then
  select coalesce(sum(case when p_kind='opening-receipt' then l.debit-l.credit else l.credit-l.debit end),0) into outstanding from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and l.account=(case when p_kind='opening-receipt' then 'receivable' else 'payable' end) and (j.kind in ('opening','opening-receipt','opening-bill-payment') or j.reversal_of in (select id from public.bookkeeping_journals where book_id=p_book and kind in ('opening-receipt','opening-bill-payment')));
  select coalesce(sum(case when p_kind='opening-receipt' then (e->>'credit')::bigint else (e->>'debit')::bigint end),0) into payment from jsonb_array_elements(p_lines) e where e->>'account'=(case when p_kind='opening-receipt' then 'receivable' else 'payable' end);
  if payment<=0 or payment>outstanding then raise exception 'BOOKS_OVERPAYMENT';end if;
 end if;
 if p_kind in ('loan-payment','mortgage-payment','depreciation','deposit-out') then
  select coalesce(sum(case when p_kind='depreciation' then l.debit-l.credit else l.credit-l.debit end),0) into outstanding from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and j.entry_date<=p_date and l.account=(case when p_kind='loan-payment' then 'loan' when p_kind='mortgage-payment' then 'mortgage' when p_kind='depreciation' then 'equipment' else 'deposits' end);
  select coalesce(sum(case when p_kind='depreciation' then (e->>'credit')::bigint else (e->>'debit')::bigint end),0) into payment from jsonb_array_elements(p_lines) e where e->>'account'=(case when p_kind='loan-payment' then 'loan' when p_kind='mortgage-payment' then 'mortgage' when p_kind='depreciation' then 'equipment' else 'deposits' end);
  if payment>outstanding then raise exception 'BOOKS_OVERPAYMENT';end if;
 end if;
 result:=gen_random_uuid();
 insert into public.bookkeeping_journals(id,book_id,request_id,entry_date,description,kind,document_id,counterparty,reference) values(result,p_book,p_request,p_date,p_description,p_kind,case when p_kind in ('invoice','bill') then result else p_document end,p_counterparty,p_reference);
 insert into public.bookkeeping_lines(journal_id,book_id,account,debit,credit) select result,p_book,e->>'account',(e->>'debit')::bigint,(e->>'credit')::bigint from jsonb_array_elements(p_lines) e;
 if p_kind='opening' then update public.bookkeeping_books set opening_set=true where id=p_book;end if;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'posted',p_description);return result;
end;$$;
create function public.bookkeeping_zero_opening(p_book uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 if exists(select 1 from public.bookkeeping_journals where book_id=p_book) or exists(select 1 from public.bookkeeping_books where id=p_book and opening_set) then raise exception 'BOOKS_OPENING';end if;
 update public.bookkeeping_books set opening_set=true where id=p_book;insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'opening','Zero opening balances confirmed');
end;$$;
create function public.bookkeeping_reverse(p_book uuid,p_journal uuid,p_request uuid,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookkeeping_books;j public.bookkeeping_journals;result uuid;code text;normal_balance bigint;reversed_change bigint;begin
 set constraints public.bookkeeping_journal_balanced, public.bookkeeping_lines_balanced deferred;
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 select * into b from public.bookkeeping_books where id=p_book for update;
 select id into result from public.bookkeeping_journals where book_id=p_book and request_id=p_request;if found then return result;end if;
 select * into j from public.bookkeeping_journals where id=p_journal and book_id=p_book;
 if not found or j.kind in ('opening','reversal') or exists(select 1 from public.bookkeeping_journals where reversal_of=j.id) then raise exception 'BOOKS_REVERSAL';end if;
 if j.kind in ('invoice','bill') and exists(select 1 from public.bookkeeping_journals p where p.document_id=j.id and p.entry_date>p_date) then raise exception 'BOOKS_DATE';end if;
 if char_length(btrim(p_reason)) not between 1 and 160 then raise exception 'BOOKS_INPUT';end if;
 if p_date is null or p_date<j.entry_date or p_date>current_date then raise exception 'BOOKS_DATE';end if;
 if b.locked_through is not null and p_date<=b.locked_through then raise exception 'BOOKS_LOCKED';end if;
 if exists(select 1 from public.bookkeeping_reconciliations where book_id=p_book and statement_date>=p_date) and exists(select 1 from public.bookkeeping_lines where journal_id=j.id and account='bank') then raise exception 'BOOKS_RECONCILED';end if;
 if j.kind in ('invoice','bill') and exists(select 1 from public.bookkeeping_journals p where p.document_id=j.id and p.id<>j.id and p.kind in ('invoice-payment','bill-payment') and not exists(select 1 from public.bookkeeping_journals r where r.reversal_of=p.id)) then raise exception 'BOOKS_PAYMENTS_FIRST';end if;
 for code in select unnest(array['loan','mortgage','deposits','equipment']) loop
  select coalesce(sum(case when code='equipment' then l.debit-l.credit else l.credit-l.debit end),0) into normal_balance from public.bookkeeping_lines l where l.book_id=p_book and l.account=code;
  select coalesce(sum(case when code='equipment' then l.debit-l.credit else l.credit-l.debit end),0) into reversed_change from public.bookkeeping_lines l where l.journal_id=j.id and l.account=code;
  if normal_balance-reversed_change<0 then raise exception 'BOOKS_DEPENDANTS';end if;
 end loop;
 if (select count(*) from public.bookkeeping_journals where book_id=p_book)>=5000 then raise exception 'BOOKS_LIMIT';end if;
 result:=gen_random_uuid();insert into public.bookkeeping_journals(id,book_id,request_id,entry_date,description,kind,document_id,reversal_of,counterparty,reference) values(result,p_book,p_request,p_date,p_reason,'reversal',j.document_id,j.id,j.counterparty,j.reference);
 insert into public.bookkeeping_lines(journal_id,book_id,account,debit,credit) select result,p_book,account,credit,debit from public.bookkeeping_lines where journal_id=j.id;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'reversed',p_reason);return result;
end;$$;
create function public.bookkeeping_lock(p_book uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$declare b public.bookkeeping_books;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 select * into b from public.bookkeeping_books where id=p_book for update;
 if p_date is null or not b.opening_set or p_date<b.start_date or p_date>current_date or (b.locked_through is not null and p_date<=b.locked_through) then raise exception 'BOOKS_DATE';end if;
 update public.bookkeeping_books set locked_through=p_date where id=p_book;insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'locked','Entries locked through '||p_date::text);
end;$$;
create function public.bookkeeping_reconcile(p_book uuid,p_date date,p_opening bigint,p_closing bigint,p_journals uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookkeeping_books;previous public.bookkeeping_reconciliations;opening bigint;movement bigint;result uuid;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 select * into b from public.bookkeeping_books where id=p_book for update;
 if p_date is null or not b.opening_set or p_date<b.start_date or p_date>current_date then raise exception 'BOOKS_DATE';end if;
 select * into previous from public.bookkeeping_reconciliations where book_id=p_book order by statement_date desc limit 1;
 if found then if p_date<=previous.statement_date then raise exception 'BOOKS_RECONCILED';end if;opening:=previous.closing_balance;
 else select coalesce(sum(l.debit-l.credit),0) into opening from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where j.book_id=p_book and j.kind='opening' and l.account='bank';end if;
 if p_opening<>opening or cardinality(p_journals)>5000 or cardinality(p_journals)<>(select count(distinct x) from unnest(p_journals) x) then raise exception 'BOOKS_RECONCILE';end if;
 if exists(select 1 from unnest(p_journals) x where not exists(select 1 from public.bookkeeping_journals j join public.bookkeeping_lines l on l.journal_id=j.id where j.id=x and j.book_id=p_book and j.kind<>'opening' and j.entry_date<=p_date and l.account='bank')) or exists(select 1 from public.bookkeeping_reconciliations r where r.book_id=p_book and r.journal_ids&&p_journals) then raise exception 'BOOKS_RECONCILE';end if;
 select coalesce(sum(debit-credit),0) into movement from public.bookkeeping_lines where book_id=p_book and journal_id=any(p_journals) and account='bank';
 if opening+movement<>p_closing then raise exception 'BOOKS_RECONCILE';end if;
 insert into public.bookkeeping_reconciliations(book_id,statement_date,opening_balance,closing_balance,journal_ids) values(p_book,p_date,p_opening,p_closing,p_journals) returning id into result;
 insert into public.bookkeeping_audit(book_id,action,description) values(p_book,'reconciled','Bank statement reconciled through '||p_date::text);return result;
end;$$;
create function public.bookkeeping_read(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;
 return jsonb_build_object('book',(select to_jsonb(b)-'owner_id' from public.bookkeeping_books b where id=p_book),'journals',(select coalesce(jsonb_agg(to_jsonb(j) order by j.entry_date,j.created_at,j.id),'[]') from public.bookkeeping_journals j where book_id=p_book),'lines',(select coalesce(jsonb_agg(to_jsonb(l)-'id'),'[]') from public.bookkeeping_lines l where book_id=p_book),'reconciliations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.statement_date),'[]') from public.bookkeeping_reconciliations r where book_id=p_book),'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select action,description,created_at from public.bookkeeping_audit where book_id=p_book order by id desc limit 100) a),'canWrite',public.bookkeeping_paid());
end;$$;
alter table public.bookkeeping_books enable row level security;alter table public.bookkeeping_journals enable row level security;alter table public.bookkeeping_lines enable row level security;alter table public.bookkeeping_reconciliations enable row level security;alter table public.bookkeeping_audit enable row level security;
revoke all on public.bookkeeping_books,public.bookkeeping_journals,public.bookkeeping_lines,public.bookkeeping_reconciliations,public.bookkeeping_audit from public,anon,authenticated;
grant select on public.bookkeeping_books,public.bookkeeping_journals,public.bookkeeping_lines,public.bookkeeping_reconciliations,public.bookkeeping_audit to authenticated;
create policy bookkeeping_books_read on public.bookkeeping_books for select to authenticated using(owner_id=auth.uid());
create policy bookkeeping_journals_read on public.bookkeeping_journals for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_lines_read on public.bookkeeping_lines for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_reconciliation_read on public.bookkeeping_reconciliations for select to authenticated using(public.bookkeeping_owns(book_id));
create policy bookkeeping_audit_read on public.bookkeeping_audit for select to authenticated using(public.bookkeeping_owns(book_id));
revoke all on function public.bookkeeping_owns(uuid),public.bookkeeping_paid(),public.bookkeeping_balanced(),public.bookkeeping_create(text,text,date),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text),public.bookkeeping_zero_opening(uuid),public.bookkeeping_reverse(uuid,uuid,uuid,date,text),public.bookkeeping_lock(uuid,date),public.bookkeeping_reconcile(uuid,date,bigint,bigint,uuid[]),public.bookkeeping_read(uuid) from public,anon;
grant execute on function public.bookkeeping_owns(uuid),public.bookkeeping_paid(),public.bookkeeping_create(text,text,date),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text),public.bookkeeping_zero_opening(uuid),public.bookkeeping_reverse(uuid,uuid,uuid,date,text),public.bookkeeping_lock(uuid,date),public.bookkeeping_reconcile(uuid,date,bigint,bigint,uuid[]),public.bookkeeping_read(uuid) to authenticated;
commit;
