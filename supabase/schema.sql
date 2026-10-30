-- Niche Detail · base de dados no Supabase
-- Já está aplicado no projeto «niche-detail». Este ficheiro serve de registo
-- e para recriar tudo noutro projeto (SQL Editor → New query → colar → Run).

-- Conteúdo do site: um único documento JSON (o mesmo formato de public/data/site.json)
create table public.site_content (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Quem pode entrar no painel
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
alter table public.admins enable row level security;

-- Coisas internas ficam num schema que a API não expõe
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Emails autorizados: uma conta confirmada com um destes emails passa a admin sozinha
create table private.admin_emails (
  email text primary key
);
alter table private.admin_emails enable row level security;
revoke all on table private.admin_emails from public, anon, authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create function private.grant_admin_from_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from private.admin_emails e where lower(e.email) = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.grant_admin_from_email() from public;

create trigger on_auth_user_admin_grant
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.grant_admin_from_email();

-- Regras: toda a gente lê o site; só administradores escrevem
create policy "site_content: leitura pública" on public.site_content
  for select using (true);
create policy "site_content: admins inserem" on public.site_content
  for insert to authenticated with check ((select private.is_admin()));
create policy "site_content: admins atualizam" on public.site_content
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins: ver a própria linha" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Fotos carregadas no painel
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media: leitura pública" on storage.objects
  for select using (bucket_id = 'media');
create policy "media: admins carregam" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select private.is_admin()));
create policy "media: admins apagam" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select private.is_admin()));

-- Quem pode ser administrador (acrescenta mais linhas para dar acesso a outra pessoa)
insert into private.admin_emails (email) values ('antoniooc.net@gmail.com');

-- Para dar acesso a alguém que já tem conta:
-- insert into public.admins (user_id) select id from auth.users where email = 'email@exemplo.pt';
