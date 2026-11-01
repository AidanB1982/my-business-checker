-- Run once after the existing migrations. No API keys or private credentials belong here.
begin;
create table public.project_workspaces (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 120),description text not null default '' check(char_length(description)<=1000),created_at timestamptz not null default now()
);
create table public.project_members (
 workspace_id uuid not null references public.project_workspaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','editor','viewer')),display_name text not null check(char_length(btrim(display_name)) between 1 and 80),weekly_capacity numeric(5,2) not null default 40 check(weekly_capacity between 0 and 168),joined_at timestamptz not null default now(),primary key(workspace_id,user_id)
);
create function public.project_workspace_role(p_workspace uuid) returns text language sql stable security definer set search_path='' as $$select role from public.project_members where workspace_id=p_workspace and user_id=(select auth.uid())$$;
create function public.project_workspace_writable(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.project_workspace_role(p_workspace) in ('owner','editor'),false) and exists(select 1 from public.project_workspaces w join public.subscriptions s on s.user_id=w.owner_id where w.id=p_workspace and s.status in ('active','trialing') and s.current_period_end>now())$$;
create table public.project_projects (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.project_workspaces(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 120),description text not null default '' check(char_length(description)<=3000),status text not null default 'planned' check(status in ('planned','active','on-hold','completed')),start_date date,due_date date,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,workspace_id),check(start_date is null or due_date is null or start_date<=due_date),check(start_date is null or start_date between date '2000-01-01' and date '2100-12-31'),check(due_date is null or due_date between date '2000-01-01' and date '2100-12-31')
);
create table public.project_milestones (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,title text not null check(char_length(btrim(title)) between 1 and 120),due_date date check(due_date is null or due_date between date '2000-01-01' and date '2100-12-31'),completed boolean not null default false,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,project_id,workspace_id),foreign key(project_id,workspace_id) references public.project_projects(id,workspace_id) on delete cascade
);
create function public.project_valid_checklist(p_items jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb;begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>30 or octet_length(p_items::text)>32768 then return false;end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' then return false;end if;
  if not (item ?& array['id','text','done']) then return false;end if;
  if (select count(*) from jsonb_object_keys(item))<>3 or jsonb_typeof(item->'id')<>'string' or (item->>'id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or jsonb_typeof(item->'text')<>'string' or char_length(btrim(item->>'text')) not between 1 and 200 or jsonb_typeof(item->'done')<>'boolean' then return false;end if;
 end loop;
 return (select count(distinct e->>'id') from jsonb_array_elements(p_items) e)=jsonb_array_length(p_items);
end;$$;
create table public.project_tasks (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 120),description text not null default '' check(char_length(description)<=4000),status text not null default 'todo' check(status in ('todo','in-progress','review','blocked','done')),priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),kind text not null default 'task' check(kind in ('task','deliverable')),
 assignee_id uuid,milestone_id uuid,blocked_by uuid,start_date date,due_date date,estimated_hours numeric(7,2) not null default 0 check(estimated_hours between 0 and 1000),acceptance_criteria text not null default '' check(char_length(acceptance_criteria)<=2000),checklist jsonb not null default '[]' check(public.project_valid_checklist(checklist)),
 created_by uuid default auth.uid() references auth.users(id) on delete set null,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,workspace_id),unique(id,project_id,workspace_id),check(id is distinct from blocked_by),check(start_date is null or due_date is null or start_date<=due_date),check(start_date is null or start_date between date '2000-01-01' and date '2100-12-31'),check(due_date is null or due_date between date '2000-01-01' and date '2100-12-31'),
 foreign key(project_id,workspace_id) references public.project_projects(id,workspace_id) on delete cascade,
 foreign key(workspace_id,assignee_id) references public.project_members(workspace_id,user_id) on delete set null(assignee_id),
 foreign key(milestone_id,project_id,workspace_id) references public.project_milestones(id,project_id,workspace_id) on delete set null(milestone_id),
 foreign key(blocked_by,project_id,workspace_id) references public.project_tasks(id,project_id,workspace_id) on delete set null(blocked_by)
);
create index project_tasks_project_idx on public.project_tasks(workspace_id,project_id,due_date);
create index project_tasks_assignee_idx on public.project_tasks(workspace_id,assignee_id,status);
create table public.project_comments (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,task_id uuid not null,author_id uuid default auth.uid() references auth.users(id) on delete set null,body text not null check(char_length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now(),foreign key(task_id,workspace_id) references public.project_tasks(id,workspace_id) on delete cascade
);
create index project_comments_task_idx on public.project_comments(workspace_id,task_id,created_at desc,id);
create table public.project_activity (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.project_workspaces(id) on delete cascade,project_id uuid,task_id uuid,actor_name text not null,action text not null,summary text not null,created_at timestamptz not null default now()
);
create index project_activity_recent_idx on public.project_activity(workspace_id,created_at desc,id);
create table public.project_invites (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.project_workspaces(id) on delete cascade,email text not null check(char_length(email)<=254),role text not null check(role in ('editor','viewer')),token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now(),accepted_at timestamptz,accepted_by uuid references auth.users(id) on delete set null,revoked_at timestamptz
);
create index project_invites_workspace_idx on public.project_invites(workspace_id,created_at desc);
create function public.project_before_write() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;cycle boolean;begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.workspace_id::text,73));
 if tg_op='INSERT' then
  case tg_table_name
   when 'project_projects' then select count(*) into n from public.project_projects where workspace_id=new.workspace_id;if n>=25 then raise exception 'PROJECTS_LIMIT';end if;
   when 'project_tasks' then select count(*) into n from public.project_tasks where workspace_id=new.workspace_id;if n>=1000 then raise exception 'PROJECTS_LIMIT';end if;
   when 'project_milestones' then select count(*) into n from public.project_milestones where workspace_id=new.workspace_id;if n>=250 then raise exception 'PROJECTS_LIMIT';end if;
   else null;
  end case;
  new.version:=1;new.created_at:=now();
 else new.version:=old.version+1;new.created_at:=old.created_at;
 end if;
 new.updated_at:=now();
 if tg_table_name='project_tasks' then
 if new.blocked_by is not null then
  with recursive chain(id,blocked_by,path) as (
   select t.id,t.blocked_by,array[t.id] from public.project_tasks t where t.id=new.blocked_by and t.project_id=new.project_id and t.workspace_id=new.workspace_id
   union all select t.id,t.blocked_by,c.path||t.id from public.project_tasks t join chain c on t.id=c.blocked_by where t.workspace_id=new.workspace_id and t.project_id=new.project_id and not t.id=any(c.path)
  ) select exists(select 1 from chain where id=new.id) into cycle;
  if cycle or new.id=new.blocked_by then raise exception 'PROJECTS_DEPENDENCY_CYCLE';end if;
  if new.status='done' and (tg_op='INSERT' or old.status<>'done' or new.blocked_by is distinct from old.blocked_by) and exists(select 1 from public.project_tasks where id=new.blocked_by and status<>'done') then raise exception 'PROJECTS_DEPENDENCY_OPEN';end if;
 end if;
 if new.status='done' and exists(select 1 from jsonb_array_elements(new.checklist) e where e->>'done'<>'true') then raise exception 'PROJECTS_CHECKLIST_OPEN';end if;
 end if;
 return new;
