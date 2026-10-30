// Everything around the page content: header, footer, bottom nav, search suggestions,
// chat button, compare tray, live order notices, install bar and global click actions.
import { h, safeUrl } from './h.js';
import { t, getLang } from './i18n.js';
import { S, CATS, PAGES, cart, wish, compare, COMPARE_MAX, money, on, ls, ss, api, tr, catName, waLink, messengerLink, track, getTheme, setTheme, setLang, pwa, isStandalone, isIOS, copyText, ago, $, $$ } from './core.js';
import { icon, toast, openModal, openLightbox } from './ui.js';
import { navigate } from './router.js';
import { quickView } from './buybox.js';

/* ---------------- header ---------------- */
function logoHtml(cls = '') {
  const name = S.siteName;
  if (S.logo) {
    return h`<a class="logo ${cls}${S.logoDark ? ' has-dark' : ''}" href="/" aria-label="${name}"><img class="logo-l" src="${S.logo}" alt="${name}">${S.logoDark ? h`<img class="logo-d" src="${S.logoDark}" alt="">` : ''}</a>`;
  }
  return h`<a class="logo ${cls}" href="/" aria-label="${name}"><span class="wm">${name}</span><i class="wm-dot" aria-hidden="true"></i></a>`;
}

export function headerHtml() {
  const ann = S.announcement && S.announcement.enabled ? tr(S.announcement.text) : '';
  const annHtml = ann ? (S.announcement.link ? h`<a class="ann" href="${safeUrl(S.announcement.link)}">${ann}</a>` : h`<div class="ann">${ann}</div>`) : '';
  const lang = getLang();
  return h`${annHtml}
<div class="hd-main wrap">
${logoHtml()}
<form class="search" action="/shop" role="search" data-search-form>
<input type="search" name="q" data-search-input placeholder="${t('search_ph')}" autocomplete="off" enterkeyhint="search" aria-label="${t('search')}" aria-controls="sugg" aria-autocomplete="list">
<button type="submit" aria-label="${t('search')}">${icon('search')}</button>
<div class="sugg" id="sugg" role="listbox" hidden></div>
</form>
<div class="hd-actions">
<button type="button" class="hbtn lang" data-act="lang" aria-label="${t('switch_lang')}">${lang === 'bn' ? 'EN' : 'বাং'}</button>
<button type="button" class="hbtn" data-act="theme" aria-label="${t('switch_theme')}"><span class="th-moon">${icon('moon')}</span><span class="th-sun">${icon('sun')}</span></button>
<a class="hbtn" href="/wishlist" aria-label="${t('wishlist')}">${icon('heart')}<span class="badge" data-badge="wish" ${wish.list.length ? '' : 'hidden'}>${wish.list.length}</span></a>
<a class="hbtn only-lg" href="/account" aria-label="${t('nav_account')}">${icon('user')}</a>
<a class="hbtn cart-btn" href="/cart" aria-label="${t('cart')}">${icon('bag')}<span class="badge" data-badge="cart" ${cart.count() ? '' : 'hidden'}>${cart.count()}</span></a>
</div>
</div>
<nav class="cats wrap" aria-label="${t('categories')}">
<a href="/shop" data-nav="/shop">${t('all_products')}</a>
${CATS.map((c) => h`<a href="/c/${c.slug}" data-nav="/c/${c.slug}">${catName(c)}</a>`)}
<a href="/track" data-nav="/track" class="push">${t('track_order')}</a>
</nav>`;
}

/* ---------------- footer ---------------- */
const badge = (b) => (b.image ? h`<span class="pbadge img"><img src="${b.image}" alt="${b.label}" loading="lazy"></span>` : h`<span class="pbadge">${b.label}</span>`);

