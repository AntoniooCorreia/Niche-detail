/* Niche Detail — painel de administração.
   Edita um rascunho do site e publica de uma vez: dentro do Claude, no Supabase ou neste browser (modo local). */
(function () {
'use strict';
const N = window.NICHE;
const { esc, clone, uid, slug, num, euro, safeSrc, hexOk, FINISHES, finishLabel } = N.util;
const $ = (s, c) => (c || document).querySelector(s);
const LS_DRAFT = 'niche-admin-draft';

const VIEWS = [
  ['catalog', 'Catálogo'],
  ['categories', 'Categorias'],
  ['gallery', 'Galeria'],
  ['simulator', 'Simulador de wrap'],
  ['home', 'Página inicial'],
  ['contacts', 'Contactos e horário'],
  ['faq', 'Perguntas frequentes']
];
const A = { root: null, open: false, data: null, draft: null, session: null, entered: false, view: 'catalog', filter: 'all', q: '', drawer: null, modal: null, busy: false, notice: null, staleDraft: null, saveT: 0 };

const ic = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
};

/* ------------------------------------------------------------------ estado */
const isDirty = () => !!A.draft && !!A.data && JSON.stringify(A.draft) !== JSON.stringify(A.data);
function persistDraft() {
  clearTimeout(A.saveT);
  A.saveT = setTimeout(() => {
    if (isDirty()) N.ls.set(LS_DRAFT, JSON.stringify({ base: A.data.updatedAt, savedAt: new Date().toISOString(), draft: A.draft }));
    else N.ls.del(LS_DRAFT);
  }, 250);
}
function changed() { persistDraft(); updateTop(); }
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = /^\d+$/.test(ks[i]) ? Number(ks[i]) : ks[i];
    if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[k];
  }
  const last = ks[ks.length - 1];
  o[/^\d+$/.test(last) ? Number(last) : last] = val;
}
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj); }
const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; };

/* ------------------------------------------------------------------ abrir e fechar */
async function open() {
  if (!A.root) {
    A.root = document.createElement('div'); A.root.id = 'adm'; A.root.className = 'adm-root';
    A.root.setAttribute('role', 'dialog'); A.root.setAttribute('aria-modal', 'true'); A.root.setAttribute('aria-label', 'Painel de administração');
    document.body.appendChild(A.root); bind();
  }
  N.endPreview();
  A.open = true; A.root.hidden = false; document.documentElement.classList.add('adm-open');
  if (N.Store.mode === 'supabase' && !A.liveLoaded) {
    A.root.innerHTML = loadingHTML();
    try { const live = await N.Store.refresh({ updatedAt: '' }); if (live) N.published = N.normalize(clone(live)); A.liveLoaded = true; } catch (e) { console.warn('[painel]', e); }
  }
  A.data = N.normalize(clone(N.published || N.state.data));
  if (!A.draft) loadDraft();
  else if (!isDirty()) A.draft = clone(A.data);
  if (!A.session) { A.root.innerHTML = loadingHTML(); try { A.session = await N.Store.session(); } catch (e) { console.warn(e); A.session = { signedIn: false, error: true }; } }
  if (N.ss.get('niche-adm-in') === '1') A.entered = true;
  render();
}
function loadDraft() {
  A.draft = clone(A.data);
  let saved = null;
  try { saved = JSON.parse(N.ls.get(LS_DRAFT) || 'null'); } catch (e) { saved = null; }
  if (!saved || !saved.draft) return;
  if (saved.base === A.data.updatedAt) { A.draft = N.normalize(saved.draft); if (isDirty()) A.notice = 'restored'; }
  else { A.staleDraft = saved; A.notice = 'stale'; }
}
function close(force) {
  if (!force && isDirty()) { A.modal = 'exit'; renderModal(); return; }
  A.modal = null; A.drawer = null;
  A.open = false; A.root.hidden = true; A.root.innerHTML = '';
  document.documentElement.classList.remove('adm-open');
  try { if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sem histórico */ }
  N.setData(N.published || A.data);
}

