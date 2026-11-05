-- Apply after the initial schema. Focus preferences are free; progress writes require Advanced.
begin;
alter table public.profiles add column workspace_focus text check(workspace_focus in ('sole-traders','landlords','personal'));
create table public.learning_question_keys(lesson_slug text primary key,question_version integer not null check(question_version>0),correct_answer integer not null check(correct_answer between 0 and 9));
revoke all on public.learning_question_keys from public,anon,authenticated;
alter table public.learning_question_keys enable row level security;
insert into public.learning_question_keys values
('profit-cash-and-drawings',1,1),
('reading-your-profit-and-loss',1,0),
('understanding-your-balance-sheet',1,1),
('business-and-private-expenses',1,1),
('sole-trader-bank-review',1,0),
('sole-trader-year-end',1,1),
('gross-rent-and-agent-statements',1,1),
('arrears-advance-rent-and-deposits',1,1),
('rental-yield-and-borrowing',1,1),
('property-costs-and-ownership',1,1),
('property-reserves-and-lifecycle',1,0),
('landlord-accountant-handover',1,1),
('understand-your-payslip',1,1),
('planning-your-personal-cash',1,1),
('understand-pension-scenarios',1,1);
create table public.learning_progress(
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_slug text not null references public.learning_question_keys(lesson_slug),
 question_version integer not null,completed_at timestamptz not null default now(),primary key(user_id,lesson_slug)
);
alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from public,anon,authenticated;
grant select,delete on public.learning_progress to authenticated;
create policy learning_progress_own on public.learning_progress for select to authenticated using((select auth.uid())=user_id);
create policy learning_progress_delete_own on public.learning_progress for delete to authenticated using((select auth.uid())=user_id);
create function public.save_learning_check(p_lesson text,p_version integer,p_answer integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare correct integer;
begin
 if auth.uid() is null or not exists(select 1 from public.subscriptions where user_id=auth.uid() and status in ('active','trialing') and current_period_end>now()) then
  raise insufficient_privilege using message='Advanced required to save learning progress';
 end if;
 select correct_answer into correct from public.learning_question_keys where lesson_slug=p_lesson and question_version=p_version;
 if correct is null then raise exception 'Learning question changed. Reload the lesson.'; end if;
 if p_answer is distinct from correct then return false; end if;
 insert into public.learning_progress(user_id,lesson_slug,question_version) values(auth.uid(),p_lesson,p_version)
 on conflict(user_id,lesson_slug) do update set question_version=excluded.question_version,completed_at=now();
 return true;
end;$$;
revoke all on function public.save_learning_check(text,integer,integer) from public,anon;
grant execute on function public.save_learning_check(text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
