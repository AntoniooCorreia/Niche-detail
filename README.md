# Niche Detail

Site da Niche Detail (detailing, lavagem e wrap) com painel de administração. Todo o conteúdo vive em tabelas no Supabase e muda-se no painel, em `/admin`. O site está publicado no Vercel em https://nichedetail.vercel.app.

## Como está organizado

```
public/                 o que o Vercel publica
  assets/               app.js (site, simulador, ligação ao Supabase), admin.js (painel), CSS
  img/                  carro do topo, imagens de origem dos serviços, exemplos da galeria
  img/sim/              mapas do simulador de wrap, feitos a partir da foto do carro
  data/site.json        conteúdo inicial: só se usa sem Supabase ou com a base de dados vazia
  admin.html            atalho para /admin
scripts/build.js        gera public/index.html e public/config.js a partir das tabelas
supabase/setup.sql      base de dados completa (tabelas, regras, funções, conteúdo inicial)
supabase/criar-admin.sql        cria a conta de administrador
supabase/mudar-palavra-passe.sql muda a palavra-passe dessa conta
vercel.json             diz ao Vercel para correr o build e publicar a pasta public
```

`public/index.html` e `public/config.js` são gerados pelo build e não vão para o Git.

## Base de dados

| Tabela | O que guarda |
| --- | --- |
| `site_settings` | uma linha só: dados do negócio e logótipo, topo do site, tamanhos e nota de preços, simulador, textos das secções, Google |
| `categories` | separadores da tabela de preços; `kind` = `service` (serviços) ou `product` (produtos à venda) |
| `items` | serviços e produtos, cada um com a sua categoria (`category_id`), preço e foto |
| `gallery` | fotos dos trabalhos |
| `wrap_colors` | cores do simulador |
| `faq` | perguntas frequentes |
| `admins` | contas que podem entrar no painel |

A coluna `position` de cada tabela é a ordem em que as coisas aparecem no site.

- O site lê tudo de uma vez com a função `get_site()`.
- O painel grava com `publish_site()`: tudo numa só transação, e só se a conta estiver em `admins`. Se entretanto alguém publicou a partir de outro dispositivo, não grava e avisa.
- As fotos carregadas no painel ficam no Storage, no espaço `media`.
- Toda a gente pode ler; só administradores escrevem (regras RLS em todas as tabelas).

### Montar ou atualizar

Supabase → **SQL Editor** → **New query** → cola o `supabase/setup.sql` inteiro → **Run**.

Serve para um projeto novo e para atualizar o que já tens, e pode ser corrido mais do que uma vez. Se o Supabase avisar de «operações destrutivas», é a tabela antiga `site_content`, que é apagada depois de o conteúdo passar para as tabelas novas.

No fim aparece quantas categorias, serviços e produtos, fotos, cores e perguntas ficaram nas tabelas.

### Conta de administrador

- **Criar**: abre o `supabase/criar-admin.sql`, muda só a linha da palavra-passe e corre-o no SQL Editor.
- **Mudar a palavra-passe**: mesmo processo com o `supabase/mudar-palavra-passe.sql`.
- **Fechar os registos**: Supabase → **Authentication** → **Sign In / Providers** → desliga **Allow new users to sign up**.
- **Dar acesso a outra pessoa**: acrescenta o email dela no `setup.sql` (linha `insert into private.admin_emails`) e corre-o outra vez. Quando ela criar conta com esse email, passa a administrador sozinha.

## O painel

Entra em `/admin` com o teu email e palavra-passe. Tudo o que mudares fica num rascunho até carregares em **Publicar**. **Pré-visualizar** mostra o site com as alterações antes de publicar.

- **Catálogo**: **Novo serviço** e **Novo produto**. Os produtos aparecem em cartões com foto e botão «Encomendar».
- **Categorias**: os separadores da tabela de preços. Uma categoria do tipo «Produtos à venda» é uma loja.
- **Galeria**: fotos dos trabalhos.
- **Simulador de wrap**: as cores.
- **Página inicial**: título, texto, destaques e foto do topo.
- **Textos das secções**: menu, títulos e textos de cada parte do site, os passos de «Como funciona», os botões e as mensagens que aparecem já escritas no WhatsApp.
- **Contactos e horário**: nome do negócio, WhatsApp, telefone, email, Instagram, morada e horário.
- **Perguntas frequentes**.
- **Logótipo e Google**: logótipo, título e descrição no Google, imagem das partilhas.

Fixos no código ficam só o carro do simulador (precisa dos mapas em `img/sim/`) e as palavras pequenas da interface, como «Copiar», «Encomendar» ou os nomes dos campos do formulário.

## Correr no computador

Precisas do Node 18 ou mais recente.

```bash
cp .env.example .env   # já traz os valores do teu projeto Supabase
npm run dev            # abre em http://localhost:3000
```

O painel fica em http://localhost:3000/admin. Atenção: com o `.env`, o painel local mexe no mesmo Supabase do site publicado.

## Publicar código

```bash
git add -A
git commit -m "o que mudou"
git push
npx vercel --prod
```

Com o repositório ligado ao Vercel (`npx vercel git connect`), o `git push` chega e o último comando deixa de ser preciso.

As variáveis do Vercel (**Settings** → **Environment Variables**) são as do `.env.example`: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Com domínio próprio, acrescenta `SITE_URL` (ex.: `https://www.nichedetail.pt`) para as partilhas usarem esse endereço.

## Refazer o site sozinho ao publicar (recomendado)

O conteúdo publicado no painel aparece logo no site. Mas o HTML que o Google e o WhatsApp leem (título, descrição, imagem das partilhas) só muda num deploy. Para cada publicação pedir um deploy ao Vercel:

1. Liga o repositório ao Vercel, se ainda não estiver: `npx vercel git connect`.
2. No Vercel → projeto → **Settings** → **Git** → **Deploy Hooks**: nome `painel`, branch `main` → **Create Hook** → copia o endereço.
3. No Supabase → **SQL Editor**:

   ```sql
   select private.set_deploy_hook('https://api.vercel.com/v1/integrations/deploy/...');
   ```

Para desligar: `select private.set_deploy_hook(null);`

## Supabase: endereços

Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `https://nichedetail.vercel.app` (ou o teu domínio, quando o tiveres).
- **Redirect URLs**: acrescenta `https://nichedetail.vercel.app/**` e `http://localhost:3000/**`.

Assim o email de «Esqueci-me da palavra-passe» leva-te ao sítio certo.

## Domínio próprio

No Vercel → projeto → **Settings** → **Domains** → **Add**. O Vercel mostra os registos DNS exatos a criar onde compraste o domínio: normalmente um registo A para `exemplo.pt` e um CNAME para `www`. O certificado HTTPS é automático.

Depois atualiza o **Site URL** no Supabase e põe `SITE_URL` no Vercel.

## Antes de lançar

- Troca os contactos (o WhatsApp de exemplo é `351900000000`), os preços e as respostas das perguntas.
- Apaga as três fotos marcadas «Exemplo» na galeria quando tiveres as tuas.
- O carro do topo e do simulador é a imagem do BMW M4 que enviaste. Se veio do site ou do configurador da BMW, os direitos são da BMW: para o site público, o mais seguro é trocares por uma foto tua (Página inicial → Foto principal) ou teres autorização.
- As imagens de origem dos serviços Lavagem e Detailing são renders 3D feitos a partir do modelo «Car Concept» (CC BY 4.0). Enquanto aparecerem, o rodapé mostra o crédito sozinho; quando puseres fotos tuas em **Categorias**, o crédito desaparece.