/* ------------------------------------------------------------------ HTML base */
const loadingHTML = () => '<div class="lg"><div class="lg__card"><p class="lg__wait">A verificar o acesso…</p></div></div>';
function canEnter() {
  const s = A.session || {};
  if (!s.signedIn || !s.canEdit) return false;
  return N.Store.mode === 'supabase' ? true : A.entered;
}
function render() {
  if (!A.root || !A.open) return;
  if (N.Store.recovery) { A.root.innerHTML = passwordHTML(); const f = $('input', A.root); if (f) f.focus(); return; }
  if (!canEnter()) { A.root.innerHTML = loginHTML(); const f = $('input,button.abtn--primary', A.root); if (f) f.focus(); return; }
  const sc = $('#admMain', A.root) ? $('#admMain', A.root).scrollTop : 0;
  A.root.innerHTML = shellHTML();
  const m = $('#admMain', A.root); if (m) m.scrollTop = sc;
  renderDrawer(); renderModal(); updateTop();
}
function loginHTML() {
  const mode = N.Store.mode, s = A.session || {};
  let body = '';
  if (mode === 'supabase') {
    body = `<form class="lg__form" data-form="login" novalidate>
<label class="af"><span>Email</span><input type="email" name="email" autocomplete="username" required></label>
<label class="af"><span>Palavra-passe</span><input type="password" name="password" autocomplete="current-password" required></label>
<p class="ferr" id="lgErr"${s.signedIn && !s.canEdit ? '' : ' hidden'}>${s.signedIn && !s.canEdit ? 'Esta conta não tem acesso de administrador.' : ''}</p>
<button class="abtn abtn--primary abtn--block" type="submit">Entrar</button>
<button class="abtn abtn--text abtn--block" type="button" data-act="reset">Esqueci-me da palavra-passe</button></form>`;
  } else if (mode === 'artifact') {
    if (s.unavailable || s.error) body = '<p class="lg__p">Para editar, abre esta página dentro do Claude com a conta que a criou.</p>';
    else if (!s.signedIn) body = '<p class="lg__p">Entra no Claude com a conta dona deste site para o poderes editar.</p>';
    else if (!s.canEdit) body = '<p class="lg__p">A tua conta pode ver o site mas não o pode editar. Pede ao dono acesso de edição.</p>';
    else body = `<p class="lg__p">Entras com a tua conta Claude. Só quem tem acesso de edição a esta página consegue alterar o site.</p>
<button class="abtn abtn--primary abtn--block" type="button" data-act="enter">${ic.lock}${s.name ? 'Entrar como ' + esc(s.name.split(' ')[0]) : 'Entrar'}</button>`;
  } else if (!N.Store.adminReady()) {
    body = '<p class="lg__p">O painel ainda não está ligado a este site. Para editar aqui, liga o Supabase (os passos estão no LEIA-ME).</p>';
  } else {
    body = `<p class="lg__p">Modo local: o site não está ligado ao Claude nem ao Supabase, por isso as alterações ficam guardadas só neste browser.</p>
<button class="abtn abtn--primary abtn--block" type="button" data-act="local-login">Entrar</button>`;
  }
  return `<div class="lg"><div class="lg__card">
<img src="img/logo.png" alt="" width="64" height="64" class="lg__logo">
<h1 class="lg__h">Área reservada</h1>
${body}
<button class="abtn abtn--text abtn--block" type="button" data-act="exit">Voltar ao site</button>
</div></div>`;
}
function passwordHTML() {
  return `<div class="lg"><div class="lg__card">
<img src="img/logo.png" alt="" width="64" height="64" class="lg__logo">
<h1 class="lg__h">Nova palavra-passe</h1>
<p class="lg__p">Escolhe a palavra-passe que vais usar para entrar no painel.</p>
<form class="lg__form" data-form="password" novalidate>
<label class="af"><span>Palavra-passe nova</span><input type="password" name="p1" autocomplete="new-password" minlength="8" required></label>
<label class="af"><span>Repete a palavra-passe</span><input type="password" name="p2" autocomplete="new-password" minlength="8" required></label>
<p class="ferr" id="pwErr" hidden></p>
<button class="abtn abtn--primary abtn--block" type="submit">Guardar e entrar</button></form>
</div></div>`;
}
function shellHTML() {
  const counts = { catalog: A.draft.items.length, categories: A.draft.categories.length, gallery: A.draft.gallery.length, simulator: A.draft.wrapColors.length, faq: A.draft.faq.length };
  const nav = VIEWS.map(([id, t]) => `<button type="button" class="nv${A.view === id ? ' is-on' : ''}" data-act="view" data-view="${id}"${A.view === id ? ' aria-current="page"' : ''}><span>${t}</span>${counts[id] != null ? `<i>${counts[id]}</i>` : ''}</button>`).join('');
  return `<div class="adm">
<header class="adm__top">
<button type="button" class="adm__brand" data-act="exit" title="Voltar ao site"><img src="img/logo.png" alt="" width="34" height="34"><span><b>Painel</b><small>${esc(A.draft.business.name)}</small></span></button>
<span class="mode mode--${N.Store.mode}" title="Onde ficam guardados os dados">${esc(N.Store.label())}</span>
<span class="status" id="admStatus"></span>
<div class="adm__acts">
<button type="button" class="abtn abtn--ghost hide-sm" data-act="preview">Pré-visualizar</button>
<button type="button" class="abtn abtn--primary" data-act="publish" id="admPublish">${N.Store.mode === 'local' ? 'Guardar' : 'Publicar'}</button>
<button type="button" class="abtn abtn--text" data-act="logout">Sair</button>
</div>
</header>
<div class="adm__body">
<nav class="adm__nav" aria-label="Secções do painel">${nav}<div class="nv-foot"><button type="button" class="abtn abtn--ghost abtn--block show-sm" data-act="preview">Pré-visualizar</button>${N.Store.mode !== 'artifact' ? '<button type="button" class="abtn abtn--text abtn--block" data-act="export">Exportar cópia dos dados</button>' : ''}</div></nav>
<main class="adm__main" id="admMain">${noticeHTML()}${viewHTML()}</main>
</div>
<div id="admDrawer"></div><div id="admModal"></div>
</div>`;
}
function noticeHTML() {
  if (A.notice === 'restored') return `<div class="note">Recuperámos alterações que ainda não tinhas publicado neste dispositivo. <button type="button" class="abtn abtn--text abtn--sm" data-act="discard">Descartar</button></div>`;
  if (A.notice === 'stale') return `<div class="note note--warn">Tens alterações antigas guardadas neste dispositivo, feitas antes da última publicação. <button type="button" class="abtn abtn--text abtn--sm" data-act="use-stale">Usar mesmo assim</button><button type="button" class="abtn abtn--text abtn--sm" data-act="drop-stale">Descartar</button></div>`;
  return '';
}
function updateTop() {
  const st = $('#admStatus', A.root), pb = $('#admPublish', A.root);
  if (!st || !pb) return;
  const dirty = isDirty();
  st.textContent = A.busy ? (N.Store.mode === 'local' ? 'A guardar…' : 'A publicar…') : dirty ? 'Alterações por publicar' : 'Tudo publicado';
  st.className = 'status' + (dirty ? ' is-dirty' : '');
  pb.disabled = A.busy || !dirty;
}
const head = (t, p, actions) => `<div class="vh"><div><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</div>${actions ? `<div class="vh__acts">${actions}</div>` : ''}</div>`;
const empty = (t, p) => `<div class="empty"><b>${t}</b><p>${p}</p></div>`;
function viewHTML() {
  switch (A.view) {
    case 'categories': return vCategories();
    case 'gallery': return vGallery();
    case 'simulator': return vSimulator();
    case 'home': return vHome();
    case 'contacts': return vContacts();
    case 'faq': return vFaq();
    default: return vCatalog();
  }
}
function renderMain() { const m = $('#admMain', A.root); if (!m) return render(); const sc = m.scrollTop; m.innerHTML = noticeHTML() + viewHTML(); m.scrollTop = sc; updateTop(); updateNavCounts(); }
function updateNavCounts() {
  const counts = { catalog: A.draft.items.length, categories: A.draft.categories.length, gallery: A.draft.gallery.length, simulator: A.draft.wrapColors.length, faq: A.draft.faq.length };
  A.root.querySelectorAll('.nv').forEach(b => { const i = b.querySelector('i'); if (i && counts[b.dataset.view] != null) i.textContent = counts[b.dataset.view]; });
}

