/* Niche Detail — site público, dados e ligação ao painel.
   O mesmo ficheiro corre no browser e no build (node), para o HTML publicado sair igual ao que o site desenha. */
(function (root, factory) {
  var N = factory();
  if (typeof module === 'object' && module.exports) module.exports = N;
  else { root.NICHE = N; N.boot(); }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ------------------------------------------------------------------ utilidades */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const uid = (p) => (p || 'x') + '-' + Math.random().toString(36).slice(2, 9);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const num = v => { const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const fmtNum = n => {
  const v = Math.round(num(n));
  const s = String(Math.abs(v));
  const g = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : s;
  return (v < 0 ? '-' : '') + g;
};
const euro = n => fmtNum(n) + ' €';
const safeSrc = u => {
  u = String(u || '').trim();
  return /^(https?:\/\/|\/(?!\/)|img\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(u) ? u : '';
};
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h || '')) ? h : '#888888';

const FINISHES = [
  { id: 'gloss', label: 'Brilhante' },
  { id: 'metallic', label: 'Metalizado' },
  { id: 'satin', label: 'Acetinado' },
  { id: 'matte', label: 'Mate' },
  { id: 'chrome', label: 'Cromado' },
  { id: 'flip', label: 'Camaleão' }
];
const finishLabel = id => (FINISHES.find(f => f.id === id) || { label: '' }).label;

const ICON = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
};

/* ------------------------------------------------------------------ dados */
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  d.business = Object.assign({ name: 'Niche Detail', zone: '', whatsapp: '', phone: '', email: '', instagram: '', address: '', mapsUrl: '', hours: [], hoursNote: '' }, d.business);
  d.hero = Object.assign({ eyebrow: '', title: '', text: '', highlights: [], image: '' }, d.hero);
  d.sizes = Array.isArray(d.sizes) && d.sizes.length === 3 ? d.sizes : ['Citadino', 'Berlina / Carrinha', 'SUV / Monovolume'];
  d.categories = Array.isArray(d.categories) ? d.categories : [];
  d.items = Array.isArray(d.items) ? d.items : [];
  d.gallery = Array.isArray(d.gallery) ? d.gallery : [];
  d.wrapColors = Array.isArray(d.wrapColors) ? d.wrapColors : [];
  d.faq = Array.isArray(d.faq) ? d.faq : [];
  d.simulator = Object.assign({ visible: true, priceItem: '', note: '' }, d.simulator);
  d.items.forEach(it => {
    it.price = Object.assign({ mode: 'fixed', from: false, values: [0, 0, 0], value: 0 }, it.price);
    if (!Array.isArray(it.price.values)) it.price.values = [0, 0, 0];
    if (!Array.isArray(it.includes)) it.includes = [];
  });
  return d;
}
const visibleItems = (d, catId) => d.items.filter(i => i.visible !== false && (!catId || i.category === catId));
function priceLow(it) {
  const p = it.price || {};
  if (p.mode === 'quote') return null;
  if (p.mode === 'sizes') { const v = (p.values || []).map(num).filter(x => x > 0); return v.length ? Math.min.apply(null, v) : null; }
  return num(p.value) > 0 ? num(p.value) : null;
}
function catFrom(d, catId) {
  const v = visibleItems(d, catId).map(priceLow).filter(x => x != null);
  return v.length ? Math.min.apply(null, v) : null;
}
function priceText(it, size) {
  const p = it.price || {};
  if (p.mode === 'quote') return 'sob orçamento';
  const v = p.mode === 'sizes' ? num((p.values || [])[size || 0]) : num(p.value);
  return (p.from ? 'desde ' : '') + euro(v);
}
function wa(d, text) {
  const n = String(d.business.whatsapp || '').replace(/\D/g, '');
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}
const bookMsg = (d, it, size) => {
  const cat = d.categories.find(c => c.id === it.category);
  if (cat && cat.kind === 'product') return `Olá! Queria encomendar: ${it.name} (${priceText(it, size)}).`;
  const sz = it.price && it.price.mode === 'sizes' ? ` para ${d.sizes[size || 0]}` : '';
  return `Olá! Queria marcar: ${it.name}${sz} (${priceText(it, size)}).`;
};

/* ------------------------------------------------------------------ HTML do site */
const NUM_WORD = { 2: 'Duas', 3: 'Três', 4: 'Quatro', 5: 'Cinco' };
const PILLAR_IMG = { lavagem: 'img/car-beads.webp', detailing: 'img/car-split.webp', wrap: 'img/car-wrap.webp' };
const STEPS = [
  ['Diz-nos o carro', 'Manda mensagem com a marca, o modelo e o que queres fazer. Fotos ajudam.'],
  ['Recebes o preço', 'Respondemos com o preço e o tempo que demora. Para correção e wrap, vemos o carro primeiro.'],
  ['Deixas o carro', 'Combinamos o dia e a hora. Tratamos dele com tempo, sem pressas.'],
  ['Levantas', 'Mostramos-te o resultado e explicamos como manter o carro assim em casa.']
];

function priceHTML(it) {
  const p = it.price || {};
  if (p.mode === 'quote') return '<span class="pv pv--quote"><b>Sob orçamento</b></span>';
  const pre = p.from ? '<small>desde</small>' : '';
  if (p.mode === 'sizes') return (p.values || []).map((v, i) => `<span class="pv" data-s="${i}">${pre}<b>${euro(v)}</b></span>`).join('');
  return `<span class="pv">${pre}<b>${euro(p.value)}</b></span>`;
}

function renderHeader(d, nav) {
  const links = nav.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('');
  return `<header class="hdr" id="hdr"><div class="wrap hdr__in">
<a class="brand" href="#inicio" aria-label="${esc(d.business.name)}, início"><img src="img/logo.png" alt="" width="42" height="42"><span class="brand__name">Niche<span>Detail</span></span></a>
<nav class="nav" aria-label="Secções">${links}</nav>
<a class="btn btn--primary btn--sm hdr__cta" href="${esc(wa(d, 'Olá! Queria marcar.'))}" target="_blank" rel="noopener">Marcar</a>
<button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="mnav"><i></i>Menu</button>
</div>
<nav class="mnav" id="mnav" aria-label="Menu" hidden><div class="wrap">${links}<a class="btn btn--primary btn--block" href="${esc(wa(d, 'Olá! Queria marcar.'))}" target="_blank" rel="noopener">${ICON.chat}Marcar pelo WhatsApp</a></div></nav>
</header>`;
}

