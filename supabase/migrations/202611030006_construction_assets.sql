-- Apply after premium bookkeeping. Project hierarchy (005) is needed for optional planning links.
begin;
alter table public.bookkeeping_lines drop constraint bookkeeping_lines_account_check;
alter table public.bookkeeping_lines add constraint bookkeeping_lines_account_check check(account in ('bank','cash','receivable','equipment','property','construction','accumulated_depreciation','payable','loan','mortgage','deposits','capital','drawings','sales','rent','general','repairs','insurance','fees','utilities','travel','interest','depreciation'));
alter table public.bookkeeping_journals drop constraint bookkeeping_journals_kind_check;
alter table public.bookkeeping_journals add constraint bookkeeping_journals_kind_check check(kind in ('opening','income','expense','owner-in','drawings','loan-in','mortgage-in','opening-receipt','opening-bill-payment','loan-payment','mortgage-payment','equipment','property','deposit-in','deposit-out','invoice','bill','invoice-payment','bill-payment','transfer','depreciation','reversal','asset-cost','asset-complete','asset-depreciation'));
create table public.bookkeeping_cost_projects(
 id uuid primary key,book_id uuid not null references public.bookkeeping_books(id) on delete cascade,parent_id uuid,name text not null check(char_length(btrim(name)) between 1 and 160),description text not null default '' check(char_length(description)<=3000),planning_project_id uuid,status text not null default 'open' check(status in ('open','complete')),version integer not null default 1,created_at timestamptz not null default now(),unique(id,book_id),foreign key(parent_id,book_id) references public.bookkeeping_cost_projects(id,book_id)
);
create unique index bookkeeping_cost_planning on public.bookkeeping_cost_projects(planning_project_id) where planning_project_id is not null;
create table public.bookkeeping_project_costs(
 id uuid primary key,book_id uuid not null,project_id uuid not null,source_journal_id uuid not null,posting_journal_id uuid,amount bigint not null check(amount between 1 and 100000000000),classification text not null check(classification in ('capital','expense')),source_account text not null,allocated_on date not null,voided boolean not null default false,voided_on date,reversal_journal_id uuid,created_at timestamptz not null default now(),foreign key(project_id,book_id) references public.bookkeeping_cost_projects(id,book_id),foreign key(source_journal_id,book_id) references public.bookkeeping_journals(id,book_id),foreign key(posting_journal_id,book_id) references public.bookkeeping_journals(id,book_id),foreign key(reversal_journal_id,book_id) references public.bookkeeping_journals(id,book_id)
);
create unique index bookkeeping_project_cost_source on public.bookkeeping_project_costs(source_journal_id) where not voided;
create table public.bookkeeping_assets(
 id uuid primary key,book_id uuid not null,project_id uuid not null unique,name text not null,account text not null check(account in ('equipment','property')),cost bigint not null check(cost between 1 and 100000000000),available_date date not null,life_months integer not null check(life_months between 0 and 1200),residual bigint not null check(residual between 0 and cost),depreciated bigint not null default 0 check(depreciated between 0 and cost-residual),depreciated_through date,completion_journal_id uuid not null unique,created_at timestamptz not null default now(),foreign key(project_id,book_id) references public.bookkeeping_cost_projects(id,book_id),foreign key(completion_journal_id,book_id) references public.bookkeeping_journals(id,book_id),check(account='equipment' or life_months=0)
);
create table public.bookkeeping_asset_charges(
 id uuid primary key,book_id uuid not null references public.bookkeeping_books(id),asset_id uuid not null references public.bookkeeping_assets(id),journal_id uuid not null unique references public.bookkeeping_journals(id),through_date date not null,amount bigint not null check(amount>0),unique(asset_id,through_date)
);
-- All financial data stays private to the book owner, even in a shared planning workspace.
do $$declare t text;begin foreach t in array array['bookkeeping_cost_projects','bookkeeping_project_costs','bookkeeping_assets','bookkeeping_asset_charges'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy owner_read on public.%I for select to authenticated using(public.bookkeeping_owns(book_id))',t);end loop;end;$$;
create function public.bookkeeping_asset_action(p_book uuid,p_action text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare project public.bookkeeping_cost_projects;parent public.bookkeeping_cost_projects;cost_row public.bookkeeping_project_costs;asset public.bookkeeping_assets;source public.bookkeeping_journals;result uuid;request uuid;v_date date;amount bigint;total bigint;account text;lines jsonb;v_id uuid;months integer;target bigint;v_through date;planning_owner uuid;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 if not exists(select 1 from public.bookkeeping_books where id=p_book and opening_set) then raise exception 'BOOKS_OPENING_REQUIRED';end if;
 v_id:=(p_data->>'id')::uuid;request:=(p_data->>'request_id')::uuid;
 if p_action='project.save' then
  if v_id is null or nullif(btrim(p_data->>'name'),'') is null or char_length(p_data->>'name')>160 or char_length(coalesce(p_data->>'description',''))>3000 then raise exception 'BOOKS_INPUT';end if;
  select * into project from public.bookkeeping_cost_projects where id=v_id and book_id=p_book;
  if found then
   if project.version is distinct from (p_data->>'version')::integer then raise exception 'BOOKS_ASSET_CHANGED';end if;
   if project.parent_id is distinct from (p_data->>'parent_id')::uuid or project.planning_project_id is distinct from (p_data->>'planning_project_id')::uuid then raise exception 'BOOKS_ASSET_LINK';end if;
   update public.bookkeeping_cost_projects set name=btrim(p_data->>'name'),description=coalesce(p_data->>'description',''),version=version+1 where id=v_id;
  else
   if (select count(*) from public.bookkeeping_cost_projects where book_id=p_book)>=100 then raise exception 'BOOKS_LIMIT';end if;
   if p_data->>'parent_id' is not null then select * into parent from public.bookkeeping_cost_projects where id=(p_data->>'parent_id')::uuid and book_id=p_book;if not found or parent.parent_id is not null or parent.status<>'open' then raise exception 'BOOKS_ASSET_LINK';end if;end if;
   if p_data->>'planning_project_id' is not null then
    if to_regclass('public.project_projects') is null then raise exception 'BOOKS_ASSET_LINK';end if;
    execute 'select w.owner_id from public.project_projects p join public.project_workspaces w on w.id=p.workspace_id where p.id=$1' into planning_owner using (p_data->>'planning_project_id')::uuid;
    if planning_owner is distinct from auth.uid() then raise exception 'BOOKS_ASSET_LINK';end if;
   end if;
   insert into public.bookkeeping_cost_projects(id,book_id,parent_id,name,description,planning_project_id) values(v_id,p_book,(p_data->>'parent_id')::uuid,btrim(p_data->>'name'),coalesce(p_data->>'description',''),(p_data->>'planning_project_id')::uuid);
  end if;
  insert into public.bookkeeping_audit(book_id,action,description) values(p_book,p_action,'Project details saved');return v_id;
 end if;
 if request is null then raise exception 'BOOKS_INPUT';end if;
 -- Retries return the original result before any mutable-state validation.
 if p_action in ('cost.add','cost.allocate') then select id into result from public.bookkeeping_project_costs where id=request and book_id=p_book;if found then return result;end if;end if;
 if p_action='asset.complete' then select id into result from public.bookkeeping_assets where id=request and book_id=p_book;if found then return result;end if;end if;
 if p_action='asset.depreciate' then select id into result from public.bookkeeping_asset_charges where id=request and book_id=p_book;if found then return result;end if;end if;
 if p_action in ('cost.add','cost.allocate','asset.complete','asset.depreciate') and exists(select 1 from public.bookkeeping_journals where book_id=p_book and request_id=request) then raise exception 'BOOKS_ASSET_CHANGED';end if;
 v_date:=(p_data->>'date')::date;
 if v_date is null or v_date>current_date or not exists(select 1 from public.bookkeeping_books where id=p_book and start_date<=v_date and (locked_through is null or locked_through<v_date)) then raise exception 'BOOKS_DATE';end if;
 if p_action='asset.depreciate' then
  select * into asset from public.bookkeeping_assets where id=v_id and book_id=p_book for update;if not found or asset.life_months=0 then raise exception 'BOOKS_ASSET_POLICY';end if;
  if v_date<>(date_trunc('month',v_date)+interval '1 month - 1 day')::date or (asset.depreciated_through is not null and v_date<=asset.depreciated_through) then raise exception 'BOOKS_ASSET_PERIOD';end if;
  months:=least(asset.life_months,greatest(0,(extract(year from v_date)::int-extract(year from asset.available_date)::int)*12+extract(month from v_date)::int-extract(month from asset.available_date)::int));
  target:=round((asset.cost-asset.residual)::numeric*months/asset.life_months);amount:=target-asset.depreciated;if amount<=0 then raise exception 'BOOKS_ASSET_PERIOD';end if;
  result:=public.bookkeeping_post_core(p_book,request,v_date,'Depreciation: '||left(asset.name,140),'asset-depreciation',jsonb_build_array(jsonb_build_object('account','depreciation','debit',amount,'credit',0),jsonb_build_object('account','accumulated_depreciation','debit',0,'credit',amount)));
  insert into public.bookkeeping_asset_charges(id,book_id,asset_id,journal_id,through_date,amount) values(request,p_book,asset.id,result,v_date,amount);
  update public.bookkeeping_assets set depreciated=target,depreciated_through=v_date where id=asset.id;return request;
 end if;
 if p_action='cost.reverse' then
  select * into cost_row from public.bookkeeping_project_costs where id=v_id and book_id=p_book for update;if not found then raise exception 'BOOKS_ASSET_LINK';end if;if cost_row.voided then return cost_row.id;end if;if exists(select 1 from public.bookkeeping_journals where book_id=p_book and request_id=request) then raise exception 'BOOKS_ASSET_CHANGED';end if;
  select * into project from public.bookkeeping_cost_projects where id=cost_row.project_id;
  if project.status<>'open' then raise exception 'BOOKS_ASSET_CLOSED';end if;
  if cost_row.posting_journal_id is not null then result:=public.bookkeeping_reverse_before_assets(p_book,cost_row.posting_journal_id,request,v_date,'Project cost correction');end if;
  update public.bookkeeping_project_costs set voided=true,voided_on=v_date,reversal_journal_id=result where id=cost_row.id;
  insert into public.bookkeeping_audit(book_id,action,description) values(p_book,p_action,'Project cost reversed or unassigned');return cost_row.id;
 end if;
 select * into project from public.bookkeeping_cost_projects where id=v_id and book_id=p_book for update;
 if not found then raise exception 'BOOKS_ASSET_LINK';end if;if p_action='project.close' and project.status='complete' then return project.id;end if;if project.status<>'open' then raise exception 'BOOKS_ASSET_CLOSED';end if;
 if p_action='project.close' then
  if exists(select 1 from public.bookkeeping_cost_projects where parent_id=project.id and status<>'complete') then raise exception 'BOOKS_ASSET_CHILDREN';end if;
  if exists(select 1 from public.bookkeeping_project_costs where project_id=project.id and not voided and classification='capital') then raise exception 'BOOKS_ASSET_POLICY';end if;
  update public.bookkeeping_cost_projects set status='complete',version=version+1 where id=project.id;insert into public.bookkeeping_audit(book_id,action,description) values(p_book,p_action,'Project closed without a capital transfer');return project.id;
 end if;
 if p_action='cost.add' then
  amount:=(p_data->>'amount')::bigint;account:=p_data->>'bank';if amount not between 1 and 100000000000 or account not in ('bank','cash') then raise exception 'BOOKS_INPUT';end if;
  result:=public.bookkeeping_post_core(p_book,request,v_date,coalesce(nullif(btrim(p_data->>'description'),''),'Construction: '||left(project.name,140)),'asset-cost',jsonb_build_array(jsonb_build_object('account','construction','debit',amount,'credit',0),jsonb_build_object('account',account,'debit',0,'credit',amount)));
  insert into public.bookkeeping_project_costs(id,book_id,project_id,source_journal_id,posting_journal_id,amount,classification,source_account,allocated_on) values(request,p_book,project.id,result,result,amount,'capital','construction',v_date);return request;
 elsif p_action='cost.allocate' then
  select * into source from public.bookkeeping_journals where id=(p_data->>'source_journal_id')::uuid and book_id=p_book;
  if not found or source.kind not in ('expense','equipment','property','bill') or source.entry_date>v_date or exists(select 1 from public.bookkeeping_journals where reversal_of=source.id) then raise exception 'BOOKS_ASSET_SOURCE';end if;
  if (select count(*) from public.bookkeeping_lines where journal_id=source.id and debit>0)<>1 then raise exception 'BOOKS_ASSET_SOURCE';end if;
  select l.account,l.debit into account,amount from public.bookkeeping_lines l where l.journal_id=source.id and l.debit>0;
  if account not in ('equipment','property','general','repairs','insurance','fees','utilities','travel','interest') or p_data->>'classification' not in ('capital','expense') or (p_data->>'classification'='expense' and account in ('equipment','property')) then raise exception 'BOOKS_ASSET_SOURCE';end if;
  if p_data->>'classification'='capital' then
   if account='equipment' and exists(select 1 from public.bookkeeping_journals j where j.book_id=p_book and j.kind='depreciation' and not exists(select 1 from public.bookkeeping_journals r where r.reversal_of=j.id)) then raise exception 'BOOKS_ASSET_SOURCE';end if;
   result:=public.bookkeeping_post_core(p_book,request,v_date,'Capital allocation: '||left(project.name,130),'asset-cost',jsonb_build_array(jsonb_build_object('account','construction','debit',amount,'credit',0),jsonb_build_object('account',account,'debit',0,'credit',amount)));
  end if;
  insert into public.bookkeeping_project_costs(id,book_id,project_id,source_journal_id,posting_journal_id,amount,classification,source_account,allocated_on) values(request,p_book,project.id,source.id,result,amount,p_data->>'classification',account,v_date);
  insert into public.bookkeeping_audit(book_id,action,description) values(p_book,p_action,'Existing cost assigned; original bank payment not repeated');return request;
 elsif p_action='asset.complete' then
  if p_data->>'confirmed' is distinct from 'true' then raise exception 'BOOKS_ASSET_POLICY';end if;
  if exists(select 1 from public.bookkeeping_cost_projects where parent_id=project.id and status<>'complete') then raise exception 'BOOKS_ASSET_CHILDREN';end if;
  select coalesce(sum(c.amount),0) into amount from public.bookkeeping_project_costs c where c.project_id=project.id and not c.voided and c.classification='capital';
  if exists(select 1 from public.bookkeeping_project_costs c join public.bookkeeping_journals j on j.id=c.posting_journal_id where c.project_id=project.id and not c.voided and j.entry_date>v_date) then raise exception 'BOOKS_DATE';end if;
  if amount<=0 then raise exception 'BOOKS_ASSET_EMPTY';end if;
  account:=p_data->>'account';months:=(p_data->>'life_months')::integer;total:=(p_data->>'residual')::bigint;
  if account not in ('equipment','property') or months not between 0 and 1200 or total not between 0 and amount or (account='property' and months<>0) then raise exception 'BOOKS_ASSET_POLICY';end if;
  result:=public.bookkeeping_post_core(p_book,request,v_date,'Completed asset: '||left(project.name,130),'asset-complete',jsonb_build_array(jsonb_build_object('account',account,'debit',amount,'credit',0),jsonb_build_object('account','construction','debit',0,'credit',amount)));
  insert into public.bookkeeping_assets(id,book_id,project_id,name,account,cost,available_date,life_months,residual,completion_journal_id) values(request,p_book,project.id,project.name,account,amount,v_date,months,total,result);
  update public.bookkeeping_cost_projects set status='complete',version=version+1 where id=project.id;return request;
 end if;raise exception 'BOOKS_INPUT';end;$$;
-- Keep register-backed journals out of generic reversal and arbitrary public posting.
alter function public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid) rename to bookkeeping_post_before_assets;
create function public.bookkeeping_post(p_book uuid,p_request uuid,p_date date,p_description text,p_kind text,p_lines jsonb,p_document uuid default null,p_counterparty text default '',p_reference text default '',p_contact uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare untracked bigint;amount bigint;code text;registered bigint;balance bigint;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;if not public.bookkeeping_paid() then raise exception 'BOOKS_PAID';end if;
 perform 1 from public.bookkeeping_books where id=p_book for update;
 if exists(select 1 from public.bookkeeping_journals where book_id=p_book and request_id=p_request) then return public.bookkeeping_post_before_assets(p_book,p_request,p_date,p_description,p_kind,p_lines,p_document,p_counterparty,p_reference,p_contact);end if;
 if p_kind like 'asset-%' or exists(select 1 from jsonb_array_elements(p_lines) l where l->>'account' in ('construction','accumulated_depreciation')) then raise exception 'BOOKS_ASSET_MANAGED';end if;
 foreach code in array array['equipment','property'] loop
  select coalesce(sum(cost),0) into registered from public.bookkeeping_assets where book_id=p_book and account=code;
  if registered>0 then
   select coalesce(sum(debit-credit),0) into balance from public.bookkeeping_lines where book_id=p_book and account=code;
   select coalesce(sum((l->>'debit')::bigint-(l->>'credit')::bigint),0) into amount from jsonb_array_elements(p_lines) l where l->>'account'=code;
   if balance+amount<registered then raise exception 'BOOKS_ASSET_MANAGED';end if;
  end if;
 end loop;
 if p_kind='depreciation' then
  select coalesce(sum(l.debit-l.credit),0) into untracked from public.bookkeeping_lines l join public.bookkeeping_journals j on j.id=l.journal_id where l.book_id=p_book and l.account='equipment' and j.entry_date<=p_date;
  untracked:=untracked-coalesce((select sum(cost) from public.bookkeeping_assets where book_id=p_book and account='equipment' and available_date<=p_date),0);
  select coalesce(sum((l->>'credit')::bigint),0) into amount from jsonb_array_elements(p_lines) l where l->>'account'='equipment';
  if amount>untracked then raise exception 'BOOKS_ASSET_MANAGED';end if;
 end if;
 return public.bookkeeping_post_before_assets(p_book,p_request,p_date,p_description,p_kind,p_lines,p_document,p_counterparty,p_reference,p_contact);end;$$;
alter function public.bookkeeping_reverse(uuid,uuid,uuid,date,text) rename to bookkeeping_reverse_before_assets;
create function public.bookkeeping_reverse(p_book uuid,p_journal uuid,p_request uuid,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare code text;registered bigint;balance bigint;amount bigint;begin
 if not public.bookkeeping_owns(p_book) then raise exception 'BOOKS_PERMISSION';end if;perform 1 from public.bookkeeping_books where id=p_book for update;
 if exists(select 1 from public.bookkeeping_journals where book_id=p_book and request_id=p_request) then return public.bookkeeping_reverse_before_assets(p_book,p_journal,p_request,p_date,p_reason);end if;
 if exists(select 1 from public.bookkeeping_project_costs where book_id=p_book and not voided and (source_journal_id=p_journal or posting_journal_id=p_journal)) or exists(select 1 from public.bookkeeping_assets where book_id=p_book and completion_journal_id=p_journal) or exists(select 1 from public.bookkeeping_asset_charges where book_id=p_book and journal_id=p_journal) then raise exception 'BOOKS_ASSET_MANAGED';end if;
 foreach code in array array['equipment','property'] loop
  select coalesce(sum(cost),0) into registered from public.bookkeeping_assets where book_id=p_book and account=code;
  if registered>0 then
   select coalesce(sum(debit-credit),0) into balance from public.bookkeeping_lines where book_id=p_book and account=code;
   select coalesce(sum(debit-credit),0) into amount from public.bookkeeping_lines where journal_id=p_journal and account=code;
   if balance-amount<registered then raise exception 'BOOKS_ASSET_MANAGED';end if;
  end if;
 end loop;
 return public.bookkeeping_reverse_before_assets(p_book,p_journal,p_request,p_date,p_reason);end;$$;
alter function public.bookkeeping_read(uuid) rename to bookkeeping_read_before_assets;
create function public.bookkeeping_read(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;t text;rows jsonb;begin
 result:=public.bookkeeping_read_before_assets(p_book);
 foreach t in array array['cost_projects','project_costs','assets','asset_charges'] loop execute format('select coalesce(jsonb_agg(to_jsonb(r) order by r.id),''[]''::jsonb) from public.%I r where book_id=$1','bookkeeping_'||t) into rows using p_book;result:=result||jsonb_build_object(t,rows);end loop;return result;end;$$;
alter function public.bookkeeping_backup(uuid) rename to bookkeeping_backup_before_assets;
create function public.bookkeeping_backup(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;t text;rows jsonb;begin
 result:=public.bookkeeping_backup_before_assets(p_book);
 foreach t in array array['bookkeeping_cost_projects','bookkeeping_project_costs','bookkeeping_assets','bookkeeping_asset_charges'] loop execute format('select coalesce(jsonb_agg(to_jsonb(r) order by r.id),''[]''::jsonb) from public.%I r where book_id=$1',t) into rows using p_book;result:=jsonb_set(result,array['tables',t],rows);end loop;
 if octet_length(result::text)>26214400 then raise exception 'BOOKS_EXPORT_LARGE';end if;return result;end;$$;
revoke all on function public.bookkeeping_post_before_assets(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid),public.bookkeeping_reverse_before_assets(uuid,uuid,uuid,date,text),public.bookkeeping_read_before_assets(uuid),public.bookkeeping_backup_before_assets(uuid) from public,anon,authenticated;
revoke all on function public.bookkeeping_asset_action(uuid,text,jsonb),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid),public.bookkeeping_reverse(uuid,uuid,uuid,date,text),public.bookkeeping_read(uuid),public.bookkeeping_backup(uuid) from public,anon;
grant execute on function public.bookkeeping_asset_action(uuid,text,jsonb),public.bookkeeping_post(uuid,uuid,date,text,text,jsonb,uuid,text,text,uuid),public.bookkeeping_reverse(uuid,uuid,uuid,date,text),public.bookkeeping_read(uuid),public.bookkeeping_backup(uuid) to authenticated;
create function public.bookkeeping_project_figures(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare owner_id uuid;result jsonb;begin
 if to_regclass('public.project_workspaces') is null then raise exception 'BOOKS_ASSET_LINK';end if;
 execute 'select owner_id from public.project_workspaces where id=$1' into owner_id using p_workspace;
 if owner_id is distinct from auth.uid() then raise exception 'BOOKS_PERMISSION';end if;
 execute $query$
 with mapping as (select c.id,c.book_id,coalesce(c.planning_project_id,p.planning_project_id) planning_id from public.bookkeeping_cost_projects c left join public.bookkeeping_cost_projects p on p.id=c.parent_id join public.bookkeeping_books b on b.id=c.book_id where b.owner_id=auth.uid()),
 costs as (select m.planning_id,sum(c.amount) filter(where c.classification='capital') capital,sum(c.amount) filter(where c.classification='expense') expense from mapping m join public.bookkeeping_project_costs c on c.project_id=m.id and not c.voided group by m.planning_id),
 assets as (select m.planning_id,sum(a.cost) completed,sum(a.depreciated) depreciation from mapping m join public.bookkeeping_assets a on a.project_id=m.id group by m.planning_id)
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'capital',coalesce(c.capital,0),'expense',coalesce(c.expense,0),'completed',coalesce(a.completed,0),'depreciation',coalesce(a.depreciation,0))), '[]'::jsonb) from public.project_projects p left join costs c on c.planning_id=p.id left join assets a on a.planning_id=p.id where p.workspace_id=$1
 $query$ into result using p_workspace;return result;end;$$;
revoke all on function public.bookkeeping_project_figures(uuid) from public,anon;grant execute on function public.bookkeeping_project_figures(uuid) to authenticated;
notify pgrst,'reload schema';commit;
