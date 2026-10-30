-- Niche Detail · muda a palavra-passe da conta de administrador
-- Supabase → SQL Editor → New query → colar → trocar ESCREVE-AQUI-A-NOVA pela palavra-passe nova → Run.
-- (mínimo 8 caracteres, sem plicas '). Depois de correr, apaga esta query do editor (o Supabase guarda o texto).

do $$
declare
  mail text := 'antoniooc.net@gmail.com';
  pass text := 'ESCREVE-AQUI-A-NOVA';
begin
  if pass like 'ESCREVE-AQUI%' or length(pass) < 8 then
    raise exception 'Escreve a palavra-passe nova na linha pass text (mínimo 8 caracteres).';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(pass, extensions.gen_salt('bf')),
         updated_at = now()
   where lower(email) = lower(mail);
  if not found then
    raise exception 'Não existe nenhuma conta com o email %. Corre primeiro o criar-admin.sql.', mail;
  end if;
end $$;

-- Confirmação: o teu email, com a hora da mudança
select email, updated_at as mudada_em from auth.users where email = 'antoniooc.net@gmail.com';