function renderHero(d) {
  const h = d.hero;
  const facts = (h.highlights || []).filter(Boolean).map(t => `<li>${ICON.check}${esc(t)}</li>`).join('')
    + (d.business.zone ? `<li>${ICON.pin}${esc(d.business.zone)}</li>` : '');
  const img = safeSrc(h.image);
  const stage = img
    ? `<div class="stage stage--photo"><img src="${esc(img)}" alt="${esc(h.title)}"></div>`
    : `<div class="stage"><img class="stage__car" src="img/car.webp" srcset="img/car-1800.webp 1800w, img/car.webp 3325w" sizes="(min-width: 1240px) 1180px, 100vw" width="3325" height="1064" fetchpriority="high" alt="BMW M4 branco, visto de lado"><div class="stage__refl" aria-hidden="true"><img src="img/car-1800.webp" alt="" width="1800" height="576"></div></div>`;
  return `<section class="hero" id="inicio">
<div class="wrap hero__grid">
<div><p class="eyebrow t-label">${esc(h.eyebrow)}</p><h1 class="t-display">${esc(h.title)}</h1></div>
<div class="hero__side"><p class="hero__text">${esc(h.text)}</p>
<div class="hero__cta"><a class="btn btn--primary" href="${esc(wa(d, 'Olá! Queria pedir um orçamento.'))}" target="_blank" rel="noopener">${ICON.chat}Pedir orçamento</a><a class="btn btn--ghost" href="#precos">Ver preços</a></div></div>
</div>
${stage}
<div class="wrap"><ul class="facts">${facts}</ul></div>
</section>`;
}

function renderServices(d, services) {
  if (!services.length) return '';
  const word = NUM_WORD[services.length];
  const title = word ? `${word} formas de cuidar do teu carro.` : 'Como cuidamos do teu carro.';
  const cards = services.map(c => {
    const own = safeSrc(c.image);
    const from = catFrom(d, c.id);
    const img = own
      ? `<img class="is-photo" src="${esc(own)}" alt="" loading="lazy">`
      : PILLAR_IMG[c.id] ? `<img class="is-photo" src="${PILLAR_IMG[c.id]}" alt="" loading="lazy" width="1440" height="900">`
      : '<img src="img/car-1800.webp" alt="" loading="lazy" width="1800" height="576">';
    const ba = !own && c.id === 'detailing' ? '<span class="ba ba--l t-label">Antes</span><span class="ba ba--r t-label">Depois</span>' : '';
    return `<article class="pillar">
<a class="pillar__img" href="#precos" data-tab="${esc(c.id)}" aria-label="Ver preços de ${esc(c.name)}">${img}${ba}</a>
<h3>${esc(c.name)}</h3><p>${esc(c.intro)}</p>
<div class="pillar__foot"><span class="pillar__from">${from != null ? `Desde <b>${euro(from)}</b>` : 'Sob orçamento'}</span><a class="more" href="#precos" data-tab="${esc(c.id)}">Ver preços</a></div>
</article>`;
  }).join('');
  return `<section class="sec" id="servicos"><div class="wrap">
<header class="sec__head"><p class="eyebrow t-label">Serviços</p><h2 class="t-display h2">${title}</h2></header>
<div class="pillars">${cards}</div>
</div></section>`;
}

function renderSim(d) {
  const colors = d.wrapColors.filter(c => c && c.name);
  if (d.simulator.visible === false || !colors.length) return '';
  const pItem = d.items.find(i => i.id === d.simulator.priceItem && i.visible !== false);
  const low = pItem ? priceLow(pItem) : null;
  const priceLine = pItem && low != null ? `<p class="sim__price">${esc(pItem.name)} desde <b>${euro(low)}</b></p>` : '<p class="sim__price"></p>';
  const groups = FINISHES.map(f => {
    const cs = colors.filter(c => c.finish === f.id);
    if (!cs.length) return '';
    return `<div class="sim__group"><p class="t-label">${f.label}</p><div class="sws">${cs.map(c =>
      `<button type="button" class="sw" data-sw="${esc(c.id)}" data-f="${f.id}" style="--c:${hexOk(c.hex)};--c2:${hexOk(c.hex2 || c.hex)}" aria-pressed="false" title="${esc(c.name)} · ${f.label}"><span class="sr">${esc(c.name)}, ${f.label}</span></button>`
    ).join('')}</div></div>`;
  }).join('');
  return `<section class="sim" id="simulador"><div class="wrap sim__grid">
<div class="sim__copy"><p class="eyebrow t-label">Simulador de wrap</p><h2 class="t-display h2">Vê a cor antes de mudar.</h2><p>${esc(d.simulator.note)}</p></div>
<div class="sim__pick" aria-live="polite"><p class="t-label" style="color:var(--on-night-2);margin:0 0 4px">A tua escolha</p><p class="sim__name" id="simName">Verde original</p><p class="sim__fin" id="simFin">Pintura de origem</p>${priceLine}<a class="btn btn--light" id="simCta" href="${esc(wa(d, 'Olá! Queria um orçamento para wrap.'))}" target="_blank" rel="noopener">${ICON.chat}Pedir orçamento com esta cor</a></div>
<div class="sim__stage"><div class="sim__car"><img src="img/car.webp" srcset="img/car-1800.webp 1800w, img/car.webp 3325w" sizes="(min-width: 1140px) 1080px, 100vw" width="3325" height="1064" loading="lazy" alt="O carro na cor escolhida, em simulação"><canvas id="simCanvas" width="2000" height="640" aria-hidden="true" hidden></canvas></div></div>
<div class="sim__colors"><div class="sim__group"><p class="t-label">Original</p><div class="sws"><button type="button" class="sw" data-sw="original" data-f="original" style="--c:#f0f0ee" aria-pressed="true" title="Branco original"><span class="sr">Branco original</span></button></div></div>${groups}
<div class="sim__group sim__any"><p class="t-label">Qualquer cor</p><div class="any">
<label class="sw sw--any" data-sw="custom" data-f="custom" style="--c:#1e4a2f" aria-pressed="false" title="Escolher qualquer cor"><input type="color" id="simAny" value="#1e4a2f" aria-label="Escolher qualquer cor"></label>
<input class="hexin" id="simHex" value="#1E4A2F" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código da cor, por exemplo #1E4A2F">
<div class="fins" role="radiogroup" aria-label="Acabamento">${FINISHES.filter(f => f.id !== 'flip').map((f, i) => `<button type="button" role="radio" data-anyfin="${f.id}" aria-checked="${i === 0}">${f.label}</button>`).join('')}</div>
</div></div></div>
</div></section>`;
}