end;$$;
create trigger project_projects_write before insert or update on public.project_projects for each row execute function public.project_before_write();
create trigger project_tasks_write before insert or update on public.project_tasks for each row execute function public.project_before_write();
create trigger project_milestones_write before insert or update on public.project_milestones for each row execute function public.project_before_write();
create function public.project_log_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb;who text;project uuid;task uuid;label text;begin
 if tg_op='DELETE' then row_data:=to_jsonb(old);else row_data:=to_jsonb(new);end if;
 if not exists(select 1 from public.project_workspaces where id=(row_data->>'workspace_id')::uuid) then if tg_op='DELETE' then return old;else return new;end if;end if;
 select display_name into who from public.project_members where workspace_id=(row_data->>'workspace_id')::uuid and user_id=(select auth.uid());
 project:=nullif(row_data->>'project_id','')::uuid;
 if tg_table_name='project_projects' then project:=(row_data->>'id')::uuid;label:=row_data->>'name';else label:=row_data->>'title';end if;
 if tg_table_name='project_tasks' then task:=(row_data->>'id')::uuid;end if;
 insert into public.project_activity(workspace_id,project_id,task_id,actor_name,action,summary) values((row_data->>'workspace_id')::uuid,project,task,coalesce(who,'Former member'),replace(tg_table_name,'project_','')||'.'||lower(tg_op),left(coalesce(label,'Item'),120)||case when tg_op='INSERT' then ' created' when tg_op='DELETE' then ' deleted' when tg_table_name='project_tasks' then ' updated · '||(row_data->>'status') else ' updated' end);
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger project_projects_activity after insert or update or delete on public.project_projects for each row execute function public.project_log_activity();
create trigger project_tasks_activity after insert or update or delete on public.project_tasks for each row execute function public.project_log_activity();
create trigger project_milestones_activity after insert or update or delete on public.project_milestones for each row execute function public.project_log_activity();
create function public.project_create_workspace(p_name text,p_description text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if auth.uid() is null then raise exception 'PROJECTS_SIGN_IN';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,74));
 if not exists(select 1 from public.subscriptions where user_id=auth.uid() and status in ('active','trialing') and current_period_end>now()) then raise exception 'PROJECTS_PAID_REQUIRED';end if;
 if (select count(*) from public.project_workspaces where owner_id=auth.uid())>=10 then raise exception 'PROJECTS_LIMIT';end if;
 insert into public.project_workspaces(owner_id,name,description) values(auth.uid(),btrim(p_name),p_description) returning id into result;
 insert into public.project_members(workspace_id,user_id,role,display_name) values(result,auth.uid(),'owner',btrim(p_display_name));return result;