/* ------------------------------------------------------------------ catálogo */
function priceSummary(it) {
  const p = it.price || {};
  if (p.mode === 'quote') return 'Sob orçamento';
  const pre = p.from ? 'desde ' : '';
  if (p.mode === 'sizes') return pre + (p.values || []).map(v => N.util.fmtNum(v)).join(' / ') + ' €';
  return pre + euro(p.value);
}
const initials = s => esc(String(s || '?').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase());
function rowItem(it) {
  const d = A.draft, cat = d.categories.find(c => c.id === it.category), vis = it.visible !== false;
  const img = safeSrc(it.image);
  return `<li class="row${vis ? '' : ' is-off'}">
<span class="row__th">${img ? `<img src="${esc(img)}" alt="">` : `<span>${initials(it.name)}</span>`}</span>
<button type="button" class="row__main" data-act="item-edit" data-id="${esc(it.id)}"><b>${esc(it.name) || 'Sem nome'}</b><span>${esc(cat ? cat.name : 'Sem categoria')} · ${esc(priceSummary(it))}${it.duration ? ' · ' + esc(it.duration) : ''}</span></button>
<span class="row__tags">${it.featured ? '<i class="badge">Recomendado</i>' : ''}${vis ? '' : '<i class="badge badge--off">Oculto</i>'}</span>
<span class="row__acts">
<button type="button" class="ibtn" data-act="item-move" data-dir="-1" data-id="${esc(it.id)}" aria-label="Subir ${esc(it.name)}" title="Subir">${ic.up}</button>
<button type="button" class="ibtn" data-act="item-move" data-dir="1" data-id="${esc(it.id)}" aria-label="Descer ${esc(it.name)}" title="Descer">${ic.down}</button>
<button type="button" class="ibtn" data-act="item-vis" data-id="${esc(it.id)}" aria-label="${vis ? 'Ocultar' : 'Mostrar'} ${esc(it.name)}" title="${vis ? 'Ocultar do site' : 'Mostrar no site'}">${vis ? ic.eye : ic.eyeOff}</button>
<button type="button" class="ibtn" data-act="item-dup" data-id="${esc(it.id)}" aria-label="Duplicar ${esc(it.name)}" title="Duplicar">${ic.copy}</button>
</span></li>`;
}
function listHTML() {
  const d = A.draft, q = A.q.trim().toLowerCase();
  const list = d.items.filter(i => (A.filter === 'all' || i.category === A.filter) && (!q || (i.name + ' ' + i.description).toLowerCase().includes(q)));
  if (!list.length) return empty(q ? 'Nada encontrado.' : 'Ainda não há nada aqui.', q ? 'Experimenta outra palavra ou escolhe «Todos».' : 'Carrega em «Adicionar» para criar o primeiro serviço ou produto.');
  return `<ul class="rows">${list.map(rowItem).join('')}</ul>`;
}
function vCatalog() {
  const d = A.draft;
  const chip = (id, t, n) => `<button type="button" class="chip${A.filter === id ? ' is-on' : ''}" data-act="filter" data-id="${esc(id)}">${esc(t)} <i>${n}</i></button>`;
  return head('Catálogo', 'Serviços e produtos da tabela de preços. As setas mudam a ordem dentro de cada categoria.', `<button type="button" class="abtn abtn--primary" data-act="item-new">${ic.plus}Adicionar</button>`)
    + `<div class="tools"><div class="chips">${chip('all', 'Todos', d.items.length)}${d.categories.map(c => chip(c.id, c.name, d.items.filter(i => i.category === c.id).length)).join('')}</div>
<input class="search" type="search" id="admQ" placeholder="Procurar" value="${esc(A.q)}" aria-label="Procurar no catálogo"></div>
<div id="admList">${listHTML()}</div>`;
}
function itemForm(it, isNew) {
  const d = A.draft, p = it.price;
  const cats = d.categories.map(c => `<option value="${esc(c.id)}"${c.id === it.category ? ' selected' : ''}>${esc(c.name)}${c.kind === 'product' ? ' (produtos)' : ''}</option>`).join('');
  const radio = (v, t) => `<label><input type="radio" name="pmode" value="${v}"${p.mode === v ? ' checked' : ''}><span>${t}</span></label>`;
  return `<form class="dr" data-form="item" data-pmode="${esc(p.mode)}" novalidate>
<header class="dr__head"><h2>${isNew ? 'Novo item' : 'Editar item'}</h2><button type="button" class="ibtn" data-act="drawer-close" aria-label="Fechar">${ic.x}</button></header>
<div class="dr__body">
<p class="ferr" id="drErr" hidden></p>
<label class="af"><span>Nome</span><input name="name" value="${esc(it.name)}" required maxlength="80" placeholder="Ex.: Lavagem completa"></label>
<label class="af"><span>Categoria</span><select name="category">${cats}</select></label>
<label class="af"><span>Descrição</span><textarea name="description" rows="3" maxlength="300" placeholder="Uma ou duas frases sobre o serviço">${esc(it.description)}</textarea></label>
<label class="af"><span>O que inclui</span><textarea name="includes" rows="4" placeholder="Um ponto por linha">${esc((it.includes || []).join('\n'))}</textarea><small>Um ponto por linha. Fica em lista por baixo da descrição.</small></label>
<label class="af"><span>Duração</span><input name="duration" value="${esc(it.duration)}" placeholder="Ex.: 2h30 ou 1 dia"></label>
<fieldset class="af"><legend>Preço</legend>
<div class="seg3">${radio('sizes', 'Por tamanho')}${radio('fixed', 'Preço único')}${radio('quote', 'Sob orçamento')}</div>
<div class="pm pm--sizes">${d.sizes.map((s, i) => `<label class="af af--in"><span>${esc(s)}</span><span class="eur"><input name="p${i}" inputmode="decimal" value="${num(p.values[i]) || ''}" placeholder="0"><i>€</i></span></label>`).join('')}</div>
<div class="pm pm--fixed"><label class="af af--in"><span>Preço</span><span class="eur"><input name="pv" inputmode="decimal" value="${num(p.value) || ''}" placeholder="0"><i>€</i></span></label></div>
<label class="chk pm pm--from"><input type="checkbox" name="from"${p.from ? ' checked' : ''}><span>Mostrar como «desde»</span></label>
</fieldset>
${imgField('image', it.image, 'Imagem (opcional)', 'Nos produtos aparece no cartão. Nos serviços só aparece aqui no painel.')}
<label class="tgl"><input type="checkbox" name="featured"${it.featured ? ' checked' : ''}><span><b>Destaque</b><small>Mostra a etiqueta «Recomendado».</small></span></label>
<label class="tgl"><input type="checkbox" name="visible"${it.visible !== false ? ' checked' : ''}><span><b>Visível no site</b><small>Desliga para esconder sem apagar.</small></span></label>
</div>
<footer class="dr__foot">${isNew ? '' : (A.drawer && A.drawer.confirmDel
    ? '<span class="del-q">Apagar este item?</span><button type="button" class="abtn abtn--danger" data-act="item-del">Sim, apagar</button><button type="button" class="abtn abtn--text" data-act="del-cancel">Não</button>'
    : `<button type="button" class="abtn abtn--text abtn--dangertext" data-act="del-ask">${ic.trash}Apagar</button>`)}
<span class="sp"></span><button type="button" class="abtn abtn--ghost" data-act="drawer-close">Cancelar</button><button type="submit" class="abtn abtn--primary">Guardar</button></footer>
</form>`;
}
function imgField(name, url, label, help) {
  const u = safeSrc(url);
  return `<div class="af"><span>${label}</span><div class="imgf" data-imgf="${name}">
<div class="imgf__prev">${u ? `<img src="${esc(u)}" alt="">` : '<i>Sem imagem</i>'}</div>
<div class="imgf__side"><label class="abtn abtn--ghost abtn--sm">${u ? 'Trocar' : 'Escolher imagem'}<input type="file" accept="image/*" data-upload="${name}" hidden></label>
${u ? `<button type="button" class="abtn abtn--text abtn--sm" data-act="img-clear" data-name="${name}">Remover</button>` : ''}<p class="imgf__msg" aria-live="polite"></p></div>
<input type="hidden" name="${name}" value="${esc(u)}"></div>${help ? `<small>${help}</small>` : ''}</div>`;
}
function readItemForm(form) {
  const f = new FormData(form), old = A.draft.items.find(i => i.id === A.drawer.id) || {};
  const mode = f.get('pmode') || 'fixed';
  return {
    id: A.drawer.id, category: f.get('category'), name: String(f.get('name') || '').trim(), description: String(f.get('description') || '').trim(),
    includes: String(f.get('includes') || '').split('\n').map(s => s.trim()).filter(Boolean), duration: String(f.get('duration') || '').trim(),
    price: { mode, from: f.get('from') === 'on', values: [0, 1, 2].map(i => num(f.get('p' + i))), value: num(f.get('pv')) },
    image: safeSrc(f.get('image')), featured: f.get('featured') === 'on', visible: f.get('visible') === 'on',
    ...(old.extra ? { extra: old.extra } : {})
  };
}
function saveItem(form) {
  const it = readItemForm(form);
  const err = !it.name ? 'Dá um nome ao item.'
    : it.price.mode === 'sizes' && !it.price.values.some(v => v > 0) ? 'Indica pelo menos um preço por tamanho.'
    : it.price.mode === 'fixed' && !(it.price.value > 0) ? 'Indica o preço.' : '';
  if (err) { const e = $('#drErr', A.root); e.textContent = err; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); return; }
  const d = A.draft, i = d.items.findIndex(x => x.id === it.id);
  if (i >= 0) d.items[i] = it;
  else d.items.push(it);
  A.drawer = null; renderDrawer(); renderMain(); changed();
  N.toast(i >= 0 ? 'Item atualizado. Publica para aparecer no site.' : 'Item criado. Publica para aparecer no site.');
}

