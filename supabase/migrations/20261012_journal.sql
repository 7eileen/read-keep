-- Run once in Supabase SQL Editor as the project administrator.
begin;
create table if not exists public.articles (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 150),
  payload jsonb not null check (coalesce(jsonb_typeof(payload)='object' and payload->>'id'=id and jsonb_typeof(payload->'paragraphs')='array',false)),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_id,id)
);
create table if not exists public.entries (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 150),
  payload jsonb not null check (coalesce(jsonb_typeof(payload)='object' and payload->>'id'=id and jsonb_typeof(payload->'word')='string' and jsonb_typeof(payload->'due')='string',false)),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_id,id)
);
create table if not exists public.preferences (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'settings' check (id='settings'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_id,id)
);
create or replace function public.journal_stamp() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if new.owner_id<>old.owner_id or new.id<>old.id then raise exception 'Record identity cannot change'; end if;
    new.version=old.version+1;
  else new.version=1;
  end if;
  new.updated_at=now(); return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['articles','entries','preferences'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid())=owner_id)',t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=owner_id)',t);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',t);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=owner_id)',t);
    execute format('create trigger journal_stamp before insert or update on public.%I for each row execute function public.journal_stamp()',t);
  end loop;
end $$;
create or replace function public.journal_load() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'articles',coalesce((select jsonb_agg(to_jsonb(a) - 'owner_id') from public.articles a where owner_id=auth.uid()),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(to_jsonb(e) - 'owner_id') from public.entries e where owner_id=auth.uid()),'[]'::jsonb),
    'preferences',coalesce((select jsonb_agg(to_jsonb(p) - 'owner_id') from public.preferences p where owner_id=auth.uid()),'[]'::jsonb)
  );
$$;
create or replace function public.journal_apply(changes jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb; t text; k text; v integer; n integer; d jsonb;
begin
  if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
  if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>5000 then raise exception 'Invalid batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  for c in select value from jsonb_array_elements(changes) loop
    t=c->>'table'; k=c->>'id'; v=(c->>'version')::integer; d=c->'data';
    if t is null or t not in ('articles','entries','preferences') or k is null then raise exception 'Invalid record'; end if;
    if d='null'::jsonb then
      execute format('delete from public.%I where owner_id=auth.uid() and id=$1 and version=$2',t) using k,v;
    elsif v is null then
      begin
        execute format('insert into public.%I(owner_id,id,payload) values(auth.uid(),$1,$2)',t) using k,d;
      exception when unique_violation then raise exception 'SYNC_CONFLICT' using errcode='PT409'; end;
    else
      execute format('update public.%I set payload=$1 where owner_id=auth.uid() and id=$2 and version=$3',t) using d,k,v;
    end if;
    get diagnostics n=row_count;
    if n<>1 then raise exception 'SYNC_CONFLICT' using errcode='PT409'; end if;
  end loop;
  return public.journal_load();
end $$;
revoke all on function public.journal_load() from public,anon;
revoke all on function public.journal_apply(jsonb) from public,anon;
revoke all on function public.journal_stamp() from public,anon,authenticated;
grant execute on function public.journal_load() to authenticated;
grant execute on function public.journal_apply(jsonb) to authenticated;
commit;
