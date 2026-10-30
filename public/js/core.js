// Shared state and helpers: storage, API, cart, wishlist, compare, tracking, push.
import { t, getLang, setLangState } from './i18n.js';

export const BOOT = window.__BOOT__ || {};
export const S = BOOT.settings || {};
export const CATS = BOOT.categories || [];
export const BANNERS = BOOT.banners || [];
export const PAGES = BOOT.pages || [];

/* ---------------- tiny event bus ---------------- */
const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => {
  const f = (e) => fn(e.detail);
  bus.addEventListener(name, f);
  return () => bus.removeEventListener(name, f);
};

/* ---------------- storage (never throws) ---------------- */
const mk = (store) => ({
  get(k, d) {
    try {
      const v = store.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      store.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* private mode, full disk */
    }
  },
  del(k) {
    try {
      store.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  },
});
export const ls = mk(localStorage);
export const ss = mk(sessionStorage);

/* ---------------- helpers ---------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function debounce(fn, ms) {
  let tm;
  return (...a) => {
    clearTimeout(tm);
    tm = setTimeout(() => fn(...a), ms);
  };
}

const nf = new Intl.NumberFormat('en-IN');
export const money = (n) => '৳' + nf.format(Math.round(Number(n) || 0));
export const num = (n) => nf.format(Number(n) || 0);

export function fmtDate(iso, withTime = false) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const loc = getLang() === 'bn' ? 'bn-BD' : 'en-GB';
  const opt = withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleString(loc, opt);
}

export function ago(minutes) {
  if (minutes < 60) return t('ago_min', { n: minutes });
  if (minutes < 1440) return t('ago_hour', { n: Math.round(minutes / 60) });
  return t('ago_day', { n: Math.round(minutes / 1440) });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {
      /* ignore */
    }
    ta.remove();
    return ok;
  }
}

// whatsapp / phone helpers: Bangladeshi numbers to international format
export function intlNumber(n) {
  let d = String(n || '').replace(/[^\d]/g, '');
  if (d.startsWith('880')) return d;
  if (d.startsWith('0')) return '88' + d;
  return d;
}
export const waLink = (text) => `https://wa.me/${intlNumber(S.contact && (S.contact.whatsapp || S.contact.phone))}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const messengerLink = () => (S.contact && S.contact.messenger ? `https://m.me/${encodeURIComponent(S.contact.messenger)}` : '');

export function normPhone(p) {
  let s = String(p || '')
    .replace(/[\s\-().]/g, '')
    .replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  if (s.startsWith('+88')) s = s.slice(3);
  else if (s.startsWith('88') && s.length === 13) s = s.slice(2);
  return /^01[3-9]\d{8}$/.test(s) ? s : '';
}

// resize and compress a photo in the browser before upload
export function fileToDataUrl(file, { max = 1200, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('not_image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad_image'));
    };
    img.src = url;
  });
}

/* ---------------- API ---------------- */
export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || t('err_generic'));
    this.status = status;
    this.code = body && body.error;
    this.data = body || {};
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError(0, { error: 'network', message: t('err_network') });
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== '' && v != null && v !== false && v !== 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/* ---------------- theme & language ---------------- */
export const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
export function setTheme(v) {
  document.documentElement.setAttribute('data-theme', v);
  try {
    localStorage.setItem('tn_theme', v);
  } catch (e) {
    /* ignore */
  }
  emit('theme', v);
}
export function setLang(l) {
  setLangState(l);
  document.documentElement.lang = l;
  try {
    localStorage.setItem('tn_lang', l);
  } catch (e) {
    /* ignore */
  }
  emit('lang', l);
}

/* ---------------- cart ---------------- */
const CART_KEY = 'tn_cart';
const itemKey = (x) => `${x.pid}|${x.vk || ''}`;

export const cart = {
  items: ls.get(CART_KEY, []),
  save() {
    ls.set(CART_KEY, this.items);
    emit('cart');
  },
  count() {
    return this.items.reduce((a, i) => a + i.qty, 0);
  },
  total() {
    return this.items.reduce((a, i) => a + i.qty * i.price, 0);
  },
  add(it, qty = 1) {
    const found = this.items.find((x) => itemKey(x) === itemKey({ pid: it.pid, vk: it.vk }));
    if (found) {
      found.qty = Math.min(99, found.qty + qty);
      Object.assign(found, { price: it.price, name: it.name, image: it.image, vlabel: it.vlabel || '' });
    } else {
      this.items.push({ pid: it.pid, vk: it.vk || '', qty: Math.min(99, qty), name: it.name, image: it.image, price: it.price, slug: it.slug, vlabel: it.vlabel || '' });
    }
    this.save();
  },
  setQty(i, qty) {
    if (!this.items[i]) return;
    if (qty <= 0) this.items.splice(i, 1);
    else this.items[i].qty = Math.min(99, qty);
    this.save();
  },
  remove(i) {
    this.items.splice(i, 1);
    this.save();
  },
  clear() {
    this.items = [];
    this.save();
  },
  reload() {
    this.items = ls.get(CART_KEY, []);
    emit('cart');
  },
};

/* ---------------- wishlist, compare, recently viewed ---------------- */
function idList(key, max) {
  return {
    list: ls.get(key, []),
    has(id) {
      return this.list.includes(id);
    },
    toggle(id) {
      const had = this.has(id);
      if (had) this.list = this.list.filter((x) => x !== id);
      else {
        if (max && this.list.length >= max) return null;
        this.list = [...this.list, id];
      }
      ls.set(key, this.list);
      emit(key);
      return !had;
    },
    remove(id) {
      this.list = this.list.filter((x) => x !== id);
      ls.set(key, this.list);
      emit(key);
    },
    clear() {
      this.list = [];
      ls.set(key, this.list);
      emit(key);
    },
    reload() {
      this.list = ls.get(key, []);
      emit(key);
    },
  };
}
export const wish = idList('tn_wish', 200);
export const compare = idList('tn_compare', 3);
export const COMPARE_MAX = 3;

