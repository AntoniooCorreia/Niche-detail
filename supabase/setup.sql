-- Niche Detail · base de dados
--
-- Serve para as duas situações:
--   · projeto Supabase novo: cria tudo e põe o conteúdo inicial;
--   · projeto que já tens: passa o conteúdo para as tabelas novas (se já publicaste no painel, usa o que publicaste).
-- Como usar: Supabase → SQL Editor → New query → colar o ficheiro todo → Run.
-- Pode ser corrido mais do que uma vez: não apaga nem duplica nada que já esteja nas tabelas.
--
-- Tabelas do site (todas editáveis no painel):
--   site_settings  uma linha só: dados do negócio, topo do site, textos das secções, Google
--   categories     separadores da tabela de preços (serviços ou produtos à venda)
--   items          serviços e produtos, cada um na sua categoria
--   gallery        fotos dos trabalhos
--   wrap_colors    cores do simulador de wrap
--   faq            perguntas frequentes
-- O site lê tudo com get_site() e o painel grava com publish_site(), numa só transação.
--
-- O Supabase pode avisar que há «operações destrutivas»: é a tabela antiga site_content, que é apagada
-- depois de o conteúdo passar para as tabelas novas. Carrega em «Run this query».

-- ================================================================ administradores
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
comment on table public.admins is 'Contas que podem entrar no painel e publicar.';

-- Coisas internas ficam num schema que a API não expõe
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Emails autorizados: uma conta confirmada com um destes emails passa a admin sozinha
create table if not exists private.admin_emails (
  email text primary key
);
alter table private.admin_emails enable row level security;
revoke all on table private.admin_emails from public, anon, authenticated;

create or replace function private.is_admin()
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

create or replace function private.grant_admin_from_email()
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

-- (as tabelas auth e storage não são nossas: cria-se o que falta em vez de apagar e voltar a criar)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_admin_grant' and tgrelid = 'auth.users'::regclass) then
    create trigger on_auth_user_admin_grant
      after insert or update of email_confirmed_at on auth.users
      for each row execute function private.grant_admin_from_email();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admins' and policyname = 'admins: ver a própria linha') then
    create policy "admins: ver a própria linha" on public.admins
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- Quem pode ser administrador (acrescenta mais linhas para dar acesso a outra pessoa)
insert into private.admin_emails (email) values ('antoniooc.net@gmail.com') on conflict do nothing;