end;$$;
create function public.project_create_invite(p_workspace uuid,p_email text,p_role text,p_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if public.project_workspace_role(p_workspace) is distinct from 'owner' then raise exception 'PROJECTS_PERMISSION';end if;
 if not public.project_workspace_writable(p_workspace) then raise exception 'PROJECTS_PAID_REQUIRED';end if;
 if p_role not in ('editor','viewer') or char_length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'PROJECTS_INPUT';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text,73));
 if (select count(*) from public.project_invites where workspace_id=p_workspace and accepted_at is null and revoked_at is null and expires_at>now())>=50 then raise exception 'PROJECTS_LIMIT';end if;
 insert into public.project_invites(workspace_id,email,role,token_hash) values(p_workspace,lower(btrim(p_email)),p_role,p_token_hash) returning id into result;return result;
end;$$;
create function public.project_accept_invite(p_token_hash text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.project_invites%rowtype;email text;begin
 if auth.uid() is null then raise exception 'PROJECTS_SIGN_IN';end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select * into invitation from public.project_invites where token_hash=p_token_hash for update;
 if invitation.id is null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'PROJECTS_INVITE_INVALID';end if;
 if email is null or email<>invitation.email then raise exception 'PROJECTS_INVITE_EMAIL';end if;
 if invitation.accepted_at is not null then
  if invitation.accepted_by=auth.uid() and exists(select 1 from public.project_members where workspace_id=invitation.workspace_id and user_id=auth.uid()) then return invitation.workspace_id;end if;
  raise exception 'PROJECTS_INVITE_INVALID';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(invitation.workspace_id::text,73));
 if not exists(select 1 from public.project_workspaces w join public.subscriptions s on s.user_id=w.owner_id where w.id=invitation.workspace_id and s.status in ('active','trialing') and s.current_period_end>now()) then raise exception 'PROJECTS_PAID_REQUIRED';end if;
 if not exists(select 1 from public.project_members where workspace_id=invitation.workspace_id and user_id=auth.uid()) then
  if (select count(*) from public.project_members where workspace_id=invitation.workspace_id)>=50 then raise exception 'PROJECTS_LIMIT';end if;
  insert into public.project_members(workspace_id,user_id,role,display_name) values(invitation.workspace_id,auth.uid(),invitation.role,btrim(p_display_name));
 end if;
 update public.project_invites set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;return invitation.workspace_id;
end;$$;
create function public.project_member_settings(p_workspace uuid,p_user uuid,p_name text,p_capacity numeric) returns void language plpgsql security definer set search_path='' as $$begin
 if public.project_workspace_role(p_workspace) is null or (p_user<>auth.uid() and public.project_workspace_role(p_workspace)<>'owner') then raise exception 'PROJECTS_PERMISSION';end if;
 update public.project_members set display_name=btrim(p_name),weekly_capacity=p_capacity where workspace_id=p_workspace and user_id=p_user;
 if not found then raise exception 'PROJECTS_PERMISSION';end if;