/* ------------------------------------------------------------------ categorias */
function vCategories() {
  const d = A.draft;
  const rows = d.categories.map((c, i) => {
    const n = d.items.filter(x => x.category === c.id).length, vis = c.visible !== false;
    return `<li class="row${vis ? '' : ' is-off'}"><span class="row__th"><span>${initials(c.name)}</span></span>
<button type="button" class="row__main" data-act="cat-edit" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${c.kind === 'product' ? 'Produtos à venda' : 'Serviços'} · ${n} ${n === 1 ? 'item' : 'itens'}</span></button>
<span class="row__tags">${vis ? '' : '<i class="badge badge--off">Oculta</i>'}</span>
<span class="row__acts"><button type="button" class="ibtn" data-act="cat-move" data-dir="-1" data-i="${i}" aria-label="Subir ${esc(c.name)}" title="Subir">${ic.up}</button>
<button type="button" class="ibtn" data-act="cat-move" data-dir="1" data-i="${i}" aria-label="Descer ${esc(c.name)}" title="Descer">${ic.down}</button>
<button type="button" class="ibtn" data-act="cat-vis" data-i="${i}" aria-label="${vis ? 'Ocultar' : 'Mostrar'} ${esc(c.name)}" title="${vis ? 'Ocultar do site' : 'Mostrar no site'}">${vis ? ic.eye : ic.eyeOff}</button></span></li>`;
  }).join('');
  return head('Categorias', 'Os separadores da tabela de preços. As categorias de serviços aparecem também em cartões no início do site.', `<button type="button" class="abtn abtn--primary" data-act="cat-new">${ic.plus}Nova categoria</button>`)
    + `<ul class="rows">${rows}</ul>`;
}
function catForm(c, isNew) {
  const n = A.draft.items.filter(x => x.category === c.id).length;
  return `<form class="dr" data-form="cat" novalidate>
<header class="dr__head"><h2>${isNew ? 'Nova categoria' : 'Editar categoria'}</h2><button type="button" class="ibtn" data-act="drawer-close" aria-label="Fechar">${ic.x}</button></header>
<div class="dr__body"><p class="ferr" id="drErr" hidden></p>
<label class="af"><span>Nome</span><input name="name" value="${esc(c.name)}" required maxlength="40" placeholder="Ex.: Interiores"></label>
<fieldset class="af"><legend>Tipo</legend><div class="seg3">
<label><input type="radio" name="kind" value="service"${c.kind !== 'product' ? ' checked' : ''}><span>Serviços</span></label>
<label><input type="radio" name="kind" value="product"${c.kind === 'product' ? ' checked' : ''}><span>Produtos à venda</span></label></div>
<small>Os produtos aparecem em cartões com foto e botão «Encomendar».</small></fieldset>
<label class="af"><span>Texto de apresentação</span><textarea name="intro" rows="3" maxlength="240">${esc(c.intro)}</textarea></label>
${imgField('image', c.image, 'Foto do cartão (opcional)', 'Nas categorias de serviços, substitui a imagem do carro no cartão do início.')}
<label class="tgl"><input type="checkbox" name="visible"${c.visible !== false ? ' checked' : ''}><span><b>Visível no site</b><small>Uma categoria sem itens visíveis não aparece.</small></span></label>
</div>
<footer class="dr__foot">${isNew ? '' : n ? `<span class="del-q">Para apagar, move ou apaga primeiro os ${n} itens.</span>` : (A.drawer.confirmDel
    ? '<span class="del-q">Apagar esta categoria?</span><button type="button" class="abtn abtn--danger" data-act="cat-del">Sim, apagar</button><button type="button" class="abtn abtn--text" data-act="del-cancel">Não</button>'
    : `<button type="button" class="abtn abtn--text abtn--dangertext" data-act="del-ask">${ic.trash}Apagar</button>`)}
<span class="sp"></span><button type="button" class="abtn abtn--ghost" data-act="drawer-close">Cancelar</button><button type="submit" class="abtn abtn--primary">Guardar</button></footer>
</form>`;
}
function saveCat(form) {
  const f = new FormData(form), d = A.draft;
  const name = String(f.get('name') || '').trim();
  if (!name) { const e = $('#drErr', A.root); e.textContent = 'Dá um nome à categoria.'; e.hidden = false; return; }
  const data = { name, kind: f.get('kind') === 'product' ? 'product' : 'service', intro: String(f.get('intro') || '').trim(), image: safeSrc(f.get('image')), visible: f.get('visible') === 'on' };
  if (A.drawer.isNew) {
    let id = slug(name); while (d.categories.some(c => c.id === id)) id = slug(name) + '-' + Math.random().toString(36).slice(2, 5);
    d.categories.push(Object.assign({ id }, data));
  } else Object.assign(d.categories.find(c => c.id === A.drawer.id), data);
  A.drawer = null; renderDrawer(); renderMain(); changed();
}

/* ------------------------------------------------------------------ galeria */
function vGallery() {
  const g = A.draft.gallery;
  const cards = g.map((x, i) => `<div class="gc">
<div class="gc__img">${safeSrc(x.image) ? `<img src="${esc(safeSrc(x.image))}" alt="">` : ''}${x.example ? '<span class="badge badge--ex">Exemplo</span>' : ''}</div>
<div class="gc__body"><label class="af af--sm"><span>Título</span><input data-bind="gallery.${i}.title" value="${esc(x.title)}" maxlength="80" placeholder="Ex.: BMW M3, correção 2 fases"></label>
<label class="af af--sm"><span>Etiqueta</span><input data-bind="gallery.${i}.tag" value="${esc(x.tag)}" maxlength="24" placeholder="Ex.: Wrap"></label>
${x.example ? `<label class="chk"><input type="checkbox" data-bind="gallery.${i}.example" data-type="bool" checked><span>Marcar como exemplo</span></label>` : ''}</div>
<div class="gc__acts"><button type="button" class="ibtn" data-act="gal-move" data-i="${i}" data-dir="-1" aria-label="Mover para trás" title="Mover para trás">${ic.left}</button>
<button type="button" class="ibtn" data-act="gal-move" data-i="${i}" data-dir="1" aria-label="Mover para a frente" title="Mover para a frente">${ic.right}</button><span class="sp"></span>
${A.modal && A.modal.galDel === i ? `<span class="del-q">Apagar?</span><button type="button" class="abtn abtn--danger abtn--sm" data-act="gal-del" data-i="${i}">Sim</button><button type="button" class="abtn abtn--text abtn--sm" data-act="gal-del-no">Não</button>`
    : `<button type="button" class="ibtn" data-act="gal-del-ask" data-i="${i}" aria-label="Apagar foto" title="Apagar">${ic.trash}</button>`}</div></div>`).join('');
  return head('Galeria', 'Fotos dos teus trabalhos. As marcadas como exemplo estão lá só para veres o aspeto: apaga-as quando tiveres as tuas.',
    `<label class="abtn abtn--primary">${ic.plus}Adicionar fotos<input type="file" accept="image/*" multiple data-upload-gallery hidden></label>`)
    + `<p class="up-msg" id="galMsg" aria-live="polite"></p>`
    + (g.length ? `<div class="gcs">${cards}</div>` : empty('Ainda não há fotos.', 'Enquanto a galeria estiver vazia, a secção «Trabalhos» não aparece no site.'));
}

