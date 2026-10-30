// Entry point: builds the page frame, runs the router, wires the service worker and install prompt.
import { h, esc } from './h.js';
import { t, getLang } from './i18n.js';
import { S, $, on, captureSource, trackPageView, pwa } from './core.js';
import { emptyState, toast } from './ui.js';
import { setRouteHandler, navigate } from './router.js';
import { mountChrome, initChrome, startLive, maybeShowInstallBar, setActiveNav } from './chrome.js';
import { renderHome } from './home.js';
import { renderShop, renderCategories } from './shop.js';
import { renderProduct } from './product.js';
import { renderCart, renderCheckout } from './cart.js';
import { renderOrder, renderTrack } from './order.js';
import { renderPage, renderAccount, renderWishlist, renderCompare } from './misc.js';

const root = document.getElementById('app');
root.innerHTML = `<a class="skip" href="#main" id="skip">${esc(t('skip_to_content'))}</a>
<header id="hd" class="hd"></header>
<main id="main" tabindex="-1"></main>
<footer id="ft" class="ft"></footer>
<nav id="bn" class="bn" aria-label="${esc(t('nav_main'))}"></nav>
<div id="live" class="live" aria-live="polite"></div>
<div id="cmp-tray" class="cmp-tray"></div>
<div id="chat"></div>
<div id="instbar"></div>`;

const ROUTES = [
  [/^\/$/, 'home', (c) => renderHome(c)],
  [/^\/(?:shop|search)$/, 'shop', (c) => renderShop(c, {})],
  [/^\/categories$/, 'categories', (c) => renderCategories(c)],
  [/^\/c\/([^/]+)$/, 'shop', (c, m) => renderShop(c, { cat: decodeURIComponent(m[1]) })],
  [/^\/p\/([^/]+)$/, 'product', (c, m) => renderProduct(c, m)],
  [/^\/page\/([^/]+)$/, 'page', (c, m) => renderPage(c, m)],
  [/^\/cart$/, 'cart', (c) => renderCart(c)],
  [/^\/checkout$/, 'checkout', (c) => renderCheckout(c)],
  [/^\/track$/, 'track', (c) => renderTrack(c)],
  [/^\/account$/, 'account', (c) => renderAccount(c)],
  [/^\/wishlist$/, 'wishlist', (c) => renderWishlist(c)],
  [/^\/compare$/, 'compare', (c) => renderCompare(c)],
  [/^\/order\/([^/]+)$/, 'order', (c, m) => renderOrder(c, m)],
];

let token = 0;
let cleanups = [];
const main = $('#main');

function runCleanups() {
  const list = cleanups;
  cleanups = [];
  list.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* a page's cleanup must not stop navigation */
    }
  });
}

function showError(ctx, e) {
  ctx.el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), (e && e.message) || t('err_generic'), h`<button type="button" class="btn btn-primary" data-act="reload">${t('retry')}</button>`)}</section>`.s;
}

function notFound(ctx) {
  ctx.setTitle(`${t('not_found')} | ${S.siteName}`);
  ctx.el.innerHTML = h`<section class="wrap sec">${emptyState(t('not_found'), t('not_found_sub'), h`<a class="btn btn-primary" href="/">${t('go_home')}</a>`)}</section>`.s;
}

async function route({ push = false, keepScroll = false } = {}) {
  const my = ++token;
  runCleanups();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let hit = null;
  for (const [re, page, fn] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      hit = { page, fn, m };
      break;
    }
  }
  const ctx = {
    el: main,
    alive: () => token === my,
    setTitle: (title) => {
      document.title = title;
    },
    listen(target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      cleanups.push(() => target.removeEventListener(ev, fn, opts));
    },
    cleanup(fn) {
      cleanups.push(fn);
    },
  };
  document.body.dataset.page = hit ? hit.page : 'none';
  document.body.classList.remove('has-sticky', 'no-live');
  setActiveNav(path);
  if (push && !keepScroll) window.scrollTo(0, 0);
  trackPageView();
  try {
    if (hit) await hit.fn(ctx, hit.m);
    else notFound(ctx);
  } catch (e) {
    if (ctx.alive()) showError(ctx, e);
  }
  if (!ctx.alive()) return;
  if (!push && history.state && typeof history.state.y === 'number') window.scrollTo(0, history.state.y);
  if (push && !keepScroll) main.focus({ preventScroll: true });
}

setRouteHandler((o) => route(o));
window.addEventListener('popstate', () => route({ push: false }));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// remember where the visitor was on this history entry
let scrollTimer;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    try {
      history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
    } catch (e) {
      /* ignore */
    }
  }, 180);
}, { passive: true });

// turn same-site links into app navigation
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.native != null) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  let u;
  try {
    u = new URL(a.href, location.href);
  } catch (err) {
    return;
  }
  if (u.origin !== location.origin) return;
  if (/^\/(admin|api|feed|uploads|sitemap|robots|manifest|sw\.js)/.test(u.pathname)) return;
  e.preventDefault();
  navigate(u.pathname + u.search + u.hash);
});

// small global actions that belong to the frame
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act="reload"]');
  if (b) location.reload();
});

on('lang', () => {
  const sk = $('#skip');
  if (sk) sk.textContent = t('skip_to_content');
  const bn = $('#bn');
  if (bn) bn.setAttribute('aria-label', t('nav_main'));
  mountChrome();
  route({ push: false, keepScroll: true });
});

/* ---------------- start ---------------- */
document.documentElement.lang = getLang();
initChrome();
mountChrome();
captureSource();
route({ push: false });
startLive();

/* ---------------- service worker and install prompt ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwa.prompt = e;
  setTimeout(maybeShowInstallBar, 12000);
});
window.addEventListener('appinstalled', () => {
  pwa.prompt = null;
  const bar = $('#instbar');
  if (bar) bar.innerHTML = '';
  toast(t('install_done'));
});
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setTimeout(maybeShowInstallBar, 20000);
