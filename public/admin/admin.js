// Admin panel shell: login, navigation, hash router. Pages live in a-*.js and load on demand.
import { initAdminI18n } from './a-i18n.js';
import { h, raw, $, $$, api, toast, fail, money, num, fmtDate, statusPill, pill, STATUS, PAYM, PAYST, openModal } from './a-core.js';

const root = document.getElementById('root');
let counts = {};
let token = 0;

const NAV = [
  ['#/', 'ড্যাশবোর্ড', 'dash'],
  ['#/orders', 'অর্ডার', 'orders', 'pendingOrders'],
  ['#/products', 'প্রোডাক্ট', 'products'],
  ['#/categories', 'ক্যাটাগরি', 'categories'],
  ['#/banners', 'ব্যানার', 'banners'],
  ['#/coupons', 'কুপন', 'coupons'],
  ['#/reviews', 'রিভিউ', 'reviews', 'pendingReviews'],
  ['#/messages', 'মেসেজ', 'messages', 'unreadMessages'],
  ['#/customers', 'কাস্টমার', 'customers'],
  ['#/pages', 'পেজ (পলিসি)', 'pages'],
  ['#/settings', 'সেটিংস', 'settings'],
];

function showLogin(msg = '') {
  root.innerHTML = h`<div class="login"><form class="card" data-login><h1>অ্যাডমিন লগইন</h1><p class="muted">সার্ভার চালু করার সময় cmd তে যে পাসওয়ার্ড দেখানো হয়েছিল সেটি দিন।</p>
<label class="f">পাসওয়ার্ড<input type="password" name="password" autocomplete="current-password" autofocus required></label>
${msg ? h`<p class="bad">${msg}</p>` : ''}<button class="btn btn-primary" style="width:100%">ঢুকুন</button></form></div>`.s;
  $('[data-login]').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/login', { method: 'POST', body: { password: e.target.password.value } });
      start();
    } catch (err) {
      showLogin(err.message);
    }
  });
}

function frame() {
  root.innerHTML = h`<div class="app"><aside class="side" id="side"><div class="brand">Trendzznow</div>
${NAV.map(([href, label, key, cnt]) => h`<a href="${href}" data-nav="${key}">${label}${cnt ? h`<span class="nb" data-cnt="${cnt}" hidden></span>` : ''}</a>`)}
<div class="sep"></div><a href="/" target="_blank" rel="noopener">স্টোর দেখুন ↗</a><a href="#" data-logout>লগআউট</a></aside>
<div><div class="top"><button class="menu" data-menu aria-label="মেনু">☰</button><b id="ttl"></b><span class="grow"></span><a class="btn sm" href="/" target="_blank" rel="noopener">স্টোর ↗</a></div><main class="main" id="main"></main></div></div>`.s;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu]')) {
      $('#side').classList.toggle('open');
      if ($('#side').classList.contains('open')) {
        const s = document.createElement('div');
        s.className = 'scrim';
        s.onclick = () => closeMenu();
        document.body.appendChild(s);
      } else closeMenu();
    }
    if (e.target.closest('#side a[data-nav]')) closeMenu();
    if (e.target.closest('[data-logout]')) {
      e.preventDefault();
      api('/logout', { method: 'POST' }).finally(() => showLogin());
    }
  });
}
function closeMenu() {
  $('#side') && $('#side').classList.remove('open');
  $$('.scrim').forEach((s) => s.remove());
}

async function refreshCounts() {
  try {
    const d = await api('/dashboard');
    counts = d;
    $$('[data-cnt]').forEach((b) => {
      const n = d[b.dataset.cnt] || 0;
      b.textContent = n;
      b.hidden = !n;
    });
    return d;
  } catch (e) {
    return null;
  }
}

const ROUTES = [
  [/^\/$/, 'dash', () => import('./a-dash.js')],
  [/^\/orders(?:\/(.+))?$/, 'orders', () => import('./a-orders.js')],
  [/^\/products(?:\/(.+))?$/, 'products', () => import('./a-catalog.js').then((m) => ({ render: m.renderProducts }))],
  [/^\/categories$/, 'categories', () => import('./a-catalog.js').then((m) => ({ render: m.renderCategories }))],
  [/^\/banners$/, 'banners', () => import('./a-catalog.js').then((m) => ({ render: m.renderBanners }))],
  [/^\/coupons$/, 'coupons', () => import('./a-catalog.js').then((m) => ({ render: m.renderCoupons }))],
  [/^\/reviews$/, 'reviews', () => import('./a-content.js').then((m) => ({ render: m.renderReviews }))],
  [/^\/messages$/, 'messages', () => import('./a-content.js').then((m) => ({ render: m.renderMessages }))],
  [/^\/customers$/, 'customers', () => import('./a-content.js').then((m) => ({ render: m.renderCustomers }))],
  [/^\/pages(?:\/(.+))?$/, 'pages', () => import('./a-content.js').then((m) => ({ render: m.renderPages }))],
  [/^\/settings(?:\/(.+))?$/, 'settings', () => import('./a-settings.js')],
];

async function route() {
  const my = ++token;
  const [path, qstr = ''] = (location.hash.replace(/^#/, '') || '/').split('?');
  const query = Object.fromEntries(new URLSearchParams(qstr));
  const main = $('#main');
  if (!main) return;
  let hit = null;
  for (const [re, key, load] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      hit = { key, load, m };
      break;
    }
  }
  $$('#side a[data-nav]').forEach((a) => a.classList.toggle('on', hit && a.dataset.nav === hit.key));
  const nav = hit && NAV.find((n) => n[2] === hit.key);
  $('#ttl').textContent = nav ? nav[1] : 'পাওয়া যায়নি';
  window.scrollTo(0, 0);
  if (!hit) {
    main.innerHTML = '<p>পেজটি পাওয়া যায়নি।</p>';
    return;
  }
  main.innerHTML = '<p class="muted">লোড হচ্ছে...</p>';
  try {
    const mod = await hit.load();
    if (my !== token) return;
    await mod.render(main, { query, param: hit.m[1] ? decodeURIComponent(hit.m[1]) : '', alive: () => my === token, refresh: refreshCounts });
  } catch (e) {
    if (my === token) main.innerHTML = h`<div class="alert">${e.message}</div><button class="btn" onclick="location.reload()">আবার চেষ্টা করুন</button>`.s;
  }
  refreshCounts();
}

async function start() {
  try {
    await api('/me');
  } catch (e) {
    return showLogin();
  }
  frame();
  window.addEventListener('hashchange', route);
  route();
}

window.addEventListener('tn-unauth', () => showLogin('আবার লগইন করুন।'));
initAdminI18n();
start();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