end;$$;
create function public.project_member_role(p_workspace uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$begin
 if public.project_workspace_role(p_workspace) is distinct from 'owner' or exists(select 1 from public.project_workspaces where id=p_workspace and owner_id=p_user) then raise exception 'PROJECTS_PERMISSION';end if;
 if p_role='remove' then delete from public.project_members where workspace_id=p_workspace and user_id=p_user;
 elsif p_role in ('editor','viewer') then update public.project_members set role=p_role where workspace_id=p_workspace and user_id=p_user;
 else raise exception 'PROJECTS_INPUT';end if;
end;$$;
create function public.project_revoke_invite(p_workspace uuid,p_invite uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if public.project_workspace_role(p_workspace) is distinct from 'owner' then raise exception 'PROJECTS_PERMISSION';end if;
 update public.project_invites set revoked_at=now() where workspace_id=p_workspace and id=p_invite and accepted_at is null;
end;$$;
create function public.project_leave_workspace(p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if public.project_workspace_role(p_workspace) is null or public.project_workspace_role(p_workspace)='owner' then raise exception 'PROJECTS_PERMISSION';end if;
 delete from public.project_members where workspace_id=p_workspace and user_id=auth.uid();
end;$$;
-- Membership helpers avoid recursive member RLS; ownership itself is immutable to normal clients.
alter table public.project_workspaces enable row level security;
alter table public.project_members enable row level security;
alter table public.project_projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_activity enable row level security;
alter table public.project_invites enable row level security;
revoke all on public.project_workspaces,public.project_members,public.project_projects,public.project_milestones,public.project_tasks,public.project_comments,public.project_activity,public.project_invites from public,anon,authenticated;
grant select,delete on public.project_workspaces to authenticated;
grant update(name,description) on public.project_workspaces to authenticated;
grant select on public.project_members,public.project_activity to authenticated;
grant select,insert,delete on public.project_projects,public.project_milestones,public.project_tasks to authenticated;
grant update(name,description,status,start_date,due_date) on public.project_projects to authenticated;
grant update(title,due_date,completed) on public.project_milestones to authenticated;
grant update(title,description,status,priority,kind,assignee_id,milestone_id,blocked_by,start_date,due_date,estimated_hours,acceptance_criteria,checklist) on public.project_tasks to authenticated;
grant select,insert,delete on public.project_comments to authenticated;
grant select(id,workspace_id,email,role,expires_at,created_at,accepted_at,revoked_at) on public.project_invites to authenticated;
create policy project_workspace_read on public.project_workspaces for select to authenticated using(public.project_workspace_role(id) is not null);
create policy project_workspace_update on public.project_workspaces for update to authenticated using(owner_id=auth.uid() and public.project_workspace_writable(id)) with check(owner_id=auth.uid());
create policy project_workspace_delete on public.project_workspaces for delete to authenticated using(owner_id=auth.uid());
create policy project_member_read on public.project_members for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_projects_read on public.project_projects for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_projects_insert on public.project_projects for insert to authenticated with check(public.project_workspace_writable(workspace_id));
create policy project_projects_update on public.project_projects for update to authenticated using(public.project_workspace_writable(workspace_id)) with check(public.project_workspace_writable(workspace_id));
create policy project_projects_delete on public.project_projects for delete to authenticated using(public.project_workspace_writable(workspace_id));
create policy project_milestones_read on public.project_milestones for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_milestones_insert on public.project_milestones for insert to authenticated with check(public.project_workspace_writable(workspace_id));
create policy project_milestones_update on public.project_milestones for update to authenticated using(public.project_workspace_writable(workspace_id)) with check(public.project_workspace_writable(workspace_id));
create policy project_milestones_delete on public.project_milestones for delete to authenticated using(public.project_workspace_writable(workspace_id));
create policy project_tasks_read on public.project_tasks for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check(public.project_workspace_writable(workspace_id) and created_by=auth.uid());
create policy project_tasks_update on public.project_tasks for update to authenticated using(public.project_workspace_writable(workspace_id)) with check(public.project_workspace_writable(workspace_id));
create policy project_tasks_delete on public.project_tasks for delete to authenticated using(public.project_workspace_writable(workspace_id));
create policy project_comments_read on public.project_comments for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_comments_insert on public.project_comments for insert to authenticated with check(public.project_workspace_writable(workspace_id) and author_id=auth.uid());
create policy project_comments_delete on public.project_comments for delete to authenticated using(public.project_workspace_role(workspace_id) is not null and (author_id=auth.uid() or public.project_workspace_role(workspace_id)='owner'));
create policy project_activity_read on public.project_activity for select to authenticated using(public.project_workspace_role(workspace_id) is not null);
create policy project_invites_read on public.project_invites for select to authenticated using(public.project_workspace_role(workspace_id)='owner');
revoke all on function public.project_workspace_role(uuid),public.project_workspace_writable(uuid),public.project_valid_checklist(jsonb),public.project_before_write(),public.project_log_activity(),public.project_create_workspace(text,text,text),public.project_create_invite(uuid,text,text,text),public.project_accept_invite(text,text),public.project_member_settings(uuid,uuid,text,numeric),public.project_member_role(uuid,uuid,text),public.project_revoke_invite(uuid,uuid),public.project_leave_workspace(uuid) from public,anon;
grant execute on function public.project_workspace_role(uuid),public.project_workspace_writable(uuid),public.project_valid_checklist(jsonb),public.project_create_workspace(text,text,text),public.project_create_invite(uuid,text,text,text),public.project_accept_invite(text,text),public.project_member_settings(uuid,uuid,text,numeric),public.project_member_role(uuid,uuid,text),public.project_revoke_invite(uuid,uuid),public.project_leave_workspace(uuid) to authenticated;
commit;