-- ================================================================ fotos
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media: leitura pública') then
    create policy "media: leitura pública" on storage.objects
      for select using (bucket_id = 'media');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media: admins carregam') then
    create policy "media: admins carregam" on storage.objects
      for insert to authenticated with check (bucket_id = 'media' and (select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media: admins apagam') then
    create policy "media: admins apagam" on storage.objects
      for delete to authenticated using (bucket_id = 'media' and (select private.is_admin()));
  end if;
end $$;

-- ================================================================ conteúdo do site
create table if not exists public.site_settings (
  id text primary key default 'main' check (id = 'main'),
  business jsonb not null default '{}'::jsonb,
  hero jsonb not null default '{}'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  price_note text not null default '',
  simulator jsonb not null default '{}'::jsonb,
  texts jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table public.site_settings is 'Uma linha só: dados do negócio, topo do site, nota de preços, simulador, textos das secções e Google.';

create table if not exists public.categories (
  id text primary key,
  name text not null,
  kind text not null default 'service' check (kind in ('service', 'product')),
  intro text not null default '',
  image text not null default '',
  visible boolean not null default true,
  position integer not null default 0
);
comment on table public.categories is 'Separadores da tabela de preços. kind = service (serviços) ou product (produtos à venda).';

create table if not exists public.items (
  id text primary key,
  category_id text not null references public.categories(id) on update cascade on delete restrict,
  name text not null,
  description text not null default '',
  includes text[] not null default '{}',
  duration text not null default '',
  price_mode text not null default 'fixed' check (price_mode in ('fixed', 'sizes', 'quote')),
  price_from boolean not null default false,
  price_values numeric[] not null default '{0,0,0}',
  price_value numeric not null default 0,
  image text not null default '',
  featured boolean not null default false,
  visible boolean not null default true,
  extra jsonb,
  position integer not null default 0
);
create index if not exists items_category_id_idx on public.items (category_id);
comment on table public.items is 'Serviços e produtos. price_mode: fixed (preço único), sizes (um preço por tamanho de carro, em price_values) ou quote (sob orçamento).';

create table if not exists public.gallery (
  id text primary key,
  image text not null,
  title text not null default '',
  tag text not null default '',
  example boolean not null default false,
  position integer not null default 0
);
comment on table public.gallery is 'Fotos dos trabalhos. example = true para as fotos de exemplo que vêm com o site.';

create table if not exists public.wrap_colors (
  id text primary key,
  name text not null,
  finish text not null default 'gloss' check (finish in ('gloss', 'metallic', 'satin', 'matte', 'chrome', 'flip')),
  hex text not null default '#888888',
  hex2 text not null default '',
  position integer not null default 0
);
comment on table public.wrap_colors is 'Cores do simulador de wrap. hex2 só se usa no acabamento flip (camaleão).';

create table if not exists public.faq (
  id text primary key,
  question text not null,
  answer text not null default '',
  position integer not null default 0
);
comment on table public.faq is 'Perguntas frequentes, pela ordem de position.';

-- Regras: toda a gente lê; só administradores escrevem
do $$
declare
  t text;
begin
  foreach t in array array['site_settings', 'categories', 'items', 'gallery', 'wrap_colors', 'faq'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from anon', t);
    execute format('revoke truncate on table public.%I from authenticated', t);
    execute format('drop policy if exists "leitura pública" on public.%I', t);
    execute format('create policy "leitura pública" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admins inserem" on public.%I', t);
    execute format('create policy "admins inserem" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "admins alteram" on public.%I', t);
    execute format('create policy "admins alteram" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "admins apagam" on public.%I', t);
    execute format('create policy "admins apagam" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- ================================================================ ler e gravar
create or replace function private.arr(j jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end;
$$;

create or replace function private.obj(j jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end;
$$;
grant execute on function private.arr(jsonb), private.obj(jsonb) to authenticated;

-- O site inteiro num só documento JSON (o formato que o site e o painel usam)
create or replace function public.get_site()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 2,
    'updatedAt', to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'business', s.business,
    'hero', s.hero,
    'sizes', s.sizes,
    'priceNote', s.price_note,
    'simulator', s.simulator,
    'texts', s.texts,
    'seo', s.seo,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'kind', c.kind, 'intro', c.intro, 'image', c.image, 'visible', c.visible
      ) order by c.position, c.id)
      from public.categories c), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'category', i.category_id, 'name', i.name, 'description', i.description,
        'includes', to_jsonb(i.includes), 'duration', i.duration,
        'price', jsonb_build_object('mode', i.price_mode, 'from', i.price_from, 'values', to_jsonb(i.price_values), 'value', i.price_value),
        'image', i.image, 'featured', i.featured, 'visible', i.visible
      ) || case when i.extra is null then '{}'::jsonb else jsonb_build_object('extra', i.extra) end
      order by i.position, i.id)
      from public.items i), '[]'::jsonb),
    'gallery', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'image', g.image, 'title', g.title, 'tag', g.tag, 'example', g.example
      ) order by g.position, g.id)
      from public.gallery g), '[]'::jsonb),
    'wrapColors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'name', w.name, 'finish', w.finish, 'hex', w.hex, 'hex2', w.hex2
      ) order by w.position, w.id)
      from public.wrap_colors w), '[]'::jsonb),
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'q', f.question, 'a', f.answer) order by f.position, f.id)
      from public.faq f), '[]'::jsonb)
  )
  from public.site_settings s
  where s.id = 'main';
$$;
revoke all on function public.get_site() from public;
grant execute on function public.get_site() to anon, authenticated;

