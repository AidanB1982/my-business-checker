-- Apply after project_workspaces. Free-form parent projects and one level of subprojects.
begin;
alter table public.project_projects add column parent_id uuid,add column budget_pence bigint not null default 0 check(budget_pence between 0 and 100000000000),add column committed_pence bigint not null default 0 check(committed_pence between 0 and 100000000000);
alter table public.project_projects add foreign key(parent_id,workspace_id) references public.project_projects(id,workspace_id) on delete restrict;
create function public.project_hierarchy_guard() returns trigger language plpgsql security definer set search_path='' as $$declare p public.project_projects;begin
 perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text,73));
 if tg_op='UPDATE' and (new.id<>old.id or new.workspace_id<>old.workspace_id) then raise exception 'PROJECTS_HIERARCHY';end if;
 if new.parent_id is not null then
  select * into p from public.project_projects where id=new.parent_id and workspace_id=new.workspace_id;
  if not found or p.parent_id is not null or p.id=new.id or exists(select 1 from public.project_projects where parent_id=new.id) then raise exception 'PROJECTS_HIERARCHY';end if;
 end if;
 if new.status='completed' and (exists(select 1 from public.project_projects where parent_id=new.id and status<>'completed') or exists(select 1 from public.project_tasks where project_id=new.id and status<>'done')) then raise exception 'PROJECTS_UNFINISHED';end if;
 if new.parent_id is not null and p.status='completed' and new.status<>'completed' then raise exception 'PROJECTS_UNFINISHED';end if;
 return new;end;$$;
create trigger project_hierarchy_guard before insert or update on public.project_projects for each row execute function public.project_hierarchy_guard();
revoke all on function public.project_hierarchy_guard() from public,anon,authenticated;
create function public.project_closed_task_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text,73));
 if new.status<>'done' and exists(select 1 from public.project_projects p left join public.project_projects parent on parent.id=p.parent_id where p.id=new.project_id and (p.status='completed' or parent.status='completed')) then raise exception 'PROJECTS_UNFINISHED';end if;return new;end;$$;
create trigger project_closed_task_guard before insert or update on public.project_tasks for each row execute function public.project_closed_task_guard();
revoke all on function public.project_closed_task_guard() from public,anon,authenticated;
notify pgrst,'reload schema';commit;