function renderPrices(d, cats) {
  if (!cats.length) return '';
  const tabs = cats.map((c, i) => `<button type="button" class="tab" role="tab" id="t-${esc(c.id)}" data-tab="${esc(c.id)}" aria-controls="p-${esc(c.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(c.name)}</button>`).join('');
  const sizeBtns = d.sizes.map((s, i) => `<button type="button" role="radio" data-size="${i}" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(s)}</button>`).join('');
  const hasSizes = c => visibleItems(d, c.id).some(i => i.price.mode === 'sizes');
  const panels = cats.map((c, ci) => {
    const its = visibleItems(d, c.id);
    let body;
    if (c.kind === 'product') {
      body = `<div class="prods">${its.map(it => {
        const im = safeSrc(it.image);
        const ph = `<div class="prod__ph" aria-hidden="true"><span>${esc(it.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span></div>`;
        return `<article class="prod" id="i-${esc(it.id)}"><div class="prod__img">${im ? `<img src="${esc(im)}" alt="${esc(it.name)}" loading="lazy">` : ph}</div>
<div class="prod__body"><h3>${esc(it.name)}${it.featured ? ' <span class="tag t-label">Recomendado</span>' : ''}</h3><p>${esc(it.description)}</p>
<div class="prod__foot"><p class="price">${priceHTML(it)}</p><a class="btn btn--ghost btn--sm" data-book="${esc(it.id)}" href="${esc(wa(d, bookMsg(d, it, 0)))}" target="_blank" rel="noopener">Encomendar</a></div></div></article>`;
      }).join('')}</div>`;
    } else {
      body = `<ul class="items">${its.map(it => {
        const inc = (it.includes || []).filter(Boolean);
        return `<li class="item" id="i-${esc(it.id)}"><div><h3 class="item__name">${esc(it.name)}${it.featured ? '<span class="tag t-label">Recomendado</span>' : ''}</h3>
<p class="item__desc">${esc(it.description)}</p>${inc.length ? `<ul class="item__inc">${inc.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>
<div class="item__side"><p class="price">${priceHTML(it)}</p>${it.duration ? `<p class="item__time t-label">${esc(it.duration)}</p>` : ''}<a class="btn btn--ghost btn--sm" data-book="${esc(it.id)}" href="${esc(wa(d, bookMsg(d, it, 0)))}" target="_blank" rel="noopener">Marcar</a></div></li>`;
      }).join('')}</ul>`;
    }
    return `<div class="panel" role="tabpanel" id="p-${esc(c.id)}" data-panel="${esc(c.id)}" data-sizes="${hasSizes(c) ? 1 : 0}" aria-labelledby="t-${esc(c.id)}"${ci ? ' hidden' : ''}>${c.intro ? `<p class="cat-intro">${esc(c.intro)}</p>` : ''}${body}</div>`;
  }).join('');
  return `<section class="sec sec--wall" id="precos"><div class="wrap">
<header class="sec__head sec__head--split"><div><p class="eyebrow t-label">Preços</p><h2 class="t-display h2">Preços claros, sem surpresas.</h2></div><p class="lede">${esc(d.priceNote)}</p></header>
<div class="ptools"><div class="tabs" role="tablist" aria-label="Categorias">${tabs}</div><div class="sizes" id="sizes" role="radiogroup" aria-label="Tamanho do carro"${hasSizes(cats[0]) ? '' : ' hidden'}><span class="sizes__label t-label">Tamanho</span>${sizeBtns}</div></div>
<div class="panels" id="panels" data-size="0">${panels}</div>
</div></section>`;
}

function renderSteps() {
  return `<section class="sec" id="como-funciona"><div class="wrap">
<header class="sec__head"><p class="eyebrow t-label">Como funciona</p><h2 class="t-display h2">Marcar é simples.</h2></header>
<ol class="steps">${STEPS.map((s, i) => `<li><span class="steps__n t-label">Passo ${i + 1}</span><h3>${s[0]}</h3><p>${s[1]}</p></li>`).join('')}</ol>
</div></section>`;
}

function renderGallery(d, gal) {
  if (!gal.length) return '';
  const ig = d.business.instagram ? `<a class="more" href="https://instagram.com/${esc(d.business.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Mais no Instagram</a>` : '';
  return `<section class="sec" id="trabalhos"><div class="wrap">
<header class="sec__head sec__head--split"><div><p class="eyebrow t-label">Trabalhos</p><h2 class="t-display h2">Trabalhos recentes.</h2></div><div>${ig}</div></header>
<div class="gal">${gal.map((g, i) => `<figure><button type="button" class="gal__btn" data-gal="${i}" aria-label="Ver em grande: ${esc(g.title || 'foto')}"><img src="${esc(safeSrc(g.image))}" alt="${esc(g.title)}" loading="lazy"></button>
<figcaption><span>${esc(g.title)}</span>${g.example ? '<span class="tag tag--ex t-label">Exemplo</span>' : g.tag ? `<span class="t-label">${esc(g.tag)}</span>` : ''}</figcaption></figure>`).join('')}</div>
</div></section>`;
}

function renderFaq(d, faq) {
  if (!faq.length) return '';
  return `<section class="sec sec--wall" id="perguntas"><div class="wrap faq">
<div class="faq__head"><p class="eyebrow t-label">Perguntas frequentes</p><h2 class="t-display h2">Antes de marcar.</h2><p>Não encontras a resposta? <a href="${esc(wa(d, 'Olá! Tenho uma pergunta.'))}" target="_blank" rel="noopener">Pergunta pelo WhatsApp</a>.</p></div>
<div class="faq__list">${faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
</div></section>`;
}

function renderContact(d, cats) {
  const b = d.business;
  const rows = [];
  if (b.phone) rows.push(['Telefone', `<span class="v">${esc(b.phone)}</span>`, b.phone]);
  if (b.email) rows.push(['Email', `<span class="v">${esc(b.email)}</span>`, b.email]);
  if (b.instagram) rows.push(['Instagram', `<a href="https://instagram.com/${esc(b.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">@${esc(b.instagram.replace(/^@/, ''))}</a>`]);
  if (b.address) rows.push(['Morada', `<span class="v">${esc(b.address)}</span>${safeSrc(b.mapsUrl) ? ` · <a href="${esc(b.mapsUrl)}" target="_blank" rel="noopener">Ver no mapa</a>` : ''}`, b.address]);
  else if (b.zone) rows.push(['Zona', `<span class="v">${esc(b.zone)}</span>`]);
  const hours = (b.hours || []).filter(h => h.d || h.h).map(h => `<div><span>${esc(h.d)}</span><span>${esc(h.h)}</span></div>`).join('');
  const opts = cats.map(c => `<optgroup label="${esc(c.name)}">${visibleItems(d, c.id).map(it => `<option value="${esc(it.id)}">${esc(it.name)}</option>`).join('')}</optgroup>`).join('');
  return `<section class="contact" id="contactos"><div class="wrap contact__grid">
<div>
<p class="eyebrow t-label">Contactos</p><h2 class="t-display h2">Marca a tua vez.</h2>
<p class="contact__lede">Diz-nos o carro e o que precisa. Respondemos com o preço e a primeira data livre.</p>
<div class="contact__wa"><a class="btn btn--light" href="${esc(wa(d, 'Olá! Queria marcar.'))}" target="_blank" rel="noopener">${ICON.chat}Falar no WhatsApp</a></div>
<dl class="clist">${rows.map(r => `<div class="clist__row"><dt class="t-label">${r[0]}</dt><dd>${r[1]}</dd>${r[2] ? `<button type="button" class="copy" data-copy="${esc(r[2])}">Copiar</button>` : '<span></span>'}</div>`).join('')}</dl>
${hours ? `<div class="hours">${hours}${b.hoursNote ? `<p class="hours__note">${esc(b.hoursNote)}</p>` : ''}</div>` : ''}
</div>
<form class="qform" id="qform" novalidate>
<h3>Pedido de orçamento</h3><p>Preenche e envia pelo WhatsApp. A mensagem vai pronta, só tens de carregar em enviar.</p>
<div class="fields">
<div class="fld"><label for="qName">Nome</label><input id="qName" autocomplete="name" placeholder="O teu nome"></div>
<div class="fld"><label for="qCar">Carro</label><input id="qCar" placeholder="Marca e modelo"></div>
<div class="fld"><label for="qService">Serviço</label><select id="qService"><option value="">Ainda não sei, quero conselho</option>${opts}</select></div>
<div class="fld"><label for="qSize">Tamanho</label><select id="qSize">${d.sizes.map((s, i) => `<option value="${i}">${esc(s)}</option>`).join('')}</select></div>
<div class="fld fld--full"><label for="qWhen">Quando dá jeito?</label><input id="qWhen" placeholder="Ex.: sábado de manhã"></div>
<div class="fld fld--full"><label for="qMsg">Notas</label><textarea id="qMsg" rows="3" placeholder="Riscos, manchas, pelo de animais, cor de wrap que queres"></textarea></div>
</div>
<div class="qprev" id="qPrev"></div>
<a class="btn btn--primary btn--block" id="qSend" href="${esc(wa(d, ''))}" target="_blank" rel="noopener">${ICON.chat}Enviar pelo WhatsApp</a>
</form>
</div></section>`;
}

function renderFooter(d, nav) {
  const ig = d.business.instagram ? `<a href="https://instagram.com/${esc(d.business.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram</a>` : '';
  const year = new Date(d.updatedAt || Date.now()).getFullYear() || 2026;
  return `<footer class="foot"><div class="wrap">
<div class="foot__top"><a class="brand" href="#inicio"><img src="img/logo.png" alt="" width="42" height="42"><span class="brand__name">Niche<span>Detail</span></span></a>
<nav class="foot__nav" aria-label="Rodapé">${nav.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('')}</nav></div>
<div class="foot__bot"><span>© ${year} ${esc(d.business.name)}${d.business.zone ? ' · ' + esc(d.business.zone) : ''}</span><span class="foot__links">${ig}<a class="foot__admin" href="#admin">Área reservada</a></span></div>
<p class="foot__credit">Imagens 3D feitas a partir do modelo «<a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept" target="_blank" rel="noopener">Car Concept</a>» de Eric Chadwick e Darmstadt Graphics Group, com licença <a href="https://creativecommons.org/licenses/by/4.0/deed.pt" target="_blank" rel="noopener">CC BY 4.0</a>. Cores, materiais e cenário alterados.</p>
</div></footer>`;
}

function renderSite(d) {
  d = normalize(d);
  const cats = d.categories.filter(c => c.visible !== false && visibleItems(d, c.id).length);
  const services = cats.filter(c => c.kind !== 'product');
  const gal = d.gallery.filter(g => g && safeSrc(g.image));
  const faq = d.faq.filter(f => f && f.q);
  const hasSim = d.simulator.visible !== false && d.wrapColors.some(c => c && c.name);
  const nav = [['#servicos', 'Serviços']];
  if (hasSim) nav.push(['#simulador', 'Simulador']);
  nav.push(['#precos', 'Preços']);
  if (gal.length) nav.push(['#trabalhos', 'Trabalhos']);
  nav.push(['#contactos', 'Contactos']);
  return renderHeader(d, nav) + '\n<main id="main">\n'
    + renderHero(d) + renderServices(d, services) + renderSim(d) + renderPrices(d, cats)
    + renderSteps() + renderGallery(d, gal) + renderFaq(d, faq) + renderContact(d, cats)
    + '\n</main>\n' + renderFooter(d, nav);
}

/* ------------------------------------------------------------------ documento completo */
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&display=swap';
const jsonForHtml = d => JSON.stringify(d).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
function describe(d) {
  const z = d.business.zone ? ` em ${d.business.zone}` : '';
  return `${d.business.name}: lavagem à mão, detailing, correção de pintura, proteção cerâmica e wrap${z}. Preços, simulador de cores e marcações pelo WhatsApp.`;
}
function headTags(d, production) {
  return [
    production ? `<title>${esc(d.business.name)} · Detailing, lavagem e wrap${d.business.zone ? ' em ' + esc(d.business.zone) : ''}</title>` : '<title>Niche Detail</title>',
    production ? '' : '<meta name="claude:viewport-fit-sides" content="cover">',
    `<meta name="description" content="${esc(describe(d))}">`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${FONTS}">`,
    '<link rel="stylesheet" href="assets/site.css">'
  ].filter(Boolean).join('\n');
}
function bodyContent(d) {
  return `<div id="site">\n${renderSite(clone(d))}\n</div>\n<script type="application/json" id="site-data">${jsonForHtml(d)}</script>\n<script src="config.js"></script>\n<script src="assets/app.js"></script>`;
}
function buildDocument(d, target) {
  d = normalize(clone(d));
  if (target === 'tool') return headTags(d, false) + '\n' + bodyContent(d) + '\n';
  if (target === 'runtime') return SKELETON + '\n' + headTags(d, false) + '\n' + bodyContent(d) + '\n</body></html>';
  const b = d.business;
  const ld = { '@context': 'https://schema.org', '@type': 'AutoWash', name: b.name, description: describe(d), image: 'img/og.jpg', telephone: b.phone || undefined, email: b.email || undefined, address: b.address || undefined, areaServed: b.zone || undefined, sameAs: b.instagram ? ['https://instagram.com/' + b.instagram.replace(/^@/, '')] : undefined };
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
${headTags(d, true)}
<link rel="icon" href="img/logo.png">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(b.name)}">
<meta property="og:description" content="${esc(describe(d))}">
<meta property="og:image" content="img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonForHtml(ld)}</script>
</head>
<body>
${bodyContent(d)}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ fim do código partilhado com o build */
const api = {
  util: { esc, clone, uid, slug, num, euro, fmtNum, safeSrc, hexOk, FINISHES, finishLabel, priceLow, priceText, normalize, visibleItems },
  renderSite, buildDocument, normalize, wa
};
if (typeof document === 'undefined') return api;

/* ================================================================== browser */
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { data: null, size: 0, tab: null, sim: 'original', custom: { hex: '#1e4a2f', finish: 'gloss' }, previewing: false };
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
};
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
};

function toast(msg, ms) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 3200);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não foi possível carregar ' + src));
    document.body.appendChild(s);
  });
}