-- Confirma que o documento está bem formado antes de mexer nas tabelas
create or replace function private.check_site(doc jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  k text;
  total int;
  uniq int;
  blank int;
begin
  if jsonb_typeof(doc) is distinct from 'object' then
    raise exception 'O conteúdo enviado não é válido.' using errcode = '22023';
  end if;
  foreach k in array array['categories', 'items', 'gallery', 'wrapColors', 'faq'] loop
    select count(*), count(distinct e->>'id'), count(*) filter (where coalesce(e->>'id', '') = '')
      into total, uniq, blank
      from jsonb_array_elements(private.arr(doc->k)) as e;
    if blank > 0 then
      raise exception 'Há um elemento sem identificador em %.', k using errcode = '22023';
    end if;
    if uniq < total then
      raise exception 'Há elementos repetidos em %.', k using errcode = '22023';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(private.arr(doc->'items')) as i
    where not exists (select 1 from jsonb_array_elements(private.arr(doc->'categories')) as c where c->>'id' = i->>'category')
  ) then
    raise exception 'Há um serviço ou produto numa categoria que não existe.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.check_site(jsonb) from public;
grant execute on function private.check_site(jsonb) to authenticated;

-- Grava o documento nas tabelas: atualiza o que existe, cria o que é novo e apaga o que saiu
create or replace function private.write_site(doc jsonb, stamp timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.site_settings as s (id, business, hero, sizes, price_note, simulator, texts, seo, updated_at)
  values ('main', private.obj(doc->'business'), private.obj(doc->'hero'), private.arr(doc->'sizes'),
          coalesce(doc->>'priceNote', ''), private.obj(doc->'simulator'), private.obj(doc->'texts'), private.obj(doc->'seo'), stamp)
  on conflict (id) do update set
    business = excluded.business, hero = excluded.hero, sizes = excluded.sizes, price_note = excluded.price_note,
    simulator = excluded.simulator, texts = excluded.texts, seo = excluded.seo, updated_at = excluded.updated_at;

  -- categorias primeiro, porque os serviços e produtos apontam para elas
  insert into public.categories as c (id, name, kind, intro, image, visible, position)
  select e->>'id', coalesce(e->>'name', ''),
         case when e->>'kind' = 'product' then 'product' else 'service' end,
         coalesce(e->>'intro', ''), coalesce(e->>'image', ''),
         coalesce((e->>'visible')::boolean, true), (n - 1)::int
  from jsonb_array_elements(private.arr(doc->'categories')) with ordinality as t(e, n)
  on conflict (id) do update set
    name = excluded.name, kind = excluded.kind, intro = excluded.intro, image = excluded.image,
    visible = excluded.visible, position = excluded.position;

  insert into public.items as i (id, category_id, name, description, includes, duration, price_mode, price_from,
                                 price_values, price_value, image, featured, visible, extra, position)
  select e->>'id', e->>'category', coalesce(e->>'name', ''), coalesce(e->>'description', ''),
         array(select x from jsonb_array_elements_text(private.arr(e->'includes')) as x where x is not null),
         coalesce(e->>'duration', ''),
         case when e#>>'{price,mode}' in ('fixed', 'sizes', 'quote') then e#>>'{price,mode}' else 'fixed' end,
         coalesce((e#>>'{price,from}')::boolean, false),
         array(select coalesce(nullif(v, '')::numeric, 0) from jsonb_array_elements_text(private.arr(e#>'{price,values}')) as v),
         coalesce(nullif(e#>>'{price,value}', '')::numeric, 0),
         coalesce(e->>'image', ''), coalesce((e->>'featured')::boolean, false), coalesce((e->>'visible')::boolean, true),
         case when jsonb_typeof(e->'extra') in ('object', 'array') then e->'extra' end,
         (n - 1)::int
  from jsonb_array_elements(private.arr(doc->'items')) with ordinality as t(e, n)
  on conflict (id) do update set
    category_id = excluded.category_id, name = excluded.name, description = excluded.description,
    includes = excluded.includes, duration = excluded.duration, price_mode = excluded.price_mode,
    price_from = excluded.price_from, price_values = excluded.price_values, price_value = excluded.price_value,
    image = excluded.image, featured = excluded.featured, visible = excluded.visible, extra = excluded.extra,
    position = excluded.position;

  delete from public.items as i
  where not exists (select 1 from jsonb_array_elements(private.arr(doc->'items')) as e where e->>'id' = i.id);
  delete from public.categories as c
  where not exists (select 1 from jsonb_array_elements(private.arr(doc->'categories')) as e where e->>'id' = c.id);

  insert into public.gallery as g (id, image, title, tag, example, position)
  select e->>'id', coalesce(e->>'image', ''), coalesce(e->>'title', ''), coalesce(e->>'tag', ''),
         coalesce((e->>'example')::boolean, false), (n - 1)::int
  from jsonb_array_elements(private.arr(doc->'gallery')) with ordinality as t(e, n)
  on conflict (id) do update set
    image = excluded.image, title = excluded.title, tag = excluded.tag, example = excluded.example, position = excluded.position;
  delete from public.gallery as g
  where not exists (select 1 from jsonb_array_elements(private.arr(doc->'gallery')) as e where e->>'id' = g.id);

  insert into public.wrap_colors as w (id, name, finish, hex, hex2, position)
  select e->>'id', coalesce(e->>'name', ''),
         case when e->>'finish' in ('gloss', 'metallic', 'satin', 'matte', 'chrome', 'flip') then e->>'finish' else 'gloss' end,
         coalesce(nullif(e->>'hex', ''), '#888888'), coalesce(e->>'hex2', ''), (n - 1)::int
  from jsonb_array_elements(private.arr(doc->'wrapColors')) with ordinality as t(e, n)
  on conflict (id) do update set
    name = excluded.name, finish = excluded.finish, hex = excluded.hex, hex2 = excluded.hex2, position = excluded.position;
  delete from public.wrap_colors as w
  where not exists (select 1 from jsonb_array_elements(private.arr(doc->'wrapColors')) as e where e->>'id' = w.id);

  insert into public.faq as f (id, question, answer, position)
  select e->>'id', coalesce(e->>'q', ''), coalesce(e->>'a', ''), (n - 1)::int
  from jsonb_array_elements(private.arr(doc->'faq')) with ordinality as t(e, n)
  on conflict (id) do update set
    question = excluded.question, answer = excluded.answer, position = excluded.position;
  delete from public.faq as f
  where not exists (select 1 from jsonb_array_elements(private.arr(doc->'faq')) as e where e->>'id' = f.id);
end;
$$;
revoke all on function private.write_site(jsonb, timestamptz) from public;
grant execute on function private.write_site(jsonb, timestamptz) to authenticated;

-- ================================================================ refazer o site depois de publicar (opcional)
-- O site lê as tabelas sozinho, mas o HTML que o Google e o WhatsApp leem só muda num deploy novo.
-- Com o Deploy Hook do Vercel guardado aqui, cada publicação pede ao Vercel para refazer o site (cerca de 1 minuto).
-- Para ligar, no SQL Editor:  select private.set_deploy_hook('https://api.vercel.com/v1/integrations/deploy/...');
-- Para desligar:             select private.set_deploy_hook(null);
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  end if;
end $$;

create table if not exists private.deploy_hook (
  id int primary key default 1 check (id = 1),
  url text not null check (url like 'https://%')
);
alter table private.deploy_hook enable row level security;
revoke all on table private.deploy_hook from public, anon, authenticated;

create or replace function private.set_deploy_hook(hook text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(hook, '')), '') is null then
    delete from private.deploy_hook where id = 1;
    return 'Desligado: publicar já não refaz o site.';
  end if;
  insert into private.deploy_hook (id, url) values (1, trim(hook))
  on conflict (id) do update set url = excluded.url;
  return 'Ligado: cada publicação refaz o site no Vercel.';
end;
$$;
revoke all on function private.set_deploy_hook(text) from public;

create or replace function private.request_deploy()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook text;
begin
  select d.url into hook from private.deploy_hook d where d.id = 1;
  if hook is null or to_regnamespace('net') is null then
    return;
  end if;
  execute 'select net.http_post(url := $1)' using hook;
exception when others then
  raise warning 'Não foi possível pedir o deploy ao Vercel: %', sqlerrm;
end;
$$;
revoke all on function private.request_deploy() from public;
grant execute on function private.request_deploy() to authenticated;

-- Publicar a partir do painel. Corre com os direitos de quem chama: as regras acima só deixam gravar a administradores.
-- base é a hora da versão que o painel abriu; se entretanto alguém publicou outra, não grava e avisa.
create or replace function public.publish_site(doc jsonb, base text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  live timestamptz;
  stamp timestamptz := date_trunc('milliseconds', clock_timestamp());
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Só administradores podem publicar.' using errcode = '42501';
  end if;
  perform private.check_site(doc);
  select s.updated_at into live from public.site_settings s where s.id = 'main' for update;
  if live is not null and nullif(base, '') is not null and live <> base::timestamptz then
    raise exception 'conflict' using errcode = 'PT409', detail = 'Foi publicada outra versão depois de abrires o painel.';
  end if;
  perform private.write_site(doc, stamp);
  perform private.request_deploy();
  return to_char(stamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
end;
$$;
revoke all on function public.publish_site(jsonb, text) from public, anon;
grant execute on function public.publish_site(jsonb, text) to authenticated;

-- ================================================================ conteúdo inicial
-- Só corre se as tabelas ainda estiverem vazias. Se já publicaste no painel antigo (tabela site_content), usa isso.
-- A tabela antiga deixa de ser usada e é apagada no fim, depois de o conteúdo estar nas tabelas novas.
do $$
declare
  seed jsonb := $conteudo${"version":2,"updatedAt":"2026-10-25T12:00:00.000Z","business":{"name":"Niche Detail","zone":"Grande Lisboa","whatsapp":"351900000000","phone":"+351 900 000 000","email":"geral@nichedetail.pt","instagram":"nichedetail","address":"","mapsUrl":"","logo":"","hours":[{"d":"Segunda a sexta","h":"9h00 às 19h00"},{"d":"Sábado","h":"9h00 às 13h00"},{"d":"Domingo","h":"Fechado"}],"hoursNote":"Só por marcação"},"hero":{"eyebrow":"Detailing · Lavagem · Wrap","title":"Cuidamos do teu carro ao detalhe.","text":"Lavagem à mão, correção de pintura, proteção cerâmica e wrap. Dizes-nos o carro e damos-te o preço antes de começarmos.","highlights":["Lavagem à mão, sem rolos","Preço fechado antes de começar","Só por marcação"],"image":""},"sizes":["Citadino","Berlina / Carrinha","SUV / Monovolume"],"priceNote":"Valores indicativos para carros em estado normal. Se o teu precisar de mais trabalho, dizemos-te o preço antes de começarmos.","categories":[{"id":"lavagem","name":"Lavagem","kind":"service","visible":true,"image":"","intro":"Lavagem à mão com produtos de pH neutro e microfibras limpas. Para o dia a dia e para manter o carro como deve ser."},{"id":"detailing","name":"Detailing","kind":"service","visible":true,"image":"","intro":"Interiores, correção de pintura e proteção cerâmica. Para devolver o brilho ao carro e mantê-lo durante anos."},{"id":"wrap","name":"Wrap","kind":"service","visible":true,"image":"","intro":"Mudança de cor, detalhes a preto e película de proteção transparente, com vinil de qualidade aplicado com tempo."},{"id":"loja","name":"Loja","kind":"product","visible":true,"image":"","intro":"Os produtos que usamos, para tratares do carro em casa entre visitas."}],"items":[{"id":"lav-exterior","category":"lavagem","name":"Lavagem exterior","description":"O essencial bem feito: o carro limpo por fora, sem riscos novos.","includes":["Pré-lavagem com snow foam","Lavagem à mão com dois baldes","Jantes e pneus","Secagem com microfibra"],"duration":"1h","price":{"mode":"sizes","from":false,"values":[20,25,30],"value":0},"image":"","featured":false,"visible":true},{"id":"lav-completa","category":"lavagem","name":"Lavagem completa","description":"Por dentro e por fora, para o carro de todos os dias.","includes":["Lavagem exterior","Aspiração de bancos e tapetes","Tablier e plásticos","Vidros por dentro"],"duration":"1h30","price":{"mode":"sizes","from":false,"values":[35,40,50],"value":0},"image":"","featured":true,"visible":true},{"id":"lav-detalhada","category":"lavagem","name":"Lavagem detalhada","description":"Uma lavagem a fundo, com tempo para os detalhes que costumam ficar para trás.","includes":["Lavagem completa","Descontaminação rápida da pintura","Jantes e cavas a fundo","Selante de proteção rápido"],"duration":"3h","price":{"mode":"sizes","from":false,"values":[60,70,80],"value":0},"image":"","featured":false,"visible":true},{"id":"det-interior","category":"detailing","name":"Interior profundo","description":"Para manchas, cheiros e bancos cansados.","includes":["Aspiração a fundo","Extração de estofos e alcatifas","Limpeza e hidratação de pele","Tratamento de ozono"],"duration":"4h","price":{"mode":"sizes","from":false,"values":[110,130,150],"value":0},"image":"","featured":false,"visible":true},{"id":"det-polimento","category":"detailing","name":"Polimento e selante","description":"Tira a maioria dos riscos ligeiros e devolve o brilho à pintura.","includes":["Descontaminação férrica e barra de argila","Polimento numa fase","Selante com cerca de 6 meses"],"duration":"1 dia","price":{"mode":"sizes","from":false,"values":[220,260,300],"value":0},"image":"","featured":false,"visible":true},{"id":"det-correcao","category":"detailing","name":"Correção de pintura em 2 fases","description":"Para riscos marcados, hologramas e verniz baço.","includes":["Medição da espessura do verniz","Corte e acabamento à máquina","Selante no fim"],"duration":"2 dias","price":{"mode":"sizes","from":false,"values":[380,440,500],"value":0},"image":"","featured":false,"visible":true},{"id":"det-ceramico","category":"detailing","name":"Proteção cerâmica 3 anos","description":"Brilho que dura e lavagens mais fáceis: a água forma gotas e a sujidade agarra menos.","includes":["Descontaminação completa","Polimento numa fase","Revestimento cerâmico","Jantes e vidros protegidos"],"duration":"2 a 3 dias","price":{"mode":"sizes","from":false,"values":[590,690,790],"value":0},"image":"","featured":true,"visible":true},{"id":"det-farois","category":"detailing","name":"Restauro de faróis","description":"Faróis baços ou amarelados voltam a ficar transparentes. Preço por par.","includes":["Lixagem e polimento","Proteção UV"],"duration":"1h30","price":{"mode":"fixed","from":false,"values":[0,0,0],"value":45},"image":"","featured":false,"visible":true},{"id":"wrap-completo","category":"wrap","name":"Wrap completo","description":"Mudança de cor total. O vinil protege a pintura original e pode ser removido mais tarde.","includes":["Vinil de marca, à tua escolha de cor e acabamento","Desmontagem de puxadores, emblemas e faróis quando é preciso","Bordos e portas acabados à mão"],"duration":"5 a 7 dias","price":{"mode":"sizes","from":true,"values":[1600,1900,2300],"value":0},"image":"","featured":true,"visible":true},{"id":"wrap-parcial","category":"wrap","name":"Wrap parcial","description":"Tejadilho, capot, espelhos ou outras peças numa cor diferente.","includes":["Tejadilho preto brilhante ou noutra cor","Espelhos","Capot ou spoiler"],"duration":"1 dia","price":{"mode":"fixed","from":true,"values":[0,0,0],"value":120},"image":"","featured":false,"visible":true},{"id":"wrap-dechrome","category":"wrap","name":"Dechrome","description":"Frisos, grelhas e emblemas cromados passam a preto.","includes":["Frisos das janelas","Grelha e emblemas"],"duration":"1 dia","price":{"mode":"fixed","from":true,"values":[0,0,0],"value":150},"image":"","featured":false,"visible":true},{"id":"wrap-ppf","category":"wrap","name":"PPF frontal","description":"Película transparente que protege a frente do carro de pedras e riscos.","includes":["Para-choques","Capot e guarda-lamas parciais","Faróis e espelhos"],"duration":"2 dias","price":{"mode":"fixed","from":true,"values":[0,0,0],"value":750},"image":"","featured":false,"visible":true},{"id":"loja-kit","category":"loja","name":"Kit de manutenção","description":"Champô de pH neutro, quick detailer e duas microfibras.","includes":[],"duration":"","price":{"mode":"fixed","from":false,"values":[0,0,0],"value":39},"image":"","featured":false,"visible":true},{"id":"loja-luva","category":"loja","name":"Luva de lavagem","description":"Microfibra macia e densa, para lavar sem riscar.","includes":[],"duration":"","price":{"mode":"fixed","from":false,"values":[0,0,0],"value":12},"image":"","featured":false,"visible":true},{"id":"loja-ambientador","category":"loja","name":"Ambientador","description":"Fragrância suave, frasco de 50 ml.","includes":[],"duration":"","price":{"mode":"fixed","from":false,"values":[0,0,0],"value":9},"image":"","featured":false,"visible":true}],"gallery":[{"id":"g-foto","image":"img/ex-foto.webp","title":"Jante e pinças de travão, em detalhe","tag":"Detailing","example":true},{"id":"g-azul","image":"img/ex-azul.webp","title":"Simulação de wrap em azul metalizado","tag":"Wrap","example":true},{"id":"g-preto","image":"img/ex-preto.webp","title":"Simulação de wrap em preto acetinado","tag":"Wrap","example":true}],"simulator":{"visible":true,"priceItem":"wrap-completo","note":"É uma simulação aproximada. No estúdio mostramos-te as amostras reais do vinil."},"wrapColors":[{"id":"c-preto-b","name":"Preto","finish":"gloss","hex":"#0c0d0f","hex2":""},{"id":"c-branco","name":"Branco pérola","finish":"gloss","hex":"#ebe9e3","hex2":""},{"id":"c-nardo","name":"Cinza Nardo","finish":"gloss","hex":"#858886","hex2":""},{"id":"c-vermelho","name":"Vermelho","finish":"gloss","hex":"#b1141c","hex2":""},{"id":"c-azul","name":"Azul","finish":"metallic","hex":"#1f72c4","hex2":""},{"id":"c-bronze","name":"Bronze","finish":"metallic","hex":"#8a6a3c","hex2":""},{"id":"c-preto-s","name":"Preto","finish":"satin","hex":"#151618","hex2":""},{"id":"c-grafite","name":"Grafite","finish":"satin","hex":"#3f4346","hex2":""},{"id":"c-militar","name":"Verde militar","finish":"satin","hex":"#4a5a3f","hex2":""},{"id":"c-preto-m","name":"Preto","finish":"matte","hex":"#141414","hex2":""},{"id":"c-cinza-m","name":"Cinza","finish":"matte","hex":"#6a6d6f","hex2":""},{"id":"c-prata","name":"Prata","finish":"chrome","hex":"#c9ccd0","hex2":""},{"id":"c-flip","name":"Roxo e verde","finish":"flip","hex":"#5b2a86","hex2":"#1f8a6a"}],"faq":[{"id":"faq-1","q":"Quanto tempo demora?","a":"Depende do serviço. Uma lavagem leva entre 1 e 3 horas, uma correção de pintura 1 a 2 dias e um wrap completo cerca de uma semana. Dizemos-te o tempo certo quando marcares."},{"id":"faq-2","q":"Tenho de deixar o carro?","a":"Nas lavagens podes esperar ou voltar mais tarde. Para correção, cerâmico e wrap o carro fica connosco os dias que forem precisos."},{"id":"faq-3","q":"O wrap estraga a pintura?","a":"Numa pintura original em bom estado, não. O vinil protege a pintura por baixo e pode ser removido mais tarde. Em pinturas refeitas ou com o verniz danificado avaliamos o carro antes."},{"id":"faq-4","q":"Quanto tempo dura a proteção cerâmica?","a":"Cerca de 3 anos, com lavagens corretas. Na entrega explicamos-te como lavar o carro para a proteção durar."},{"id":"faq-5","q":"Fazem orçamentos sem compromisso?","a":"Sim. Manda fotos do carro pelo WhatsApp e respondemos com uma estimativa. Para correção de pintura e wrap, o preço fica fechado depois de vermos o carro."}],"texts":{"buttons":{"book":"Marcar","quote":"Pedir orçamento","prices":"Ver preços","whatsapp":"Falar no WhatsApp"},"messages":{"book":"Olá! Queria marcar.","quote":"Olá! Queria pedir um orçamento.","wrap":"Olá! Queria um orçamento para wrap.","question":"Olá! Tenho uma pergunta."},"services":{"menu":"Serviços","eyebrow":"Serviços","title":""},"simulator":{"menu":"Simulador","eyebrow":"Simulador de wrap","title":"Vê a cor antes de mudar."},"prices":{"menu":"Preços","eyebrow":"Preços","title":"Preços claros, sem surpresas."},"steps":{"visible":true,"eyebrow":"Como funciona","title":"Marcar é simples.","items":[{"title":"Diz-nos o carro","text":"Manda mensagem com a marca, o modelo e o que queres fazer. Fotos ajudam."},{"title":"Recebes o preço","text":"Respondemos com o preço e o tempo que demora. Para correção e wrap, vemos o carro primeiro."},{"title":"Deixas o carro","text":"Combinamos o dia e a hora. Tratamos dele com tempo, sem pressas."},{"title":"Levantas","text":"Mostramos-te o resultado e explicamos como manter o carro assim em casa."}]},"gallery":{"menu":"Trabalhos","eyebrow":"Trabalhos","title":"Trabalhos recentes."},"faq":{"eyebrow":"Perguntas frequentes","title":"Antes de marcar."},"contact":{"menu":"Contactos","eyebrow":"Contactos","title":"Marca a tua vez.","text":"Diz-nos o carro e o que precisa. Respondemos com o preço e a primeira data livre.","formTitle":"Pedido de orçamento","formText":"Preenche e envia pelo WhatsApp. A mensagem vai pronta, só tens de carregar em enviar."}},"seo":{"title":"","description":"","image":""}}$conteudo$::jsonb;
  doc jsonb;
begin
  if exists (select 1 from public.site_settings where id = 'main') then
    if to_regclass('public.site_content') is not null then
      execute 'drop table public.site_content';
    end if;
    return;
  end if;
  if to_regclass('public.site_content') is not null then
    execute 'select data from public.site_content where id = ''main''' into doc;
  end if;
  if jsonb_typeof(doc) = 'object' then
    -- o painel antigo não tinha textos das secções, nem Google, nem ids nas perguntas
    if doc->'texts' is null then doc := doc || jsonb_build_object('texts', seed->'texts'); end if;
    if doc->'seo' is null then doc := doc || jsonb_build_object('seo', seed->'seo'); end if;
    doc := jsonb_set(doc, '{faq}', coalesce((
      select jsonb_agg(case when coalesce(e->>'id', '') = '' then e || jsonb_build_object('id', 'faq-' || n) else e end order by n)
      from jsonb_array_elements(private.arr(doc->'faq')) with ordinality as t(e, n)), '[]'::jsonb));
  else
    doc := seed;
  end if;
  perform private.check_site(doc);
  perform private.write_site(doc, date_trunc('milliseconds', clock_timestamp()));
  if to_regclass('public.site_content') is not null then
    execute 'drop table public.site_content';
  end if;
end $$;

-- A API do Supabase passa a ver as funções novas
notify pgrst, 'reload schema';

-- Confirmação: deve mostrar 4 categorias, 15 serviços e produtos, 3 fotos, 13 cores e 5 perguntas
-- (ou os números do que já tinhas publicado)
select (select count(*) from public.categories) as categorias,
       (select count(*) from public.items) as servicos_e_produtos,
       (select count(*) from public.gallery) as fotos,
       (select count(*) from public.wrap_colors) as cores,
       (select count(*) from public.faq) as perguntas,
       (select count(*) from private.admin_emails) as emails_autorizados;
