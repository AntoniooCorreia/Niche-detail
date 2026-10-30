#!/usr/bin/env node
/* Gera public/index.html e public/config.js.
   O Vercel corre isto em cada deploy (npm run build). No teu computador corre com npm run dev.

   Variáveis de ambiente (no Vercel: Settings → Environment Variables; no computador: ficheiro .env):
     SUPABASE_URL              ex.: https://xxxx.supabase.co
     SUPABASE_PUBLISHABLE_KEY  ex.: sb_publishable_...
   Também aceita os nomes NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e *_ANON_KEY,
   que a integração Supabase do Vercel cria sozinha.
     SITE_URL                  opcional, ex.: https://www.nichedetail.pt (sem isto usa o endereço do Vercel)

   O conteúdo vem das tabelas do Supabase (função get_site). O public/data/site.json é o conteúdo inicial:
   só se usa sem Supabase ou enquanto a base de dados estiver vazia. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');

// .env no computador (no Vercel as variáveis já vêm do painel)
for (const file of ['.env.local', '.env']) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = (...names) => names.map(n => (process.env[n] || '').trim()).find(Boolean) || '';
const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const key = env('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Endereço público do site, para as partilhas no WhatsApp/Facebook levarem imagem.
// No Vercel vem sozinho (VERCEL_PROJECT_PRODUCTION_URL); com domínio próprio podes pôr SITE_URL=https://www.exemplo.pt
const siteUrl = (env('SITE_URL') || (env('VERCEL_PROJECT_PRODUCTION_URL') ? 'https://' + env('VERCEL_PROJECT_PRODUCTION_URL') : '')).replace(/\/+$/, '');

const N = require(path.join(pub, 'assets', 'app.js'));

async function main() {
  let data = JSON.parse(fs.readFileSync(path.join(pub, 'data', 'site.json'), 'utf8'));
  let source = 'public/data/site.json';

  // Com o Supabase ligado, o HTML sai já com o conteúdo das tabelas (bom para o Google e para as partilhas).
  // public/data/site.json só se usa sem Supabase ou se a base de dados ainda estiver vazia.
  if (url && key) {
    try {
      const fresh = await N.fetchSite(fetch, url, key);
      if (fresh) { data = fresh; source = 'Supabase'; }
      else console.warn('Aviso: o Supabase ainda não tem conteúdo. Corre o supabase/setup.sql no SQL Editor. Por agora uso o public/data/site.json.');
    } catch (e) {
      console.warn(`Aviso: não consegui ler o conteúdo do Supabase (${e.message}). Uso o public/data/site.json.`);
    }
  }

  fs.writeFileSync(path.join(pub, 'index.html'), N.buildDocument(data, 'production', { siteUrl }));
  fs.writeFileSync(path.join(pub, 'config.js'),
    '/* Gerado por scripts/build.js a partir das variáveis de ambiente. Não edites à mão. */\n'
    + `window.NICHE_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }, null, 2)};\n`);

  console.log(`index.html gerado a partir de ${source}.`);
  console.log(url && key ? `Supabase ligado: ${url}` : 'Supabase não configurado: o painel funciona em modo local (só neste browser).');
}

main().catch(e => { console.error(e); process.exit(1); });