/* ------------------------------------------------------------------ onde vivem os dados */
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
const Store = {
  mode: 'local', cfg: {}, sb: null,
  init() {
    this.cfg = window.NICHE_CONFIG || {};
    if (this.cfg.supabaseUrl && this.cfg.supabaseAnonKey) this.mode = 'supabase';
    else if (window.claude && typeof window.claude.use === 'function') this.mode = 'artifact';
    else this.mode = 'local';
  },
  label() { return { supabase: 'Supabase', artifact: 'Claude', local: 'Modo local' }[this.mode]; },
  localHost() { return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname); },
  adminReady() { return this.mode !== 'local' || this.localHost(); },
  async client() {
    if (this.sb) return this.sb;
    if (!window.supabase) await loadScript(SUPABASE_JS);
    this.sb = window.supabase.createClient(this.cfg.supabaseUrl, this.cfg.supabaseAnonKey);
    this.sb.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { this.recovery = true; openAdmin().then(() => window.NicheAdmin && window.NicheAdmin.refresh()); }
    });
    return this.sb;
  },
  cap(name) { return window.claude && window.claude.use ? window.claude.use(name) : Promise.resolve(null); },
  async refresh(current) {
    try {
      if (this.mode === 'supabase') {
        const base = String(this.cfg.supabaseUrl).replace(/\/$/, '');
        const r = await fetch(base + '/rest/v1/site_content?id=eq.main&select=data', { headers: { apikey: this.cfg.supabaseAnonKey, Accept: 'application/json' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const rows = await r.json();
        return rows[0] && rows[0].data ? normalize(rows[0].data) : null;
      }
      if (this.mode === 'local') {
        let best = null;
        const saved = ls.get('niche-site');
        if (saved) { try { best = JSON.parse(saved); } catch (e) { best = null; } }
        try {
          const r = await fetch('data/site.json', { cache: 'no-store' });
          if (r.ok) { const j = await r.json(); if (!best || String(j.updatedAt) > String(best.updatedAt)) best = j; }
        } catch (e) { /* ficheiro local sem servidor */ }
        return best && String(best.updatedAt) > String(current.updatedAt) ? normalize(best) : null;
      }
    } catch (e) { console.warn('[dados]', e); }
    return null;
  },
  async session() {
    if (this.mode === 'supabase') {
      const sb = await this.client();
      const { data } = await sb.auth.getSession();
      const s = data && data.session;
      if (!s) return { signedIn: false };
      const { data: row } = await sb.from('admins').select('user_id').eq('user_id', s.user.id).maybeSingle();
      return { signedIn: true, canEdit: !!row, name: s.user.email, email: s.user.email };
    }
    if (this.mode === 'artifact') {
      const [art, user] = await Promise.all([this.cap('artifact'), this.cap('user')]);
      if (!art) return { signedIn: false, unavailable: true };
      if (!user) return { signedIn: true, canEdit: true, name: '', viaClaude: true, uncertain: true };
      const me = await user.me();
      const canEdit = me ? !!me.canEdit : false;
      return { signedIn: !!me && (canEdit || !!me.id), canEdit, name: me && me.name || '', viaClaude: true };
    }
    return { signedIn: ss.get('niche-local-auth') === '1', canEdit: true, name: 'Modo local' };
  },
  async login(email, password) {
    if (this.mode === 'supabase') {
      const sb = await this.client();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else if (this.mode === 'local') ss.set('niche-local-auth', '1');
    return this.session();
  },
  async logout() {
    if (this.mode === 'supabase') { const sb = await this.client(); await sb.auth.signOut(); }
    if (this.mode === 'local') ss.del('niche-local-auth');
  },
  async resetPassword(email) {
    const sb = await this.client();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  async updatePassword(password) {
    const sb = await this.client();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    this.recovery = false;
    return this.session();
  },
  async save(d, base) {
    d.updatedAt = new Date().toISOString();
    if (this.mode === 'supabase') {
      const sb = await this.client();
      if (base) {
        const { data: cur } = await sb.from('site_content').select('data').eq('id', 'main').maybeSingle();
        const live = cur && cur.data && cur.data.updatedAt;
        if (live && live !== base) throw { code: 'conflict' };
      }
      const { error } = await sb.from('site_content').upsert({ id: 'main', data: d, updated_at: d.updatedAt });
      if (error) throw error;
      return { reload: false };
    }
    if (this.mode === 'artifact') {
      const art = await this.cap('artifact');
      if (!art) throw { code: 'not_granted' };
      const doc = buildDocument(d, 'runtime');
      try {
        await art.publish({ 'index.html': doc, 'data/site.json': JSON.stringify(d, null, 1) });
        return { reload: false };
      } catch (e) {
        if (e && (e.code === 'capability_disabled' || e.code === 'capability_removed')) {
          ss.set('niche-after-publish', '1');
          await art.publish(doc);
          return { reload: true };
        }
        throw e;
      }
    }
    if (!ls.set('niche-site', JSON.stringify(d))) throw { code: 'storage_full' };
    return { reload: false };
  },
  async upload(blob) {
    if (this.mode === 'supabase') {
      const sb = await this.client();
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    }
    if (this.mode === 'artifact') {
      const assets = await this.cap('assets');
      if (!assets) throw { code: 'not_granted' };
      const r = await assets.upload(blob, { type: blob.type });
      return '/_blob/' + r.id;
    }
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  }
};

/* reduz fotos grandes antes de carregar */
async function prepareImage(file, max) {
  max = max || (Store.mode === 'local' ? 1200 : 1800);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Esta imagem não abre. Experimenta JPG, PNG ou WebP.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const q = Store.mode === 'local' ? 0.8 : 0.86;
    let blob = await new Promise(res => c.toBlob(res, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

/* ------------------------------------------------------------------ simulador de wrap */
/* Os mapas saem do render 3D do carro (Blender/Cycles), com a mesma câmara e a mesma luz do topo:
   base.webp    o carro com a pintura apagada, e a sombra, em luz linear comprimida;
   <acab>-k     o que o verniz ou o metal reflete, igual para qualquer cor;
   <acab>-g     quanto a cor da pintura aparece em cada ponto.
   Cor (linear) = base + k + cor × g; depois o mesmo tone mapping do render (Khronos PBR Neutral). */
const SIM_MAPS = { gloss: 'gloss', metallic: 'metallic', satin: 'satin', matte: 'matte', chrome: 'chrome', flip: 'metallic' };
const SIM_EXPOSURE = Math.pow(2, 0.2);
// true: os mapas saem de uma fotografia (valores de ecrã), por isso não há tone mapping nem exposição automática
const SIM_PHOTO = true;
const Sim = {
  D: null, loading: null, maps: {},
  img(src) {
    return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('Falhou ' + src)); i.src = src; });
  },
  read(img, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  },
  ensure() {
    if (this.D) return Promise.resolve(this.D);
    if (this.loading) return this.loading;
    this.loading = this.img('img/sim/base.webp').then(im => {
      const w = im.naturalWidth, h = im.naturalHeight;
      const DEC = new Float32Array(256);
      for (let i = 0; i < 255; i++) { const t = Math.pow(i / 255, 2.2); DEC[i] = t / (1 - t); }
      DEC[255] = 64;
      const S = new Uint8ClampedArray(4097);
      for (let i = 0; i <= 4096; i++) { const v = i / 4096; S[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
      this.D = { w, h, n: w * h, base: this.read(im, w, h), DEC, S };
      return this.D;
    }).catch(e => { this.loading = null; throw e; });
    return this.loading;
  },
  finish(f) {
    const id = SIM_MAPS[f] || 'gloss';
    if (this.maps[id]) return this.maps[id];
    const p = this.ensure().then(D => {
      const one = src => this.img(src).then(im => {
        const px = this.read(im, D.w, D.h), out = new Uint8Array(D.n);
        for (let i = 0, j = 0; i < D.n; i++, j += 4) out[i] = px[j];
        return out;
      });
      return Promise.all([one(`img/sim/${id}-k.webp`), one(`img/sim/${id}-g.webp`)]).then(([k, g]) => {
        // brilho médio da pintura neste acabamento, para a exposição automática
        let ks = 0, gs = 0, c = 0;
        for (let i = 0; i < D.n; i++) if (g[i] > 130) { ks += D.DEC[k[i]]; gs += D.DEC[g[i]]; c++; }
        return { k, g, km: c ? ks / c : 0.3, gm: c ? gs / c : 1.5 };
      });
    });
    p.catch(() => { delete this.maps[id]; });
    return (this.maps[id] = p);
  },
  draw(color, M, canvas) {
    const { w, h, n, base, DEC, S } = this.D, K = M.k, G = M.g;
    const lin = hx => { hx = hexOk(hx); return [1, 3, 5].map(i => { const v = parseInt(hx.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); };
    const C1 = lin(color.hex), C2 = lin(color.hex2 || color.hex), flip = color.finish === 'flip';
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(w, h), o = out.data;
    // exposição automática, como faria o fotógrafo: cores claras pedem menos luz que o verde do topo
    const Y = ((C1[0] + C2[0]) * 0.2126 + (C1[1] + C2[1]) * 0.7152 + (C1[2] + C2[2]) * 0.0722) / 2;
    const E = SIM_PHOTO ? 1 : SIM_EXPOSURE * Math.min(1, Math.max(0.35, Math.pow((M.km + Y * M.gm) / 0.4, -0.65)));
    let cr = C1[0], cg = C1[1], cb = C1[2];
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const A = base[j + 3];
      if (A === 0) continue;
      const a = A / 255;
      let r = DEC[base[j]] * a, g = DEC[base[j + 1]] * a, b = DEC[base[j + 2]] * a;
      const ki = K[i], gi = G[i];
      if (ki | gi) {
        const kk = DEC[ki], gg = DEC[gi];
        if (flip) {
          const t = clamp01(gg / 2.2) * 0.6 + ((i % w) / w) * 0.4;
          cr = C1[0] + (C2[0] - C1[0]) * t; cg = C1[1] + (C2[1] - C1[1]) * t; cb = C1[2] + (C2[2] - C1[2]) * t;
        }
        r += kk + cr * gg; g += kk + cg * gg; b += kk + cb * gg;
      }
      const q = E / a; r *= q; g *= q; b *= q;
      if (!SIM_PHOTO) {
        // Khronos PBR Neutral, igual ao do render
        const x = r < g ? (r < b ? r : b) : (g < b ? g : b);
        const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
        r -= off; g -= off; b -= off;
        const pk = r > g ? (r > b ? r : b) : (g > b ? g : b);
        if (pk >= 0.76) {
          const np = 1 - 0.0576 / (pk - 0.52), sc = np / pk, d = 1 - 1 / (0.15 * (pk - np) + 1);
          r = r * sc * (1 - d) + np * d; g = g * sc * (1 - d) + np * d; b = b * sc * (1 - d) + np * d;
        }
      }
      o[j] = S[r <= 0 ? 0 : r >= 1 ? 4096 : (r * 4096 + 0.5) | 0];
      o[j + 1] = S[g <= 0 ? 0 : g >= 1 ? 4096 : (g * 4096 + 0.5) | 0];
      o[j + 2] = S[b <= 0 ? 0 : b >= 1 ? 4096 : (b * 4096 + 0.5) | 0];
      o[j + 3] = A;
    }
    ctx.putImageData(out, 0, 0);
  }
};

async function pickColor(id) {
  const d = state.data;
  const canvas = $('#simCanvas'); if (!canvas) return;
  const box = canvas.closest('.sim__car');
  state.sim = id;
  $$('[data-sw]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sw === id)));
  const name = $('#simName'), fin = $('#simFin'), cta = $('#simCta');
  if (id === 'original') {
    canvas.hidden = true; if (box) box.classList.remove('is-sim');
    name.textContent = 'Branco original'; fin.textContent = 'Pintura de origem';
    cta.href = wa(d, 'Olá! Queria um orçamento para wrap.');
    return;
  }
  let c;
  if (id === 'custom') {
    const cu = state.custom, hex = hexOk(cu.hex).toUpperCase();
    c = { id, name: 'Cor à tua escolha', finish: cu.finish, hex };
    name.textContent = c.name; fin.textContent = `${finishLabel(c.finish)} · ${hex}`;
    cta.href = wa(d, `Olá! Queria um orçamento para wrap nesta cor: ${hex} (${finishLabel(c.finish).toLowerCase()}). O meu carro é: `);
  } else {
    c = d.wrapColors.find(x => x.id === id); if (!c) return;
    name.textContent = c.name; fin.textContent = finishLabel(c.finish);
    cta.href = wa(d, `Olá! Queria um orçamento para wrap em ${c.name} (${finishLabel(c.finish).toLowerCase()}). O meu carro é: `);
  }
  if (box) box.classList.add('is-busy');
  try {
    const M = await Sim.finish(c.finish);
    if (state.sim !== id) return;
    Sim.draw(c, M, canvas);
    canvas.hidden = false; if (box) box.classList.add('is-sim');
  } catch (e) { console.warn('[simulador]', e); fin.textContent = finishLabel(c.finish) + ' · pré-visualização indisponível neste browser'; }
  finally { if (box && state.sim === id) box.classList.remove('is-busy'); }
}

function syncAny() {
  const cu = state.custom, hex = hexOk(cu.hex);
  const sw = $('.sw--any'); if (sw) sw.style.setProperty('--c', hex);
  const ci = $('#simAny'); if (ci && ci.value.toLowerCase() !== hex.toLowerCase()) ci.value = hex.toLowerCase();
  const hi = $('#simHex'); if (hi && document.activeElement !== hi) hi.value = hex.toUpperCase();
  $$('[data-anyfin]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.anyfin === cu.finish)));
}
let anyRaf = 0;
function setAny(hex, finish) {
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) state.custom.hex = hex.toLowerCase();
  if (finish) state.custom.finish = finish;
  syncAny();
  if (anyRaf) return;
  anyRaf = requestAnimationFrame(() => { anyRaf = 0; pickColor('custom'); });
}

function watchSim() {
  const sec = $('#simulador'); if (!sec || Sim.D) return;
  const go = () => { Sim.finish('gloss').catch(() => {}); };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '600px 0px' });
  io.observe(sec);
}

/* ------------------------------------------------------------------ interações */
function setTab(id, focus) {
  const tabs = $$('.tab'); if (!tabs.length) return;
  if (!tabs.some(t => t.dataset.tab === id)) id = tabs[0].dataset.tab;
  state.tab = id;
  tabs.forEach(t => { const on = t.dataset.tab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
  $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== id; });
  const panel = $(`.panel[data-panel="${CSS.escape(id)}"]`);
  const sizes = $('#sizes'); if (sizes && panel) sizes.hidden = panel.dataset.sizes !== '1';
}
function setSize(i, focus) {
  state.size = i;
  const panels = $('#panels'); if (panels) panels.dataset.size = String(i);
  $$('#sizes [data-size]').forEach(b => { const on = Number(b.dataset.size) === i; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $$('[data-book]').forEach(a => { const it = state.data.items.find(x => x.id === a.dataset.book); if (it) a.href = wa(state.data, bookMsg(state.data, it, i)); });
  const qs = $('#qSize'); if (qs) { qs.value = String(i); syncQuote(); }
}
function syncQuote() {
  const d = state.data, f = $('#qform'); if (!f) return;
  const v = id => ($('#' + id).value || '').trim();
  const it = d.items.find(x => x.id === v('qService'));
  const size = Number(v('qSize')) || 0;
  const lines = ['Olá! Queria pedir um orçamento.'];
  if (v('qName')) lines.push('Nome: ' + v('qName'));
  if (v('qCar')) lines.push('Carro: ' + v('qCar') + ' (' + d.sizes[size] + ')');
  else lines.push('Tamanho: ' + d.sizes[size]);
  lines.push('Serviço: ' + (it ? `${it.name} (${priceText(it, size)})` : 'ainda não sei, quero conselho'));
  if (v('qWhen')) lines.push('Quando: ' + v('qWhen'));
  if (v('qMsg')) lines.push('Notas: ' + v('qMsg'));
  const msg = lines.join('\n');
  const prev = $('#qPrev'); prev.textContent = msg;
  const b = document.createElement('b'); b.textContent = 'A tua mensagem'; prev.prepend(b);
  $('#qSend').href = wa(d, msg);
}
function openLightbox(i) {
  const gal = state.data.gallery.filter(g => g && safeSrc(g.image));
  if (!gal.length) return;
  let k = ((i % gal.length) + gal.length) % gal.length;
  let lb = $('#lb');
  const prevFocus = document.activeElement;
  if (!lb) {
    lb = document.createElement('div'); lb.id = 'lb'; lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Fotografia em grande');
    lb.innerHTML = '<img alt=""><div class="lb__bar"><p></p><div class="lb__nav"><button type="button" data-lb="-1" aria-label="Anterior">←</button><button type="button" data-lb="1" aria-label="Seguinte">→</button></div></div><button type="button" class="lb__close" data-lb="x">Fechar</button>';
    document.body.appendChild(lb);
  }
  const show = () => { const g = gal[k]; $('img', lb).src = safeSrc(g.image); $('img', lb).alt = g.title || ''; $('p', lb).textContent = (g.title || '') + (gal.length > 1 ? `  ·  ${k + 1} de ${gal.length}` : ''); $$('.lb__nav button', lb).forEach(b => { b.hidden = gal.length < 2; }); };
  const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') { k = (k + 1) % gal.length; show(); } else if (e.key === 'ArrowLeft') { k = (k - 1 + gal.length) % gal.length; show(); } };
  lb.onclick = e => { const b = e.target.closest('[data-lb]'); if (b) { if (b.dataset.lb === 'x') close(); else { k = (k + Number(b.dataset.lb) + gal.length) % gal.length; show(); } } else if (e.target === lb) close(); };
  document.addEventListener('keydown', onKey);
  show(); $('.lb__close', lb).focus();
}
function copyText(btn) {
  const text = btn.dataset.copy;
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copiado' : 'Seleciona e copia'; setTimeout(() => { btn.textContent = o === 'Copiado' || o === 'Seleciona e copia' ? 'Copiar' : o; }, 1600); };
  const select = () => { const v = btn.parentElement.querySelector('.v'); if (!v) return; try { const r = document.createRange(); r.selectNodeContents(v); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* sem seleção */ } };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => { select(); done(false); }); } catch (e) { select(); done(false); }
}

function bindOnce() {
  document.addEventListener('click', e => {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) { setTab(tab.dataset.tab); if (tab.classList.contains('tab')) e.preventDefault(); }
    const sz = t.closest('#sizes [data-size]'); if (sz) { setSize(Number(sz.dataset.size)); return; }
    const af = t.closest('[data-anyfin]'); if (af) { setAny(null, af.dataset.anyfin); return; }
    const sw = t.closest('[data-sw]'); if (sw) { pickColor(sw.dataset.sw); return; }
    const g = t.closest('[data-gal]'); if (g) { openLightbox(Number(g.dataset.gal)); return; }
    const cp = t.closest('[data-copy]'); if (cp) { copyText(cp); return; }
    const mb = t.closest('#menuBtn');
    if (mb) { const m = $('#mnav'); const open = m.hidden; m.hidden = !open; mb.setAttribute('aria-expanded', String(open)); return; }
    const a = t.closest('a[href^="#"]');
    if (a) {
      const m = $('#mnav'); if (m && !m.hidden && m.contains(a)) { m.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
      if (a.getAttribute('href') === '#admin') { e.preventDefault(); openAdmin(); }
    }
    const pb = t.closest('[data-preview]');
    if (pb) { if (pb.dataset.preview === 'back') { endPreview(); openAdmin(); } else if (pb.dataset.preview === 'publish') { endPreview(); openAdmin().then(() => window.NicheAdmin && window.NicheAdmin.publish()); } }
  });
  document.addEventListener('keydown', e => {
    const tab = e.target.closest && e.target.closest('.tab');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const tabs = $$('.tab'); const i = tabs.indexOf(tab); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      e.preventDefault(); setTab(n.dataset.tab, true);
    }
    const sz = e.target.closest && e.target.closest('#sizes [data-size]');
    if (sz && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault(); setSize((Number(sz.dataset.size) + (e.key === 'ArrowRight' ? 1 : 2)) % 3, true);
    }
  });
  document.addEventListener('pointerover', e => { const sw = e.target.closest && e.target.closest('[data-sw]'); if (sw && sw.dataset.f !== 'original') Sim.finish(sw.dataset.f === 'custom' ? state.custom.finish : sw.dataset.f).catch(() => {}); });
  document.addEventListener('input', e => {
    if (e.target.id === 'simAny') { setAny(e.target.value); return; }
    if (e.target.id === 'simHex') { let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) setAny(v); return; }
    if (e.target.closest('#qform')) syncQuote();
  });
  document.addEventListener('change', e => { if (e.target.closest('#qform')) syncQuote(); });
  document.addEventListener('submit', e => { if (e.target.id === 'qform') { e.preventDefault(); $('#qSend').focus(); } });
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; const h = $('#hdr'); if (h) h.classList.toggle('is-scrolled', scrollY > 8); });
  }, { passive: true });
  addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });
}