export const recent = {
  list: ls.get('tn_recent', []),
  push(id) {
    this.list = [id, ...this.list.filter((x) => x !== id)].slice(0, 14);
    ls.set('tn_recent', this.list);
  },
};

export const myOrders = {
  list: () => ls.get('tn_orders', []),
  add(number, phone) {
    const l = this.list().filter((o) => o.number !== number);
    l.unshift({ number, phone, at: Date.now() });
    ls.set('tn_orders', l.slice(0, 20));
  },
};

export const customer = {
  get: () => ls.get('tn_customer', {}),
  set: (c) => ls.set('tn_customer', c),
  clear: () => ls.del('tn_customer'),
};

window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) cart.reload();
  if (e.key === 'tn_wish') wish.reload();
  if (e.key === 'tn_compare') compare.reload();
});

/* ---------------- where did the visitor come from ---------------- */
export function captureSource() {
  const q = new URLSearchParams(location.search);
  const found = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ttclid', 'gclid'].forEach((k) => {
    const v = q.get(k);
    if (v) found[k] = v.slice(0, 100);
  });
  let ref = document.referrer || '';
  try {
    if (ref && new URL(ref).host === location.host) ref = '';
  } catch (e) {
    ref = '';
  }
  const prev = ls.get('tn_src', null);
  const stale = !prev || Date.now() - prev.ts > 7 * 86400000;
  if (Object.keys(found).length || stale) ls.set('tn_src', { ...found, referrer: ref.slice(0, 200), landing: (location.pathname + location.search).slice(0, 200), ts: Date.now() });
}
export function getSource() {
  const s = ls.get('tn_src', {});
  const { ts, ...rest } = s;
  return rest;
}

/* ---------------- ad pixels (Meta, TikTok, Google) ---------------- */
// p: { ids:[], name, value, qty, group:boolean, contents:[{id,qty,price,name}], query, eventId }
export function track(ev, p = {}) {
  try {
    const value = Number(p.value) || 0;
    const contents = (p.contents || []).map((c) => ({ id: c.id, quantity: c.qty || 1, item_price: c.price }));
    if (window.fbq) {
      const params = { currency: 'BDT' };
      if (p.ids) params.content_ids = p.ids;
      if (p.ids) params.content_type = p.group ? 'product_group' : 'product';
      if (p.name) params.content_name = p.name;
      if (value) params.value = value;
      if (contents.length) {
        params.contents = contents;
        params.num_items = contents.reduce((a, c) => a + c.quantity, 0);
      }
      if (p.query) params.search_string = p.query;
      window.fbq('track', ev, params, p.eventId ? { eventID: p.eventId } : undefined);
    }
    if (window.ttq) {
      const map = { Purchase: 'CompletePayment' };
      const params = { currency: 'BDT' };
      if (value) params.value = value;
      if (p.name) params.content_name = p.name;
      if (p.ids) {
        params.content_type = 'product';
        params.contents = (p.contents && p.contents.length ? p.contents : p.ids.map((id) => ({ id, qty: 1 }))).map((c) => ({ content_id: c.id, content_type: 'product', content_name: c.name || p.name || '', quantity: c.qty || 1, price: c.price }));
      }
      if (p.query) params.query = p.query;
      window.ttq.track(map[ev] || ev, params);
    }
    if (window.gtag) {
      const gmap = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase', Search: 'search', AddToWishlist: 'add_to_wishlist' };
      if (gmap[ev]) {
        const g = { currency: 'BDT' };
        if (value) g.value = value;
        if (contents.length) g.items = contents.map((c, i) => ({ item_id: c.id, item_name: (p.contents[i] && p.contents[i].name) || p.name || '', price: c.item_price, quantity: c.quantity }));
        else if (p.ids) g.items = p.ids.map((id) => ({ item_id: id, item_name: p.name || '', price: value, quantity: 1 }));
        if (p.query) g.search_term = p.query;
        if (ev === 'Purchase' && p.eventId) g.transaction_id = p.eventId;
        window.gtag('event', gmap[ev], g);
      }
    }
  } catch (e) {
    /* tracking must never break the shop */
  }
}

let firstView = true;
export function trackPageView() {
  if (firstView) {
    firstView = false; // the snippets in <head> already counted this one
    return;
  }
  try {
    if (window.fbq) window.fbq('track', 'PageView');
    if (window.ttq) window.ttq.page();
    if (window.gtag) window.gtag('event', 'page_view', { page_path: location.pathname });
  } catch (e) {
    /* ignore */
  }
}

/* ---------------- web push ---------------- */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!BOOT.vapid;

function b64ToU8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch (e) {
    return 'unsupported';
  }
}

export async function enablePush(orderNumber) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(BOOT.vapid) });
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), order: orderNumber || undefined, lang: getLang() } });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
}

/* ---------------- add to home screen ---------------- */
export const pwa = { prompt: null };
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

/* ---------------- misc ---------------- */
export function sessionId() {
  let id = ss.get('tn_sid', '');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    ss.set('tn_sid', id);
  }
  return id;
}

export const tr = (obj) => (obj && typeof obj === 'object' ? obj[getLang()] || obj.bn || obj.en || '' : obj || '');
export const catName = (c) => (getLang() === 'en' && c && c.nameEn ? c.nameEn : (c && c.name) || '');