/* ------------------------------------------------------------------ simulador */
function vSimulator() {
  const d = A.draft, s = d.simulator;
  const opts = `<option value="">Não mostrar preço</option>` + d.items.map(i => `<option value="${esc(i.id)}"${i.id === s.priceItem ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
  const rows = d.wrapColors.map((c, i) => `<li class="crow">
<span class="swm" data-f="${esc(c.finish)}" style="--c:${hexOk(c.hex)};--c2:${hexOk(c.hex2 || c.hex)}"></span>
<label class="af af--sm crow__name"><span>Nome</span><input data-bind="wrapColors.${i}.name" value="${esc(c.name)}" maxlength="40"></label>
<label class="af af--sm"><span>Acabamento</span><select data-bind="wrapColors.${i}.finish" data-rerender>${FINISHES.map(f => `<option value="${f.id}"${f.id === c.finish ? ' selected' : ''}>${f.label}</option>`).join('')}</select></label>
<label class="af af--sm crow__col"><span>Cor</span><input type="color" data-bind="wrapColors.${i}.hex" value="${hexOk(c.hex)}"></label>
${c.finish === 'flip' ? `<label class="af af--sm crow__col"><span>Segunda cor</span><input type="color" data-bind="wrapColors.${i}.hex2" value="${hexOk(c.hex2 || c.hex)}"></label>` : ''}
<span class="crow__acts"><button type="button" class="ibtn" data-act="col-move" data-i="${i}" data-dir="-1" aria-label="Subir" title="Subir">${ic.up}</button><button type="button" class="ibtn" data-act="col-move" data-i="${i}" data-dir="1" aria-label="Descer" title="Descer">${ic.down}</button><button type="button" class="ibtn" data-act="col-del" data-i="${i}" aria-label="Apagar ${esc(c.name)}" title="Apagar">${ic.trash}</button></span>
</li>`).join('');
  return head('Simulador de wrap', 'As cores que os clientes podem experimentar no carro. Dentro de cada acabamento aparecem pela ordem desta lista.', `<button type="button" class="abtn abtn--primary" data-act="col-new">${ic.plus}Adicionar cor</button>`)
    + `<div class="card"><label class="tgl"><input type="checkbox" data-bind="simulator.visible" data-type="bool"${s.visible !== false ? ' checked' : ''}><span><b>Mostrar o simulador no site</b></span></label>
<label class="af"><span>Preço mostrado ao lado da cor</span><select data-bind="simulator.priceItem">${opts}</select></label>
<label class="af"><span>Nota por baixo do título</span><textarea data-bind="simulator.note" rows="2" maxlength="200">${esc(s.note)}</textarea></label></div>`
    + (rows ? `<ul class="crows">${rows}</ul>` : empty('Sem cores.', 'Sem cores, o simulador não aparece no site.'));
}

/* ------------------------------------------------------------------ página inicial */
function vHome() {
  const h = A.draft.hero;
  const hl = (h.highlights || []).map((t, i) => `<div class="li-row"><input data-bind="hero.highlights.${i}" value="${esc(t)}" maxlength="60" aria-label="Destaque ${i + 1}"><button type="button" class="ibtn" data-act="hl-del" data-i="${i}" aria-label="Apagar destaque" title="Apagar">${ic.trash}</button></div>`).join('');
  return head('Página inicial', 'O topo do site: a primeira coisa que os clientes leem.')
    + `<div class="card">
<label class="af"><span>Linha por cima do título</span><input data-bind="hero.eyebrow" value="${esc(h.eyebrow)}" maxlength="60"></label>
<label class="af"><span>Título</span><textarea data-bind="hero.title" rows="2" maxlength="90">${esc(h.title)}</textarea><small>Curto funciona melhor: até 6 ou 7 palavras.</small></label>
<label class="af"><span>Texto</span><textarea data-bind="hero.text" rows="3" maxlength="260">${esc(h.text)}</textarea></label>
<div class="af"><span>Destaques</span>${hl}${(h.highlights || []).length < 4 ? `<button type="button" class="abtn abtn--ghost abtn--sm" data-act="hl-add">${ic.plus}Adicionar destaque</button>` : ''}</div>
${imgFieldBound('hero.image', h.image, 'Foto principal (opcional)', 'Se escolheres uma foto, aparece no lugar do carro em estúdio. Usa uma foto deitada, larga.')}
</div>
<div class="card"><label class="af"><span>Nota da tabela de preços</span><textarea data-bind="priceNote" rows="3" maxlength="260">${esc(A.draft.priceNote)}</textarea></label></div>`;
}
function imgFieldBound(path, url, label, help) {
  const u = safeSrc(url);
  return `<div class="af"><span>${label}</span><div class="imgf">
<div class="imgf__prev imgf__prev--wide">${u ? `<img src="${esc(u)}" alt="">` : '<i>Sem foto</i>'}</div>
<div class="imgf__side"><label class="abtn abtn--ghost abtn--sm">${u ? 'Trocar' : 'Escolher foto'}<input type="file" accept="image/*" data-upload-bind="${path}" hidden></label>
${u ? `<button type="button" class="abtn abtn--text abtn--sm" data-act="bind-clear" data-path="${path}">Remover</button>` : ''}<p class="imgf__msg" aria-live="polite"></p></div></div>${help ? `<small>${help}</small>` : ''}</div>`;
}

/* ------------------------------------------------------------------ contactos */
function vContacts() {
  const b = A.draft.business;
  const f = (p, label, v, extra, help) => `<label class="af"><span>${label}</span><input data-bind="${p}" value="${esc(v)}" ${extra || ''}>${help ? `<small>${help}</small>` : ''}</label>`;
  const hours = (b.hours || []).map((h, i) => `<div class="li-row li-row--2"><input data-bind="business.hours.${i}.d" value="${esc(h.d)}" placeholder="Dias" aria-label="Dias"><input data-bind="business.hours.${i}.h" value="${esc(h.h)}" placeholder="Horas" aria-label="Horas"><button type="button" class="ibtn" data-act="hr-del" data-i="${i}" aria-label="Apagar linha" title="Apagar">${ic.trash}</button></div>`).join('');
  return head('Contactos e horário', 'Aparecem no topo, nos botões de WhatsApp e no fim do site.')
    + `<div class="card grid2">
${f('business.name', 'Nome do negócio', b.name, 'maxlength="40"')}
${f('business.zone', 'Zona', b.zone, 'maxlength="60" placeholder="Ex.: Cascais e Lisboa"')}
${f('business.whatsapp', 'WhatsApp', b.whatsapp, 'inputmode="numeric" data-type="digits" placeholder="351912345678"', 'Só números, com o indicativo 351 à frente.')}
${f('business.phone', 'Telefone (como aparece)', b.phone, 'placeholder="+351 912 345 678"')}
${f('business.email', 'Email', b.email, 'type="email"')}
${f('business.instagram', 'Instagram', b.instagram, 'placeholder="sem @"')}
${f('business.address', 'Morada (opcional)', b.address, '')}
${f('business.mapsUrl', 'Link do Google Maps (opcional)', b.mapsUrl, 'type="url" placeholder="https://maps.app.goo.gl/…"')}
</div>
<div class="card"><div class="af"><span>Horário</span>${hours}<button type="button" class="abtn abtn--ghost abtn--sm" data-act="hr-add">${ic.plus}Adicionar linha</button></div>
${f('business.hoursNote', 'Nota do horário', b.hoursNote, 'maxlength="80" placeholder="Ex.: Só por marcação"')}</div>
<div class="card"><div class="af"><span>Tamanhos de carro</span><small>Os três escalões de preço da tabela.</small>
<div class="grid3">${A.draft.sizes.map((s, i) => `<input data-bind="sizes.${i}" value="${esc(s)}" maxlength="30" aria-label="Tamanho ${i + 1}">`).join('')}</div></div></div>`;
}

/* ------------------------------------------------------------------ perguntas */
function vFaq() {
  const rows = A.draft.faq.map((q, i) => `<li class="card fq">
<label class="af"><span>Pergunta</span><input data-bind="faq.${i}.q" value="${esc(q.q)}" maxlength="120"></label>
<label class="af"><span>Resposta</span><textarea data-bind="faq.${i}.a" rows="3" maxlength="600">${esc(q.a)}</textarea></label>
<div class="fq__acts"><button type="button" class="ibtn" data-act="faq-move" data-i="${i}" data-dir="-1" aria-label="Subir" title="Subir">${ic.up}</button><button type="button" class="ibtn" data-act="faq-move" data-i="${i}" data-dir="1" aria-label="Descer" title="Descer">${ic.down}</button><span class="sp"></span><button type="button" class="abtn abtn--text abtn--dangertext abtn--sm" data-act="faq-del" data-i="${i}">${ic.trash}Apagar</button></div></li>`).join('');
  return head('Perguntas frequentes', 'Respostas às dúvidas mais comuns antes de marcar.', `<button type="button" class="abtn abtn--primary" data-act="faq-new">${ic.plus}Adicionar pergunta</button>`)
    + (rows ? `<ul class="fqs">${rows}</ul>` : empty('Sem perguntas.', 'Sem perguntas, a secção não aparece no site.'));
}

/* ------------------------------------------------------------------ gaveta e janela */
function renderDrawer() {
  const box = $('#admDrawer', A.root); if (!box) return;
  if (!A.drawer) { box.innerHTML = ''; return; }
  const d = A.draft;
  let html = '';
  if (A.drawer.type === 'item') {
    const it = A.drawer.isNew ? A.drawer.tmp : d.items.find(i => i.id === A.drawer.id);
    if (!it) { A.drawer = null; box.innerHTML = ''; return; }
    html = itemForm(it, A.drawer.isNew);
  } else {
    const c = A.drawer.isNew ? A.drawer.tmp : d.categories.find(x => x.id === A.drawer.id);
    if (!c) { A.drawer = null; box.innerHTML = ''; return; }
    html = catForm(c, A.drawer.isNew);
  }
  const prevScroll = $('.dr__body', box) ? $('.dr__body', box).scrollTop : 0;
  box.innerHTML = `<div class="scrim" data-act="drawer-close"></div><div class="drawer" role="dialog" aria-modal="true" aria-label="${A.drawer.type === 'item' ? 'Editar item' : 'Editar categoria'}">${html}</div>`;
  const body = $('.dr__body', box); if (body) body.scrollTop = prevScroll;
  if (!A.drawer.focused) { A.drawer.focused = true; const n = $('input[name="name"]', box); if (n) n.focus(); }
}
function renderModal() {
  const box = $('#admModal', A.root); if (!box) return;
  if (A.modal !== 'exit') { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="scrim"></div><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mdT"><h2 id="mdT">Tens alterações por publicar</h2>
<p>Se saíres agora, ficam guardadas neste dispositivo e podes publicá-las da próxima vez que entrares.</p>
<div class="modal__acts"><button type="button" class="abtn abtn--primary" data-act="publish-exit">${N.Store.mode === 'local' ? 'Guardar e sair' : 'Publicar e sair'}</button><button type="button" class="abtn abtn--ghost" data-act="exit-anyway">Sair sem publicar</button><button type="button" class="abtn abtn--text" data-act="modal-close">Continuar a editar</button></div></div>`;
  $('.modal .abtn--primary', box).focus();
}

/* ------------------------------------------------------------------ publicar */
function validate(d) {
  const wa = String(d.business.whatsapp || '').replace(/\D/g, '');
  if (wa.length < 9) return 'O número de WhatsApp tem de ter o indicativo à frente, por exemplo 351912345678.';
  if (d.items.some(i => !i.name)) return 'Há um item sem nome no catálogo.';
  if (d.categories.some(c => !c.name)) return 'Há uma categoria sem nome.';
  return '';
}
function publishError(e) {
  const code = e && e.code, msg = String(e && (e.message || e.error_description) || '');
  if (code === 'not_writer' || code === 'not_granted' || code === 'consent_required') return 'A tua conta não pode publicar este site.';
  if (code === 'conflict') return N.Store.mode === 'supabase'
    ? 'Alguém publicou uma versão mais recente noutro dispositivo. As tuas alterações ficaram guardadas aqui: sai do painel, volta a entrar e escolhe «Usar mesmo assim» se as quiseres manter.'
    : 'Foi publicada uma versão mais recente entretanto. A página vai recarregar; as tuas alterações ficam guardadas neste dispositivo.';
  if (code === 'rate_limited') return 'Publicaste várias vezes seguidas. Espera um minuto e tenta outra vez.';
  if (code === 'too_large') return 'O site ficou grande demais para publicar. Usa fotos mais pequenas.';
  if (code === 'storage_full') return 'Este browser não tem espaço para guardar mais. Apaga algumas fotos ou exporta os dados.';
  if (/row-level security|permission|42501/i.test(msg)) return 'A tua conta não tem permissão para publicar. Confirma que está na tabela de administradores do Supabase.';
  return 'Não foi possível publicar. Verifica a ligação à internet e tenta outra vez.';
}
async function publish(thenExit) {
  if (A.busy) return;
  if (!isDirty()) { if (thenExit) close(true); else N.toast('Não há alterações por publicar.'); return; }
  const problem = validate(A.draft);
  if (problem) { N.toast(problem, 6000); return; }
  A.busy = true; updateTop();
  N.ls.set(LS_DRAFT, JSON.stringify({ base: A.data.updatedAt, savedAt: new Date().toISOString(), draft: A.draft }));
  try {
    const doc = clone(A.draft);
    const res = await N.Store.save(doc, A.data.updatedAt);
    if (res && res.reload) return;
    A.data = clone(doc); A.draft = clone(doc); A.notice = null;
    N.ls.del(LS_DRAFT);
    N.published = clone(doc);
    N.toast(N.Store.mode === 'local' ? 'Guardado neste browser.' : 'Publicado. O site já mostra as alterações.');
    if (thenExit) { A.busy = false; close(true); return; }
  } catch (e) {
    console.warn('[publicar]', e);
    N.toast(publishError(e), 7000);
  } finally {
    A.busy = false; A.modal = null;
    if (A.open) { renderModal(); updateTop(); }
  }
}

/* ------------------------------------------------------------------ fotos */
function uploadError(e) {
  const code = e && e.code;
  if (code === 'not_granted' || code === 'not_writer') return 'Só quem pode editar este site consegue carregar fotos.';
  if (code === 'quota_or_state') return 'Já não há espaço para mais fotos. Apaga as que já não usas.';
  if (code === 'too_large') return 'Esta foto é grande demais.';
  if (code === 'unsupported_type') return 'Formato não suportado. Usa JPG, PNG ou WebP.';
  if (code === 'rate_limited') return 'Estás a carregar muitas fotos seguidas. Espera um pouco.';
  return (e && e.message && /imagem/.test(e.message)) ? e.message : 'Não foi possível carregar a foto. Tenta outra vez.';
}
async function uploadOne(file) { const blob = await N.prepareImage(file); return N.Store.upload(blob); }
async function onUploadField(input) {
  const box = input.closest('.imgf'), msg = $('.imgf__msg', box), file = input.files && input.files[0];
  if (!file) return;
  msg.textContent = 'A carregar…';
  try {
    const url = await uploadOne(file);
    if (input.dataset.upload) {
      const form = input.closest('form'), name = input.dataset.upload;
      form.querySelector(`input[type="hidden"][name="${name}"]`).value = url;
      $('.imgf__prev', box).innerHTML = `<img src="${esc(url)}" alt="">`;
      msg.textContent = 'Carregada. Carrega em «Guardar».';
    } else if (input.dataset.uploadBind) {
      setPath(A.draft, input.dataset.uploadBind, url); changed(); renderMain();
      N.toast('Foto carregada. Publica para aparecer no site.');
    }
  } catch (e) { console.warn('[foto]', e); msg.textContent = uploadError(e); }
  input.value = '';
}
async function onUploadGallery(input) {
  const files = Array.from(input.files || []); if (!files.length) return;
  const msg = $('#galMsg', A.root);
  let ok = 0, fail = '';
  for (let i = 0; i < files.length; i++) {
    if (msg) msg.textContent = `A carregar ${i + 1} de ${files.length}…`;
    try {
      const url = await uploadOne(files[i]);
      A.draft.gallery.unshift({ id: uid('g'), image: url, title: '', tag: '', example: false }); ok++;
    } catch (e) { console.warn('[foto]', e); fail = uploadError(e); }
  }
  input.value = '';
  changed(); renderMain();
  const m2 = $('#galMsg', A.root);
  if (m2) m2.textContent = ok ? `${ok} ${ok === 1 ? 'foto adicionada' : 'fotos adicionadas'}. Dá-lhes um título e publica.` + (fail ? ' ' + fail : '') : fail;
}

/* ------------------------------------------------------------------ eventos */
function bind() {
  A.root.addEventListener('click', onClick);
  A.root.addEventListener('input', onInput);
  A.root.addEventListener('change', onChange);
  A.root.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', e => {
    if (!A.open || e.key !== 'Escape') return;
    if (A.drawer) { A.drawer = null; renderDrawer(); }
    else if (A.modal === 'exit') { A.modal = null; renderModal(); }
  });
}
function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || !A.root.contains(b)) return;
  const act = b.dataset.act, d = A.draft;
  const id = b.dataset.id, i = Number(b.dataset.i), dir = Number(b.dataset.dir);
  switch (act) {
    case 'exit': if (canEnter()) close(); else { A.open = false; A.root.hidden = true; document.documentElement.classList.remove('adm-open'); try { history.replaceState(null, '', location.pathname + location.search); } catch (er) { /* sem histórico */ } } break;
    case 'enter': A.entered = true; N.ss.set('niche-adm-in', '1'); render(); break;
    case 'local-login': N.Store.login().then(s => { A.session = s; A.entered = true; render(); }); break;
    case 'reset': {
      const email = ($('input[name="email"]', A.root) || {}).value || '';
      const err = $('#lgErr', A.root);
      if (!email) { err.textContent = 'Escreve o teu email e carrega outra vez em «Esqueci-me».'; err.hidden = false; break; }
      N.Store.resetPassword(email).then(() => { err.textContent = 'Se esse email tiver acesso, recebes um link para criares uma palavra-passe nova.'; err.hidden = false; }, () => { err.textContent = 'Não foi possível enviar o email. Confirma o endereço.'; err.hidden = false; });
      break;
    }
    case 'logout':
      if (isDirty()) { A.modal = 'exit'; renderModal(); break; }
      N.ss.del('niche-adm-in'); A.entered = false;
      N.Store.logout().then(() => N.Store.session()).then(s => { A.session = s; close(true); });
      break;
    case 'view': A.view = b.dataset.view; A.drawer = null; render(); { const m = $('#admMain', A.root); if (m) m.scrollTop = 0; } break;
    case 'preview':
      A.open = false; A.root.hidden = true; document.documentElement.classList.remove('adm-open');
      N.setData(A.draft, { preview: true }); scrollTo(0, 0); break;
    case 'publish': publish(false); break;
    case 'publish-exit': publish(true); break;
    case 'exit-anyway': A.modal = null; N.ls.set(LS_DRAFT, JSON.stringify({ base: A.data.updatedAt, savedAt: new Date().toISOString(), draft: A.draft })); A.draft = null; close(true); break;
    case 'modal-close': A.modal = null; renderModal(); break;
    case 'discard': A.draft = clone(A.data); A.notice = null; N.ls.del(LS_DRAFT); render(); break;
    case 'use-stale': A.draft = N.normalize(A.staleDraft.draft); A.staleDraft = null; A.notice = null; changed(); render(); break;
    case 'drop-stale': A.staleDraft = null; A.notice = null; N.ls.del(LS_DRAFT); render(); break;
    case 'export': {
      const blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'site.json'; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      break;
    }
    case 'filter': A.filter = id; renderMain(); break;
    case 'item-new': {
      const cat = A.filter !== 'all' ? A.filter : (d.categories[0] || {}).id;
      const isProd = (d.categories.find(c => c.id === cat) || {}).kind === 'product';
      A.drawer = { type: 'item', isNew: true, id: uid('i'), tmp: { id: '', category: cat, name: '', description: '', includes: [], duration: '', price: { mode: isProd ? 'fixed' : 'sizes', from: false, values: [0, 0, 0], value: 0 }, image: '', featured: false, visible: true } };
      A.drawer.tmp.id = A.drawer.id; renderDrawer(); break;
    }
    case 'item-edit': A.drawer = { type: 'item', id }; renderDrawer(); break;
    case 'item-move': {
      const k = d.items.findIndex(x => x.id === id); if (k < 0) break;
      const cat = d.items[k].category; let j = k + dir;
      while (j >= 0 && j < d.items.length && d.items[j].category !== cat) j += dir;
      if (j >= 0 && j < d.items.length) { move(d.items, k, j); changed(); renderMain(); }
      break;
    }
    case 'item-vis': { const it = d.items.find(x => x.id === id); if (it) { it.visible = it.visible === false; changed(); renderMain(); } break; }
    case 'item-dup': {
      const k = d.items.findIndex(x => x.id === id); if (k < 0) break;
      const cp = clone(d.items[k]); cp.id = uid('i'); cp.name = cp.name + ' (cópia)'; cp.visible = false;
      d.items.splice(k + 1, 0, cp); changed(); renderMain(); N.toast('Cópia criada e escondida. Edita-a e torna-a visível.');
      break;
    }
    case 'del-ask': A.drawer.confirmDel = true; renderDrawer(); break;
    case 'del-cancel': A.drawer.confirmDel = false; renderDrawer(); break;
    case 'item-del': d.items = d.items.filter(x => x.id !== A.drawer.id); if (d.simulator.priceItem === A.drawer.id) d.simulator.priceItem = ''; A.drawer = null; renderDrawer(); changed(); renderMain(); break;
    case 'drawer-close': A.drawer = null; renderDrawer(); break;
    case 'img-clear': { const form = b.closest('form'); form.querySelector(`input[type="hidden"][name="${b.dataset.name}"]`).value = ''; const box = b.closest('.imgf'); $('.imgf__prev', box).innerHTML = '<i>Sem imagem</i>'; b.remove(); break; }
    case 'bind-clear': setPath(d, b.dataset.path, ''); changed(); renderMain(); break;
    case 'cat-new': A.drawer = { type: 'cat', isNew: true, tmp: { id: '', name: '', kind: 'service', intro: '', image: '', visible: true } }; renderDrawer(); break;
    case 'cat-edit': A.drawer = { type: 'cat', id }; renderDrawer(); break;
    case 'cat-move': move(d.categories, i, i + dir); changed(); renderMain(); break;
    case 'cat-vis': d.categories[i].visible = d.categories[i].visible === false; changed(); renderMain(); break;
    case 'cat-del': d.categories = d.categories.filter(c => c.id !== A.drawer.id); if (A.filter === A.drawer.id) A.filter = 'all'; A.drawer = null; renderDrawer(); changed(); renderMain(); break;
    case 'gal-move': move(d.gallery, i, i + dir); changed(); renderMain(); break;
    case 'gal-del-ask': A.modal = { galDel: i }; renderMain(); break;
    case 'gal-del-no': A.modal = null; renderMain(); break;
    case 'gal-del': d.gallery.splice(i, 1); A.modal = null; changed(); renderMain(); break;
    case 'col-new': d.wrapColors.push({ id: uid('c'), name: 'Nova cor', finish: 'gloss', hex: '#5a6b7a', hex2: '' }); changed(); renderMain(); break;
    case 'col-move': move(d.wrapColors, i, i + dir); changed(); renderMain(); break;
    case 'col-del': d.wrapColors.splice(i, 1); changed(); renderMain(); break;
    case 'hl-add': d.hero.highlights.push(''); changed(); renderMain(); { const ins = A.root.querySelectorAll('[data-bind^="hero.highlights."]'); if (ins.length) ins[ins.length - 1].focus(); } break;
    case 'hl-del': d.hero.highlights.splice(i, 1); changed(); renderMain(); break;
    case 'hr-add': d.business.hours.push({ d: '', h: '' }); changed(); renderMain(); break;
    case 'hr-del': d.business.hours.splice(i, 1); changed(); renderMain(); break;
    case 'faq-new': d.faq.push({ q: '', a: '' }); changed(); renderMain(); { const ins = A.root.querySelectorAll('[data-bind$=".q"]'); if (ins.length) ins[ins.length - 1].focus(); } break;
    case 'faq-move': move(d.faq, i, i + dir); changed(); renderMain(); break;
    case 'faq-del': d.faq.splice(i, 1); changed(); renderMain(); break;
    default: break;
  }
}
function bindValue(el) {
  if (el.dataset.type === 'bool') return el.checked;
  if (el.dataset.type === 'digits') return el.value.replace(/\D/g, '');
  return el.value;
}
function onInput(e) {
  const el = e.target;
  if (el.id === 'admQ') { A.q = el.value; const l = $('#admList', A.root); if (l) l.innerHTML = listHTML(); return; }
  if (el.dataset.bind && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
    setPath(A.draft, el.dataset.bind, bindValue(el)); changed();
    if (el.type === 'color') { const sw = el.closest('.crow') && $('.swm', el.closest('.crow')); if (sw) { sw.style.setProperty(el.dataset.bind.endsWith('hex2') ? '--c2' : '--c', el.value); } }
  }
  const form = el.closest('form[data-form="item"]');
  if (form && el.name === 'pmode') form.dataset.pmode = el.value;
}
function onChange(e) {
  const el = e.target;
  if (el.matches('[data-upload],[data-upload-bind]')) { onUploadField(el); return; }
  if (el.matches('[data-upload-gallery]')) { onUploadGallery(el); return; }
  const form = el.closest('form[data-form="item"]');
  if (form && el.name === 'pmode') { form.dataset.pmode = el.value; return; }
  if (el.dataset.type === 'digits') { el.value = el.value.replace(/\D/g, ''); }
  if (el.dataset.bind && (el.type === 'checkbox' || el.tagName === 'SELECT')) {
    setPath(A.draft, el.dataset.bind, bindValue(el)); changed();
    if (el.hasAttribute('data-rerender')) renderMain();
  }
}
async function onSubmit(e) {
  const form = e.target; e.preventDefault();
  if (form.dataset.form === 'item') saveItem(form);
  else if (form.dataset.form === 'cat') saveCat(form);
  else if (form.dataset.form === 'password') {
    const f = new FormData(form), err = $('#pwErr', A.root), btn = $('button[type="submit"]', form);
    const p1 = String(f.get('p1') || ''), p2 = String(f.get('p2') || '');
    const show = t => { err.textContent = t; err.hidden = false; };
    if (p1.length < 8) return show('A palavra-passe tem de ter pelo menos 8 caracteres.');
    if (p1 !== p2) return show('As duas palavras-passe não são iguais.');
    btn.disabled = true; btn.textContent = 'A guardar…';
    try { A.session = await N.Store.updatePassword(p1); N.toast('Palavra-passe guardada.'); try { history.replaceState(null, '', location.pathname + location.search); } catch (er) { /* sem histórico */ } render(); }
    catch (er) { show(/weak|short/i.test(String(er && er.message)) ? 'Essa palavra-passe é fraca. Usa mais caracteres, números e símbolos.' : 'Não foi possível guardar. Pede um link novo em «Esqueci-me da palavra-passe».'); btn.disabled = false; btn.textContent = 'Guardar e entrar'; }
  }
  else if (form.dataset.form === 'login') {
    const f = new FormData(form), err = $('#lgErr', A.root), btn = $('button[type="submit"]', form);
    const email = String(f.get('email') || '').trim(), pass = String(f.get('password') || '');
    if (!email || !pass) { err.textContent = 'Escreve o email e a palavra-passe.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'A entrar…';
    try {
      A.session = await N.Store.login(email, pass);
      if (!A.session.canEdit) { await N.Store.logout(); A.session = { signedIn: true, canEdit: false }; }
      render();
    } catch (er) {
      err.textContent = /invalid/i.test(String(er && er.message)) ? 'Email ou palavra-passe errados.' : 'Não foi possível entrar. Verifica a ligação e tenta outra vez.';
      err.hidden = false; btn.disabled = false; btn.textContent = 'Entrar';
    }
  }
}

async function refresh() { if (!A.open) return; try { A.session = await N.Store.session(); } catch (e) { console.warn(e); } render(); }
window.NicheAdmin = { open, close, refresh, publish: () => publish(false), isOpen: () => A.open };
})();