function hydrate() {
  if (state.tab) setTab(state.tab);
  setSize(state.size);
  syncQuote();
  syncAny();
  if (state.sim !== 'original' && $(`[data-sw="${CSS.escape(state.sim)}"]`)) pickColor(state.sim); else state.sim = 'original';
  watchSim();
}

function setData(d, opts) {
  state.data = normalize(clone(d));
  const site = $('#site'); if (!site) return;
  site.innerHTML = renderSite(clone(state.data));
  hydrate();
  if (opts && opts.preview) { state.previewing = true; showPreviewBar(); }
}
function showPreviewBar() {
  let bar = $('#pbar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'pbar'; bar.className = 'pbar';
    bar.innerHTML = '<span>Estás a ver as alterações por publicar.</span><button type="button" class="btn btn--sm btn--ghost" data-preview="back" style="background:#fff">Voltar ao painel</button><button type="button" class="btn btn--sm btn--primary" data-preview="publish">Publicar</button>';
    document.body.appendChild(bar);
  }
  bar.hidden = false;
}
function endPreview() {
  const bar = $('#pbar'); if (bar) bar.hidden = true;
  if (state.previewing) { state.previewing = false; if (api.published) setData(api.published); }
}

/* ------------------------------------------------------------------ painel */
let adminLoading = null;
function openAdmin() {
  if (window.NicheAdmin) { window.NicheAdmin.open(); return Promise.resolve(); }
  if (!adminLoading) {
    adminLoading = new Promise((res, rej) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/admin.css'; document.head.appendChild(l);
      loadScript('assets/admin.js').then(res, rej);
    }).then(() => { window.NicheAdmin.open(); }).catch(e => { adminLoading = null; toast('Não foi possível abrir o painel. Tenta outra vez.'); console.error(e); });
  }
  return adminLoading;
}

function boot() {
  let d = null;
  try { d = JSON.parse(($('#site-data') || {}).textContent || 'null'); } catch (e) { d = null; }
  state.data = normalize(d || {});
  api.published = clone(state.data);
  Store.init();
  if (!Store.adminReady()) document.documentElement.classList.add('no-admin');
  bindOnce();
  hydrate();
  if (Store.mode === 'supabase' && /type=(recovery|invite)/.test(location.hash)) { Store.recovery = true; Store.client().catch(e => console.warn('[supabase]', e)); openAdmin(); }
  else if (location.hash === '#admin' || ss.get('niche-after-publish')) {
    if (ss.get('niche-after-publish')) { ss.del('niche-after-publish'); toast('Publicado. O site já mostra as alterações.'); }
    openAdmin();
  }
  Store.refresh(state.data).then(fresh => {
    if (fresh && !state.previewing && !(window.NicheAdmin && window.NicheAdmin.isOpen())) { api.published = clone(fresh); setData(fresh); }
    else if (fresh) api.published = clone(fresh);
  });
}

Object.assign(api, { boot, Store, state, setData, toast, prepareImage, openAdmin, endPreview, ls, ss, $, $$, published: null });
return api;
});
