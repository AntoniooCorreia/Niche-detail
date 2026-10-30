# Niche Detail

Site da Niche Detail (detailing, lavagem e wrap) com painel de administração. O conteúdo vive no Supabase e o site é publicado no Vercel a partir do GitHub.

## Como está organizado

```
public/              o que o Vercel publica
  assets/            app.js (site e simulador), admin.js (painel), CSS
  img/               carro do topo (car.webp), imagens dos serviços e exemplos
  img/sim/           mapas do simulador de wrap, feitos a partir da foto do carro
  data/site.json     conteúdo inicial, usado se o Supabase não responder
  admin.html         atalho para /admin
scripts/build.js     gera public/index.html e public/config.js
supabase/schema.sql  tabelas e regras de acesso (já aplicadas no projeto)
vercel.json          diz ao Vercel para correr o build e publicar a pasta public
```

`public/index.html` e `public/config.js` são gerados pelo build e não vão para o Git.

## Base de dados (já está feita)

O projeto `niche-detail` no Supabase já tem as tabelas, as regras de acesso, o espaço para fotos e o conteúdo atual do site. O teu email `antoniooc.net@gmail.com` está autorizado como administrador.

Falta só criares a tua conta e fechares os registos:

1. No Supabase, abre o projeto **niche-detail** → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Põe o email `antoniooc.net@gmail.com` e uma palavra-passe, deixa ligado **Auto Confirm User** e carrega em **Create user**. A conta passa a administrador sozinha.
3. Em **Authentication** → **Sign In / Providers**, desliga **Allow new users to sign up**, para mais ninguém criar contas.

## Correr no computador

Precisas do Node 18 ou mais recente.

```bash
cp .env.example .env   # já traz os valores do teu projeto Supabase
npm run dev            # abre em http://localhost:3000
```

O painel fica em http://localhost:3000/admin. Atenção: com o `.env`, o painel local mexe no mesmo Supabase do site publicado.

## GitHub (no VS Code)

1. Abre a pasta no VS Code: **File** → **Open Folder**.
2. Separador **Source Control** (Ctrl+Shift+G) → **Publish to GitHub** → escolhe **private repository**.

O VS Code cria o repositório, faz o primeiro commit e envia tudo. O `.env` não vai, porque está no `.gitignore`.

## Vercel

1. Em vercel.com → **Add New…** → **Project** → importa o repositório `niche-detail` do GitHub.
2. Não mexas no Framework, no Build nem no Output: o `vercel.json` já trata disso.
3. Abre **Environment Variables** e acrescenta as duas do `.env.example`:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
4. **Deploy**. Em cerca de um minuto tens o site em `https://niche-detail-….vercel.app`.

A partir daqui, cada `git push` para a `main` publica uma versão nova sozinho.

## Depois do primeiro deploy

1. No Supabase → **Authentication** → **URL Configuration**:
   - **Site URL**: o endereço do Vercel (ou o teu domínio, quando o tiveres).
   - **Redirect URLs**: acrescenta também `http://localhost:3000`.

   Assim o email de «Esqueci-me da palavra-passe» leva-te ao sítio certo.
2. Abre `/admin` no site, entra com o teu email e palavra-passe e experimenta mudar um preço e carregar em **Publicar**.

## Domínio próprio

No Vercel → projeto → **Settings** → **Domains** → **Add**. O Vercel mostra os registos DNS exatos a criar onde compraste o domínio: normalmente um registo A para `exemplo.pt` e um CNAME para `www`. O certificado HTTPS é automático.

Depois volta a atualizar o **Site URL** no Supabase com o domínio novo.

## No dia a dia

- **Conteúdo** (preços, serviços, produtos, fotos, contactos, perguntas): usa o painel em `/admin`. As alterações aparecem logo no site, sem deploy.
- **Código e design**: edita no VS Code, faz commit e push. O Vercel publica sozinho.
- O HTML que o Google lê é gerado em cada deploy com o conteúdo do Supabase. Se mudares muito conteúdo e quiseres o Google atualizado mais cedo, faz **Redeploy** no Vercel.

## Antes de lançar

- Troca os contactos, os preços e as respostas das perguntas, que são de exemplo.
- Apaga as três fotos marcadas «Exemplo» na galeria quando tiveres as tuas.
- O carro do topo e do simulador é a imagem do BMW M4 que enviaste (3840×2160, com fundo transparente). Aparece sem alterações e sem ampliação. A mesma imagem foi usada no serviço Wrap e nos exemplos da galeria.
- Se essa imagem veio do site ou do configurador da BMW, os direitos são da BMW. Para o site público, o mais seguro é trocares por uma foto tua (ou teres autorização).
- As imagens dos serviços Lavagem e Detailing ainda são renders 3D feitos a partir do modelo «Car Concept» (CC BY 4.0). Enquanto lá estiverem, mantém o crédito do rodapé. Troca-as por fotos tuas no painel (Categorias → foto).
