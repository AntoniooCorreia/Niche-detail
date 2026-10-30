-- Niche Detail · cria o teu utilizador de administrador
-- Corre DEPOIS do setup.sql, no SQL Editor:
--   1) muda SÓ a linha  pass text := '...'  : troca ESCREVE-AQUI-A-PALAVRA-PASSE pela tua palavra-passe
--      (mínimo 8 caracteres, sem plicas ');
--   2) Run. No fim tem de aparecer admin = true.
-- Depois de correr, apaga esta query do editor (o Supabase guarda o texto).

do $$
declare
  uid  uuid;
  mail text := 'antoniooc.net@gmail.com';
  pass text := 'ESCREVE-AQUI-A-PALAVRA-PASSE';
begin
  select id into uid from auth.users where lower(email) = lower(mail);
  if uid is null then
    if pass like 'ESCREVE-AQUI%' or length(pass) < 8 then
      raise exception 'Falta pôr a tua palavra-passe na linha pass text (mínimo 8 caracteres).';
    end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      mail, extensions.crypt(pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
      'email', now(), now(), now());
  end if;
  -- garante o acesso de administrador mesmo que a conta já existisse
  insert into public.admins (user_id) values (uid) on conflict do nothing;
end $$;

-- Confirmação: o teu email com confirmado = true e admin = true
select u.email,
       u.email_confirmed_at is not null as confirmado,
       exists (select 1 from public.admins a where a.user_id = u.id) as admin
from auth.users u;