export function footerHtml() {
  const c = S.contact || {};
  const social = [['Facebook', S.social && S.social.facebook], ['Instagram', S.social && S.social.instagram], ['TikTok', S.social && S.social.tiktok], ['YouTube', S.social && S.social.youtube]].filter((x) => x[1]);
  const pay = ((S.badges && S.badges.payment) || []).filter((b) => b.enabled);
  const cou = ((S.badges && S.badges.courier) || []).filter((b) => b.enabled);
  const lang = getLang();
  return h`<div class="ft-top wrap">
<div class="ft-brand">
${logoHtml('ft-logo')}
<p>${tr(S.tagline)}</p>
${social.length || c.whatsapp ? h`<div class="ft-social">${social.map(([n, u]) => h`<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${n}</a>`)}${c.whatsapp ? h`<a href="${waLink('')}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</div>` : ''}
</div>
<nav class="ft-col" aria-label="${t('shop_links')}"><h4>${t('shop_links')}</h4>
<a href="/shop">${t('all_products')}</a><a href="/categories">${t('categories')}</a><a href="/track">${t('track_order')}</a><a href="/wishlist">${t('wishlist')}</a><a href="/compare">${t('compare')}</a>
</nav>
<nav class="ft-col" aria-label="${t('help')}"><h4>${t('help')}</h4>
${PAGES.map((p) => h`<a href="/page/${p.slug}">${lang === 'en' && p.titleEn ? p.titleEn : p.title}</a>`)}
</nav>
<div class="ft-col"><h4>${t('contact_us')}</h4>
${c.phone ? h`<a href="tel:${c.phone}">${icon('phone')}<span>${c.phone}</span></a>` : ''}
${c.email ? h`<a href="mailto:${c.email}">${icon('mail')}<span>${c.email}</span></a>` : ''}
${tr(c.address) ? h`<span class="ft-line">${icon('pin')}<span>${tr(c.address)}</span></span>` : ''}
${tr(c.hours) ? h`<span class="ft-line">${icon('clock')}<span>${tr(c.hours)}</span></span>` : ''}
</div>
</div>
${pay.length || cou.length ? h`<div class="ft-pay wrap">
${pay.length ? h`<div><span class="ft-pl">${t('we_accept')}</span><div class="pb-row">${pay.map(badge)}</div></div>` : ''}
${cou.length ? h`<div><span class="ft-pl">${t('we_deliver_with')}</span><div class="pb-row">${cou.map(badge)}</div></div>` : ''}
</div>` : ''}
<div class="ft-bot wrap"><span>© ${new Date().getFullYear()} ${S.siteName}. ${t('rights')}</span>${S.legal && (S.legal.tradeLicense || S.legal.bin) ? h`<span>${S.legal.tradeLicense ? t('trade_license') + ': ' + S.legal.tradeLicense : ''}${S.legal.tradeLicense && S.legal.bin ? '   ' : ''}${S.legal.bin ? 'BIN: ' + S.legal.bin : ''}</span>` : ''}</div>`;
}

/* ---------------- bottom navigation (phones) ---------------- */
export function bottomNavHtml() {
  const it = (href, ic, label, extra = '') => h`<a href="${href}" data-nav="${href}" aria-label="${label}">${icon(ic)}<span>${label}</span>${extra}</a>`;
  return h`${it('/', 'home', t('nav_home'))}${it('/categories', 'grid', t('nav_categories'))}${it('/cart', 'bag', t('cart'), h`<i class="badge" data-badge="cart" ${cart.count() ? '' : 'hidden'}>${cart.count()}</i>`)}${it('/account', 'user', t('nav_account'))}`;
}

/* ---------------- chat button ---------------- */
export function chatHtml() {
  if (!S.marketing || !S.marketing.chatButton) return '';
  const wa = S.contact && (S.contact.whatsapp || S.contact.phone);
  const ms = messengerLink();
  if (!wa && !ms) return '';
  return h`<div class="chat"><div class="chat-panel" hidden>
${wa ? h`<a href="${waLink(t('wa_hello_general'))}" target="_blank" rel="noopener noreferrer" data-act="contact-click" class="c-wa">${icon('chat')}<span>WhatsApp</span></a>` : ''}
${ms ? h`<a href="${ms}" target="_blank" rel="noopener noreferrer" data-act="contact-click" class="c-ms">${icon('chat')}<span>Messenger</span></a>` : ''}
${S.contact && S.contact.phone ? h`<a href="tel:${S.contact.phone}" class="c-ph">${icon('phone')}<span>${t('call_us')}</span></a>` : ''}
</div><button type="button" class="chat-fab" data-act="chat-toggle" aria-expanded="false" aria-label="${t('chat_with_us')}">${icon('chat')}</button></div>`;
}

/* ---------------- compare tray ---------------- */
export function renderCompareTray() {
  const el = $('#cmp-tray');
  if (!el) return;
  const ids = compare.list;
  document.body.classList.toggle('has-cmp', ids.length > 0);
  if (!ids.length) {
    el.innerHTML = '';
    return;
  }
  const meta = ls.get('tn_cmpmeta', {});
  el.innerHTML = h`<div class="cmp wrap">
<div class="cmp-items">${ids.map((id) => h`<div class="cmp-it"><img src="${(meta[id] && meta[id].image) || '/img/placeholder.svg'}" alt="${(meta[id] && meta[id].name) || ''}"><button type="button" data-act="cmp-remove" data-id="${id}" aria-label="${t('remove')}">${icon('x')}</button></div>`)}</div>
<span class="cmp-txt">${ids.length < 2 ? t('compare_add_more') : t('compare_n', { n: ids.length, max: COMPARE_MAX })}</span>
<a class="btn btn-primary btn-sm" href="/compare">${t('compare_now')}</a>
<button type="button" class="btn-link" data-act="cmp-clear">${t('clear')}</button>
</div>`.s;
}

/* ---------------- mount everything ---------------- */
export function mountChrome() {
  $('#hd').innerHTML = headerHtml().s;
  $('#ft').innerHTML = footerHtml().s;
  $('#bn').innerHTML = bottomNavHtml().s;
  $('#chat').innerHTML = chatHtml().s;
  renderCompareTray();
  setActiveNav(location.pathname);
}

export function refreshBadges() {
  const set = (name, n) =>
    $$(`[data-badge="${name}"]`).forEach((b) => {
      b.textContent = n > 99 ? '99+' : n;
      b.hidden = !n;
    });
  set('cart', cart.count());
  set('wish', wish.list.length);
}

export function setActiveNav(path) {
  $$('[data-nav]').forEach((a) => {
    const href = a.dataset.nav;
    const on = href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------- search suggestions ---------------- */
let sugAbort = null;
let sugIdx = -1;
const recents = () => ls.get('tn_searches', []);
function saveRecent(q) {
  if (!q) return;
  ls.set('tn_searches', [q, ...recents().filter((x) => x !== q)].slice(0, 6));
}
function hl(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return h`${text}`;
  return h`${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`;
}
function hideSugg(box) {
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
  sugIdx = -1;
}
async function suggest(input) {
  const box = input.closest('.search').querySelector('.sugg');
  const q = input.value.trim();
  if (!q) {
    const r = recents();
    if (!r.length && !CATS.length) return hideSugg(box);
    box.innerHTML = h`${r.length ? h`<div class="sg-h">${t('recent_searches')}</div>${r.map((x) => h`<a class="sg-item sg-text" role="option" href="/shop?q=${encodeURIComponent(x)}">${icon('clock')}<span>${x}</span></a>`)}` : ''}
${CATS.length ? h`<div class="sg-h">${t('categories')}</div><div class="sg-cats">${CATS.slice(0, 8).map((c) => h`<a role="option" class="sg-item sg-chip" href="/c/${c.slug}">${catName(c)}</a>`)}</div>` : ''}`.s;
    box.hidden = false;
    sugIdx = -1;
    return;
  }
  if (sugAbort) sugAbort.abort();
  sugAbort = new AbortController();
  try {
    const d = await api('/search/suggest?q=' + encodeURIComponent(q), { signal: sugAbort.signal });
    box.innerHTML = h`${d.categories.length ? h`<div class="sg-cats">${d.categories.map((c) => h`<a role="option" class="sg-item sg-chip" href="/c/${c.slug}">${icon('grid')}${hl(catName(c), q)}</a>`)}</div>` : ''}
${d.products.map((p) => h`<a role="option" class="sg-item sg-prod" href="/p/${p.slug}"><img src="${p.image || '/img/placeholder.svg'}" alt="" loading="lazy"><span class="sg-name">${hl(p.name, q)}</span><b>${money(p.price)}</b></a>`)}
${d.products.length || d.categories.length ? '' : h`<div class="sg-none">${t('no_match', { q })}</div>`}
<a class="sg-all" role="option" href="/shop?q=${encodeURIComponent(q)}">${t('see_all_results', { q })}</a>`.s;
    box.hidden = false;
    sugIdx = -1;
  } catch (e) {
    /* aborted or offline: keep what is shown */
  }
}
let sugTimer;
function initSearch() {
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-search-input]')) return;
    clearTimeout(sugTimer);
    const inp = e.target;
    sugTimer = setTimeout(() => suggest(inp), 170);
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('[data-search-input]')) suggest(e.target);
  });
  document.addEventListener('keydown', (e) => {
    const inp = e.target.closest && e.target.closest('[data-search-input]');
    if (!inp) return;
    const box = inp.closest('.search').querySelector('.sugg');
    const items = $$('.sg-item, .sg-all', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (box.hidden || !items.length) return;
      e.preventDefault();
      sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle('act', i === sugIdx));
      items[sugIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sugIdx >= 0 && items[sugIdx]) {
      e.preventDefault();
      items[sugIdx].click();
    } else if (e.key === 'Escape') hideSugg(box);
  });
  document.addEventListener('click', (e) => {
    $$('.sugg').forEach((b) => {
      if (!b.parentElement.contains(e.target)) hideSugg(b);
    });
    if (e.target.closest('.sugg a')) {
      const box = e.target.closest('.sugg');
      const q = box.parentElement.querySelector('input').value.trim();
      if (q) saveRecent(q);
      hideSugg(box);
      box.parentElement.querySelector('input').blur();
    }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-search-form]');
    if (!f) return;
    e.preventDefault();
    const q = f.querySelector('input').value.trim();
    hideSugg(f.querySelector('.sugg'));
    f.querySelector('input').blur();
    if (q) {
      saveRecent(q);
      navigate('/shop?q=' + encodeURIComponent(q));
    } else navigate('/shop');
  });
}

/* ---------------- live order notices (real orders only) ---------------- */
let liveItems = [];
let liveI = 0;
let liveTimer = null;
let liveShown = 0;
export async function startLive() {
  if (!S.marketing || !S.marketing.liveNotices || ss.get('tn_live_off', false)) return;
  try {
    liveItems = (await api('/live')).items || [];
  } catch (e) {
    return;
  }
  if (!liveItems.length) return;
  liveTimer = setTimeout(showLive, 9000);
}
function showLive() {
  clearTimeout(liveTimer);
  const host = $('#live');
  if (!host || liveShown >= 8 || ss.get('tn_live_off', false)) return;
  if (document.hidden || document.body.classList.contains('no-live')) {
    liveTimer = setTimeout(showLive, 15000);
    return;
  }
  const it = liveItems[liveI++ % liveItems.length];
  liveShown++;
  const where = getLang() === 'en' ? it.districtEn : it.district;
  host.innerHTML = h`<div class="live-item"><a href="/p/${it.slug}" class="live-link"><img src="${it.image || '/img/placeholder.svg'}" alt=""><span class="live-txt"><b>${t('live_bought', { name: it.name, district: where })}</b><span>${it.product}</span><em>${ago(it.minutesAgo)}</em></span></a><button type="button" data-act="live-close" aria-label="${t('close')}">${icon('x')}</button></div>`.s;
  requestAnimationFrame(() => host.firstElementChild && host.firstElementChild.classList.add('in'));
  setTimeout(() => {
    const el = host.firstElementChild;
    if (el) {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 300);
    }
  }, 6800);
  liveTimer = setTimeout(showLive, 26000);
}

/* ---------------- add to home screen bar ---------------- */
export function maybeShowInstallBar() {
  const dismissed = ls.get('tn_inst_dismiss', 0);
  if (Date.now() - dismissed < 7 * 86400000) return;
  if (isStandalone()) return;
  if (!pwa.prompt && !isIOS()) return;
  if (document.body.classList.contains('checkout')) return;
  const el = $('#instbar');
  if (!el || el.innerHTML) return;
  el.innerHTML = h`<div class="instbar"><img src="/img/icon-192.png" alt="" width="40" height="40"><div><b>${t('install_title', { name: S.siteName })}</b><span>${t('install_text')}</span></div><button type="button" class="btn btn-primary btn-sm" data-act="install">${t('install')}</button><button type="button" class="ib" data-act="install-dismiss" aria-label="${t('close')}">${icon('x')}</button></div>`.s;
}

export async function doInstall() {
  if (pwa.prompt) {
    pwa.prompt.prompt();
    const r = await pwa.prompt.userChoice.catch(() => null);
    pwa.prompt = null;
    if (r && r.outcome === 'accepted') toast(t('install_done'));
    $('#instbar').innerHTML = '';
  } else if (isIOS()) {
    openModal(h`<div class="ios-how"><h2>${t('install_ios_title')}</h2><ol><li>${t('install_ios_1')}</li><li>${t('install_ios_2')}</li><li>${t('install_ios_3')}</li></ol></div>`, { label: t('install') });
  } else {
    toast(t('install_menu_hint'));
  }
}

/* ---------------- wishlist / compare helpers ---------------- */
function syncToggleButtons(act, id, on) {
  $$(`[data-act="${act}"][data-id="${id}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

export function toggleWish(id, meta = {}) {
  const added = wish.toggle(id);
  syncToggleButtons('wish', id, added);
  refreshBadges();
  if (added) {
    toast(t('wish_added'), { action: { label: t('view'), href: '/wishlist' } });
    track('AddToWishlist', { ids: [id], name: meta.name, value: meta.price });
  }
}

export function toggleCompare(id, meta = {}) {
  const added = compare.toggle(id);
  if (added === null) {
    toast(t('compare_max', { max: COMPARE_MAX }), { kind: 'warn' });
    return;
  }
  if (added) {
    const m = ls.get('tn_cmpmeta', {});
    m[id] = { name: meta.name || '', image: meta.image || '', slug: meta.slug || '' };
    ls.set('tn_cmpmeta', m);
  }
  syncToggleButtons('compare', id, added);
  renderCompareTray();
}

/* ---------------- global click actions ---------------- */
export const actions = {
  wish(el) {
    const c = el.closest('.pc');
    toggleWish(el.dataset.id, { name: el.dataset.name || (c && c.querySelector('.pc-title a') && c.querySelector('.pc-title a').textContent) });
  },
  compare(el) {
    const c = el.closest('.pc');
    toggleCompare(el.dataset.id, {
      name: el.dataset.name || (c && c.querySelector('.pc-title a') && c.querySelector('.pc-title a').textContent),
      image: el.dataset.image || (c && c.querySelector('.pc-img img') && c.querySelector('.pc-img img').getAttribute('src')),
      slug: el.dataset.slug || (c && c.querySelector('.pc-title a') && c.querySelector('.pc-title a').getAttribute('href').replace('/p/', '')),
    });
  },
  quick(el) {
    quickView(el.dataset.slug);
  },
  addcard(el) {
    const price = Number(el.dataset.price);
    cart.add({ pid: el.dataset.id, vk: '', price, name: el.dataset.name, image: el.dataset.image, slug: el.dataset.slug }, 1);
    track('AddToCart', { ids: [el.dataset.id], name: el.dataset.name, value: price, contents: [{ id: el.dataset.id, qty: 1, price, name: el.dataset.name }] });
    toast(t('added_to_cart'), { action: { label: t('view_cart'), href: '/cart' } });
  },
  'cmp-remove'(el) {
    compare.remove(el.dataset.id);
    syncToggleButtons('compare', el.dataset.id, false);
    renderCompareTray();
  },
  'cmp-clear'() {
    const ids = [...compare.list];
    compare.clear();
    ids.forEach((id) => syncToggleButtons('compare', id, false));
    renderCompareTray();
  },
  theme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  },
  lang() {
    setLang(getLang() === 'bn' ? 'en' : 'bn');
  },
  'chat-toggle'(el) {
    const panel = el.parentElement.querySelector('.chat-panel');
    const open = panel.hidden;
    panel.hidden = !open;
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.classList.toggle('open', open);
  },
  'contact-click'() {
    track('Contact', {});
  },
  'live-close'() {
    ss.set('tn_live_off', true);
    $('#live').innerHTML = '';
  },
  install() {
    doInstall();
  },
  'install-dismiss'() {
    ls.set('tn_inst_dismiss', Date.now());
    $('#instbar').innerHTML = '';
  },
  async share(el) {
    const url = el.dataset.url || location.href;
    const title = el.dataset.title || document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    if (await copyText(url)) toast(t('link_copied'));
  },
  async copy(el) {
    if (await copyText(el.dataset.text)) toast(t('copied'));
  },
  back() {
    if (history.length > 1) history.back();
    else navigate('/');
  },
  lightbox(el) {
    const list = JSON.parse(el.dataset.images || '[]');
    openLightbox(list, Number(el.dataset.i || 0));
  },
};

export function initChrome() {
  initSearch();
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      // close the chat panel when tapping elsewhere
      const panel = $('.chat-panel');
      if (panel && !panel.hidden && !e.target.closest('.chat')) {
        panel.hidden = true;
        $('.chat-fab').classList.remove('open');
        $('.chat-fab').setAttribute('aria-expanded', 'false');
      }
      return;
    }
    const fn = actions[el.dataset.act];
    if (fn) {
      if (el.tagName !== 'A') e.preventDefault();
      fn(el, e);
    }
  });
  on('cart', refreshBadges);
  on('tn_wish', refreshBadges);
  on('tn_compare', () => renderCompareTray());
}
