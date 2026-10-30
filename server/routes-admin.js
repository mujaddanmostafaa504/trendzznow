'use strict';
const express = require('express');
const db = require('./db');
const U = require('./util');
const dom = require('./domain');
const push = require('./push');
const { FONTS } = require('./defaults');

const { wrap, HttpError } = U;
const api = express.Router();

const SESSION_MS = 14 * 86400000;
const loginLimit = U.rateLimit({ max: 8, windowMs: 15 * 60000, message: 'অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' });
const CORE_PAGES = ['about', 'contact', 'delivery-policy', 'return-policy', 'privacy', 'terms', 'faq'];

function sessionOk(req) {
  const tok = U.parseCookies(req).tn_admin;
  if (!tok) return false;
  const s = db.data.sessions && db.data.sessions[U.sha256(tok)];
  return !!(s && s.exp > Date.now());
}

function setSessionCookie(req, res, token, maxAgeMs) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `tn_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`);
}

function pruneSessions() {
  const t = Date.now();
  const s = db.data.sessions || {};
  Object.keys(s).forEach((k) => s[k].exp < t && delete s[k]);
}

api.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

api.post(
  '/login',
  loginLimit,
  wrap((req, res) => {
    if (!U.verifyPassword(String((req.body && req.body.password) || ''), db.data.admin && db.data.admin.passHash)) {
      throw new HttpError(401, 'bad_password', 'পাসওয়ার্ড ঠিক নেই।');
    }
    db.data.sessions = db.data.sessions || {};
    pruneSessions();
    const token = U.uid(24);
    db.data.sessions[U.sha256(token)] = { exp: Date.now() + SESSION_MS, created: U.nowIso() };
    db.save();
    setSessionCookie(req, res, token, SESSION_MS);
    res.json({ ok: true });
  })
);

// everything below needs a logged in admin
api.use((req, res, next) => {
  if (!sessionOk(req)) return res.status(401).json({ error: 'unauthorized', message: 'লগইন করুন।' });
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.get('x-tn-admin') !== '1') return res.status(403).json({ error: 'forbidden', message: 'অনুরোধটি গ্রহণ করা যায়নি।' });
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'forbidden', message: 'অনুরোধটি গ্রহণ করা যায়নি।' });
      } catch (e) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
  }
  next();
});

api.get('/me', (req, res) => res.json({ ok: true, siteName: db.data.settings.siteName }));

api.post('/logout', (req, res) => {
  const tok = U.parseCookies(req).tn_admin;
  if (tok && db.data.sessions) delete db.data.sessions[U.sha256(tok)];
  db.save();
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

api.post(
  '/password',
  wrap((req, res) => {
    const b = req.body || {};
    if (!U.verifyPassword(String(b.current || ''), db.data.admin.passHash)) throw new HttpError(400, 'bad_password', 'বর্তমান পাসওয়ার্ড ঠিক নেই।');
    const next = String(b.next || '');
    if (next.length < 8) throw new HttpError(400, 'weak_password', 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    db.data.admin.passHash = U.hashPassword(next);
    db.data.sessions = {};
    const token = U.uid(24);
    db.data.sessions[U.sha256(token)] = { exp: Date.now() + SESSION_MS, created: U.nowIso() };
    db.save();
    setSessionCookie(req, res, token, SESSION_MS);
    res.json({ ok: true });
  })
);

api.get('/dashboard', (req, res) => res.json(dom.dashboard()));

/* ---------------- orders ---------------- */

function dhakaDayStart(ymd) {
  return new Date(`${ymd}T00:00:00+06:00`).getTime();
}

function filterOrders(q) {
  let list = db.data.orders;
  if (q.status && q.status !== 'all') list = list.filter((o) => o.status === q.status);
  if (q.payment && q.payment !== 'all') list = list.filter((o) => o.payment.status === q.payment);
  if (q.source && q.source !== 'all') list = list.filter((o) => (o.source && o.source.label) === q.source);
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) list = list.filter((o) => new Date(o.createdAt).getTime() >= dhakaDayStart(q.from));
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) list = list.filter((o) => new Date(o.createdAt).getTime() < dhakaDayStart(q.to) + 86400000);
  const s = String(q.q || '').trim().toLowerCase();
  if (s) {
    list = list.filter(
      (o) =>
        o.number.toLowerCase().includes(s) ||
        o.customer.phone.includes(s.replace(/\D/g, '') || '§') ||
        o.customer.name.toLowerCase().includes(s) ||
        (o.payment.trxId || '').toLowerCase().includes(s) ||
        (o.courier.trackingId || '').toLowerCase().includes(s)
    );
  }
  return list;
}

function fullOrder(o) {
  const { sig, ...rest } = o;
  return rest;
}

api.get('/orders', (req, res) => {
  const list = filterOrders(req.query);
  const limit = U.clampInt(req.query.limit, 1, 100, 30);
  const pages = Math.max(1, Math.ceil(list.length / limit));
  const page = U.clampInt(req.query.page, 1, pages, 1);
  const counts = { all: db.data.orders.length };
  dom.STATUSES.forEach((s) => (counts[s] = db.data.orders.filter((o) => o.status === s).length));
  const sources = [...new Set(db.data.orders.map((o) => (o.source && o.source.label) || 'direct'))];
  res.json({ items: list.slice((page - 1) * limit, page * limit).map(dom.adminOrderRow), total: list.length, page, pages, counts, sources });
});

const orderCsvRows = (list) => {
  const head = ['Order', 'Date', 'Status', 'Name', 'Phone', 'District', 'Address', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Payment method', 'Payment status', 'TrxID', 'Courier', 'Tracking', 'Source'];
  const rows = list.map((o) => [
    o.number, o.createdAt.slice(0, 16).replace('T', ' '), o.status, o.customer.name, o.customer.phone, o.customer.district,
    `${o.customer.area ? o.customer.area + ', ' : ''}${o.customer.address}`,
    o.items.map((i) => `${i.name}${i.variantLabel ? ' (' + i.variantLabel + ')' : ''} x${i.qty}`).join('; '),
    o.subtotal, o.discount, o.shipping, o.total, o.payment.method, o.payment.status, o.payment.trxId, o.courier.name, o.courier.trackingId, (o.source && o.source.label) || '',
  ]);
  return [U.csvRow(head), ...rows.map(U.csvRow)].join('\r\n');
};

api.get('/orders.csv', (req, res) => {
  res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="orders.csv"').send('﻿' + orderCsvRows(filterOrders(req.query)));
});

// generic courier bulk sheet: Invoice, Name, Address, Phone, Amount (cash to collect), Note
api.get('/orders-courier.csv', (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean);
  let list = ids.length ? db.data.orders.filter((o) => ids.includes(o.id) || ids.includes(o.number)) : filterOrders({ ...req.query, status: req.query.status || 'confirmed' });
  const head = ['Invoice', 'Name', 'Address', 'Phone', 'Amount', 'Note'];
  const rows = list.map((o) => [
    o.number, o.customer.name, `${o.customer.area ? o.customer.area + ', ' : ''}${o.customer.address}, ${o.customer.district}`, o.customer.phone,
    o.payment.status === 'paid' ? 0 : o.total,
    o.items.map((i) => `${i.name}${i.variantLabel ? ' ' + i.variantLabel : ''} x${i.qty}`).join('; ') + (o.customer.note ? ` | ${o.customer.note}` : ''),
  ]);
  res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="courier-sheet.csv"').send('﻿' + [U.csvRow(head), ...rows.map(U.csvRow)].join('\r\n'));
});

function findOrder(idOrNumber) {
  const o = db.data.orders.find((x) => x.id === idOrNumber || x.number === idOrNumber);
  if (!o) throw new HttpError(404, 'not_found', 'অর্ডার পাওয়া যায়নি।');
  return o;
}

api.get('/orders/:id', (req, res) => res.json({ order: fullOrder(findOrder(req.params.id)) }));

api.post(
  '/orders',
  wrap((req, res) => {
    const { order } = dom.createOrder(req.body || {}, { admin: true, host: req.hostname });
    if (req.body && req.body.status && req.body.status !== 'pending') dom.setOrderStatus(order, req.body.status, 'ম্যানুয়াল অর্ডার', { notify: false });
    res.status(201).json({ order: fullOrder(order) });
  })
);

api.patch(
  '/orders/:id',
  wrap((req, res) => {
    const o = findOrder(req.params.id);
    const b = req.body || {};
    if (b.courier && typeof b.courier === 'object') {
      const url = U.str(b.courier.url, 300);
      o.courier = { name: U.str(b.courier.name, 40), trackingId: U.str(b.courier.trackingId, 60), url: /^https?:\/\//.test(url) ? url : '' };
    }
    if (b.payment && typeof b.payment === 'object') {
      if (['unpaid', 'paid', 'pending_verification', 'refunded', 'failed'].includes(b.payment.status)) {
        o.payment.status = b.payment.status;
        if (b.payment.status === 'paid') o.payment.paidAt = U.nowIso();
      }
    }
    if (typeof b.adminNote === 'string') o.adminNote = U.str(b.adminNote, 1000);
    if (b.customer && typeof b.customer === 'object') {
      const c = b.customer;
      if (c.name) o.customer.name = U.str(c.name, 80);
      if (c.phone) {
        const ph = U.normPhone(c.phone);
        if (!ph) throw new HttpError(400, 'phone_invalid', 'ফোন নম্বর ঠিক নেই।');
        o.customer.phone = ph;
      }
      if (c.district && dom.DISTRICTS.has(c.district)) {
        const d = dom.DISTRICTS.get(c.district);
        o.customer.district = d.en;
        o.customer.division = d.division;
      }
      if (typeof c.area === 'string') o.customer.area = U.str(c.area, 100);
      if (typeof c.address === 'string' && c.address.trim().length >= 5) o.customer.address = U.str(c.address, 300);
      if (typeof c.note === 'string') o.customer.note = U.str(c.note, 400);
    }
    if (b.status) dom.setOrderStatus(o, b.status, b.note, { notify: b.notify !== false });
    else if (b.note) o.timeline.push({ status: o.status, at: U.nowIso(), note: U.str(b.note, 300) });
    o.updatedAt = U.nowIso();
    db.save();
    res.json({ order: fullOrder(o) });
  })
);

api.post(
  '/orders/bulk',
  wrap((req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
    let n = 0;
    ids.forEach((id) => {
      const o = db.data.orders.find((x) => x.id === id);
      if (o && dom.setOrderStatus(o, req.body.status, req.body.note, { notify: req.body.notify !== false })) n++;
    });
    res.json({ ok: true, updated: n });
  })
);

api.delete('/orders/:id', (req, res) => {
  const o = findOrder(req.params.id);
  if (!dom.INACTIVE.has(o.status) && !o.demo) throw new HttpError(400, 'not_allowed', 'আগে অর্ডারটি বাতিল করুন, তারপর মুছুন।');
  if (o.stockApplied) dom.applyStock(o, +1);
  db.data.orders = db.data.orders.filter((x) => x.id !== o.id);
  db.save();
  res.json({ ok: true });
});

/* ---------------- products ---------------- */

function adminProduct(p) {
  const c = dom.categoryById(p.categoryId);
  return { ...p, totalStock: dom.totalStock(p), discount: dom.discountPct(p), categoryName: c ? c.name : '' };
}

api.get('/products', (req, res) => {
  let list = db.data.products;
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) list = list.filter((p) => `${p.name} ${p.brand} ${p.sku} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q));
  if (req.query.category && req.query.category !== 'all') list = list.filter((p) => p.categoryId === (req.query.category === 'none' ? '' : req.query.category));
  if (req.query.status && req.query.status !== 'all') list = list.filter((p) => p.status === req.query.status);
  if (req.query.stock === 'low') list = list.filter((p) => dom.totalStock(p) <= (db.data.settings.marketing.lowStockThreshold || 5));
  const sorters = {
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    stock: (a, b) => dom.totalStock(a) - dom.totalStock(b),
    sold: (a, b) => (b.sold || 0) - (a.sold || 0),
  };
  list = list.slice().sort(sorters[req.query.sort] || sorters.new);
  const limit = U.clampInt(req.query.limit, 1, 100, 30);
  const pages = Math.max(1, Math.ceil(list.length / limit));
  const page = U.clampInt(req.query.page, 1, pages, 1);
  res.json({ items: list.slice((page - 1) * limit, page * limit).map(adminProduct), total: list.length, page, pages });
});

api.get('/products/:id', (req, res) => {
  const p = dom.productById(req.params.id);
  if (!p) throw new HttpError(404, 'not_found', 'প্রোডাক্ট পাওয়া যায়নি।');
  res.json({ product: adminProduct(p) });
});

api.post(
  '/products',
  wrap((req, res) => {
    const base = dom.normalizeProductInput(req.body || {}, null);
    const t = U.nowIso();
    const p = { id: U.uid(5), ...base, ratingAvg: 0, ratingCount: 0, sold: 0, views: 0, demo: false, createdAt: t, updatedAt: t };
    db.data.products.unshift(p);
    db.save();
    res.status(201).json({ product: adminProduct(p) });
  })
);

api.put(
  '/products/:id',
  wrap((req, res) => {
    const p = dom.productById(req.params.id);
    if (!p) throw new HttpError(404, 'not_found', 'প্রোডাক্ট পাওয়া যায়নি।');
    const base = dom.normalizeProductInput(req.body || {}, p);
    Object.assign(p, base, { updatedAt: U.nowIso() });
    db.save();
    res.json({ product: adminProduct(p) });
  })
);

api.post(
  '/products/:id/duplicate',
  wrap((req, res) => {
    const p = dom.productById(req.params.id);
    if (!p) throw new HttpError(404, 'not_found', 'প্রোডাক্ট পাওয়া যায়নি।');
    const t = U.nowIso();
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = U.uid(5);
    copy.name = `${p.name} (কপি)`;
    copy.slug = U.uniqueSlug(db.data.products, p.slug, null);
    copy.status = 'draft';
    copy.sold = 0;
    copy.views = 0;
    copy.ratingAvg = 0;
    copy.ratingCount = 0;
    copy.demo = false;
    copy.createdAt = t;
    copy.updatedAt = t;
    db.data.products.unshift(copy);
    db.save();
    res.status(201).json({ product: adminProduct(copy) });
  })
);

api.post(
  '/products/bulk',
  wrap((req, res) => {
    const b = req.body || {};
    const ids = new Set(Array.isArray(b.ids) ? b.ids : []);
    const list = db.data.products.filter((p) => ids.has(p.id));
    if (b.action === 'delete') {
      db.data.products = db.data.products.filter((p) => !ids.has(p.id));
      db.data.reviews = db.data.reviews.filter((r) => !ids.has(r.productId));
    } else if (b.action === 'activate') list.forEach((p) => (p.status = 'active'));
    else if (b.action === 'draft') list.forEach((p) => (p.status = 'draft'));
    else if (b.action === 'feature') list.forEach((p) => (p.featured = true));
    else if (b.action === 'unfeature') list.forEach((p) => (p.featured = false));
    else if (b.action === 'category') list.forEach((p) => (p.categoryId = db.data.categories.some((c) => c.id === b.categoryId) ? b.categoryId : ''));
    else throw new HttpError(400, 'bad_action', 'অ্যাকশন ঠিক নেই।');
    list.forEach((p) => (p.updatedAt = U.nowIso()));
    db.save();
    res.json({ ok: true, count: list.length });
  })
);

api.delete('/products/:id', (req, res) => {
  const p = dom.productById(req.params.id);
  if (!p) throw new HttpError(404, 'not_found', 'প্রোডাক্ট পাওয়া যায়নি।');
  db.data.products = db.data.products.filter((x) => x.id !== p.id);
  db.data.reviews = db.data.reviews.filter((r) => r.productId !== p.id);
  db.save();
  res.json({ ok: true });
});

/* ---------------- categories ---------------- */

function catInput(b, existing) {
  const name = U.str(b.name, 60);
  if (!name) throw new HttpError(400, 'name_required', 'ক্যাটাগরির নাম লিখুন।');
  const img = U.str(b.image, 300);
  return {
    name,
    nameEn: U.str(b.nameEn, 60),
    slug: U.uniqueSlug(db.data.categories, U.slugify(b.slug || b.nameEn || (existing && existing.slug) || name, 'category'), existing && existing.id),
    image: dom.cleanImages([img], 1)[0] || '',
    active: b.active !== false,
    sort: U.clampInt(b.sort, 0, 9999, existing ? existing.sort : db.data.categories.length + 1),
  };
}

api.get('/categories', (req, res) =>
  res.json({
    items: db.data.categories
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...c, productCount: db.data.products.filter((p) => p.categoryId === c.id).length })),
  })
);
api.post('/categories', wrap((req, res) => {
  const c = { id: U.uid(4), ...catInput(req.body || {}, null), demo: false };
  db.data.categories.push(c);
  db.save();
  res.status(201).json({ category: c });
}));
api.put('/categories/:id', wrap((req, res) => {
  const c = dom.categoryById(req.params.id);
  if (!c) throw new HttpError(404, 'not_found', 'ক্যাটাগরি পাওয়া যায়নি।');
  Object.assign(c, catInput(req.body || {}, c));
  db.save();
  res.json({ category: c });
}));
api.delete('/categories/:id', (req, res) => {
  db.data.products.forEach((p) => p.categoryId === req.params.id && (p.categoryId = ''));
  db.data.categories = db.data.categories.filter((c) => c.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

/* ---------------- banners ---------------- */

function linkOk(l) {
  l = String(l || '').trim();
  return /^(\/[^\s]*|https?:\/\/[^\s"'<>]+)$/.test(l) && !/^\/\//.test(l) ? l : '';
}

function bannerInput(b, existing) {
  const image = dom.cleanImages([b.image], 1)[0];
  if (!image) throw new HttpError(400, 'image_required', 'ব্যানারের ছবি দিন।');
  return {
    title: U.str(b.title, 120),
    subtitle: U.str(b.subtitle, 240),
    buttonText: U.str(b.buttonText, 40),
    link: linkOk(b.link),
    image,
    mobileImage: dom.cleanImages([b.mobileImage], 1)[0] || '',
    textTheme: b.textTheme === 'dark' ? 'dark' : 'light',
    align: ['left', 'center', 'right'].includes(b.align) ? b.align : 'left',
    showText: b.showText !== false,
    active: b.active !== false,
    sort: U.clampInt(b.sort, 0, 9999, existing ? existing.sort : db.data.banners.length + 1),
  };
}

api.get('/banners', (req, res) => res.json({ items: db.data.banners.slice().sort((a, b) => a.sort - b.sort) }));
api.post('/banners', wrap((req, res) => {
  const b = { id: U.uid(4), ...bannerInput(req.body || {}, null), demo: false };
  db.data.banners.push(b);
  db.save();
  res.status(201).json({ banner: b });
}));
api.put('/banners/:id', wrap((req, res) => {
  const b = db.data.banners.find((x) => x.id === req.params.id);
  if (!b) throw new HttpError(404, 'not_found', 'ব্যানার পাওয়া যায়নি।');
  Object.assign(b, bannerInput(req.body || {}, b));
  db.save();
  res.json({ banner: b });
}));
api.post('/banners/reorder', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  ids.forEach((id, i) => {
    const b = db.data.banners.find((x) => x.id === id);
    if (b) b.sort = i + 1;
  });
  db.save();
  res.json({ ok: true });
});
api.delete('/banners/:id', (req, res) => {
  db.data.banners = db.data.banners.filter((b) => b.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

/* ---------------- coupons ---------------- */

function couponInput(b, existing) {
  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  if (code.length < 3) throw new HttpError(400, 'code_required', 'কুপন কোড কমপক্ষে ৩ অক্ষরের হতে হবে (ইংরেজি অক্ষর ও সংখ্যা)।');
  if (db.data.coupons.some((c) => c.code.toUpperCase() === code && (!existing || c.id !== existing.id))) throw new HttpError(400, 'code_exists', 'এই কোড আগেই আছে।');
  const type = ['percent', 'fixed', 'freeship'].includes(b.type) ? b.type : 'percent';
  const value = U.num(b.value, 0);
  if (type !== 'freeship' && !(value > 0)) throw new HttpError(400, 'value_required', 'ছাড়ের পরিমাণ দিন।');
  if (type === 'percent' && value > 100) throw new HttpError(400, 'value_invalid', 'শতাংশ ১০০ এর বেশি হতে পারে না।');
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  return {
    code,
    type,
    value: type === 'freeship' ? 0 : value,
    minOrder: Math.max(0, U.num(b.minOrder, 0)),
    maxDiscount: Math.max(0, U.num(b.maxDiscount, 0)),
    usageLimit: Math.max(0, U.clampInt(b.usageLimit, 0, 1e7, 0)),
    startsAt: date(b.startsAt),
    endsAt: date(b.endsAt),
    active: b.active !== false,
  };
}

api.get('/coupons', (req, res) => res.json({ items: db.data.coupons }));
api.post('/coupons', wrap((req, res) => {
  const c = { id: U.uid(4), ...couponInput(req.body || {}, null), used: 0, demo: false, createdAt: U.nowIso() };
  db.data.coupons.unshift(c);
  db.save();
  res.status(201).json({ coupon: c });
}));
api.put('/coupons/:id', wrap((req, res) => {
  const c = db.data.coupons.find((x) => x.id === req.params.id);
  if (!c) throw new HttpError(404, 'not_found', 'কুপন পাওয়া যায়নি।');
  Object.assign(c, couponInput(req.body || {}, c));
  db.save();
  res.json({ coupon: c });
}));
api.delete('/coupons/:id', (req, res) => {
  db.data.coupons = db.data.coupons.filter((c) => c.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

/* ---------------- reviews ---------------- */

api.get('/reviews', (req, res) => {
  let list = db.data.reviews;
  if (req.query.status && req.query.status !== 'all') list = list.filter((r) => r.status === req.query.status);
  const counts = { all: db.data.reviews.length };
  ['pending', 'approved', 'rejected'].forEach((s) => (counts[s] = db.data.reviews.filter((r) => r.status === s).length));
  res.json({
    counts,
    items: list.slice(0, 200).map((r) => {
      const p = dom.productById(r.productId);
      return { ...r, productName: p ? p.name : '(মুছে ফেলা প্রোডাক্ট)', productImage: p ? p.images[0] || '' : '', productSlug: p ? p.slug : '' };
    }),
  });
});
api.patch('/reviews/:id', (req, res) => {
  const r = db.data.reviews.find((x) => x.id === req.params.id);
  if (!r) throw new HttpError(404, 'not_found', 'রিভিউ পাওয়া যায়নি।');
  if (['pending', 'approved', 'rejected'].includes(req.body && req.body.status)) r.status = req.body.status;
  dom.recalcRating(r.productId);
  db.save();
  res.json({ review: r });
});
api.delete('/reviews/:id', (req, res) => {
  const r = db.data.reviews.find((x) => x.id === req.params.id);
  db.data.reviews = db.data.reviews.filter((x) => x.id !== req.params.id);
  if (r) dom.recalcRating(r.productId);
  db.save();
  res.json({ ok: true });
});

/* ---------------- pages ---------------- */

api.get('/pages', (req, res) => res.json({ items: db.data.pages, core: CORE_PAGES }));
api.put('/pages/:slug', wrap((req, res) => {
  const pg = db.data.pages.find((x) => x.slug === req.params.slug);
  if (!pg) throw new HttpError(404, 'not_found', 'পেজ পাওয়া যায়নি।');
  const b = req.body || {};
  const title = U.str(b.title, 120);
  if (!title) throw new HttpError(400, 'title_required', 'পেজের শিরোনাম দিন।');
  pg.title = title;
  pg.titleEn = U.str(b.titleEn, 120);
  pg.body = String(b.body || '').slice(0, 30000);
  pg.bodyEn = String(b.bodyEn || '').slice(0, 30000);
  pg.updatedAt = U.nowIso();
  db.save();
  res.json({ page: pg });
}));
api.post('/pages', wrap((req, res) => {
  const b = req.body || {};
  const title = U.str(b.title, 120);
  if (!title) throw new HttpError(400, 'title_required', 'পেজের শিরোনাম দিন।');
  const slug = U.uniqueSlug(db.data.pages, U.slugify(b.slug || b.titleEn || title, 'page'), null);
  const pg = { slug, title, titleEn: U.str(b.titleEn, 120), body: String(b.body || '').slice(0, 30000), bodyEn: String(b.bodyEn || '').slice(0, 30000), updatedAt: U.nowIso() };
  db.data.pages.push(pg);
  db.save();
  res.status(201).json({ page: pg });
}));
api.delete('/pages/:slug', (req, res) => {
  if (CORE_PAGES.includes(req.params.slug)) throw new HttpError(400, 'not_allowed', 'এই পেজটি মোছা যাবে না, শুধু এডিট করা যাবে।');
  db.data.pages = db.data.pages.filter((p) => p.slug !== req.params.slug);
  db.save();
  res.json({ ok: true });
});

/* ---------------- messages, customers ---------------- */

api.get('/messages', (req, res) => res.json({ items: db.data.messages, unread: db.data.messages.filter((m) => !m.read).length }));
api.patch('/messages/:id', (req, res) => {
  const m = db.data.messages.find((x) => x.id === req.params.id);
  if (m) m.read = req.body && req.body.read !== false;
  db.save();
  res.json({ ok: true });
});
api.delete('/messages/:id', (req, res) => {
  db.data.messages = db.data.messages.filter((m) => m.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

api.get('/customers', (req, res) => res.json({ items: dom.customersList() }));
api.post('/customers/block', (req, res) => {
  const phone = U.normPhone(req.body && req.body.phone);
  if (!phone) throw new HttpError(400, 'phone_invalid', 'ফোন নম্বর ঠিক নেই।');
  db.data.blocked = db.data.blocked || { phones: [] };
  const set = new Set(db.data.blocked.phones);
  if (req.body.blocked === false) set.delete(phone);
  else set.add(phone);
  db.data.blocked.phones = [...set];
  db.save();
  res.json({ ok: true, blocked: db.data.blocked.phones });
});

/* ---------------- settings, upload, push, data ---------------- */

api.get('/settings', (req, res) => res.json({ settings: dom.adminSettings(), fonts: Object.keys(FONTS), districts: dom.geo }));
api.put('/settings', wrap((req, res) => {
  dom.updateSettings(req.body && req.body.settings ? req.body.settings : req.body || {});
  res.json({ settings: dom.adminSettings() });
}));

api.post('/upload', wrap((req, res) => {
  const url = U.saveDataUrlImage(req.body && req.body.dataUrl, db.UPLOADS, { maxBytes: 6 * 1024 * 1024 });
  res.status(201).json({ url });
}));

api.get('/push/stats', (req, res) => res.json(push.stats()));
api.get('/push/key', (req, res) => res.json({ key: push.publicKey() }));
api.post('/push/subscribe', wrap((req, res) => {
  const sub = push.addSub({ subscription: req.body && req.body.subscription, role: 'admin', lang: 'bn' });
  if (!sub) throw new HttpError(400, 'bad_subscription', 'সাবস্ক্রিপশন ঠিক নেই।');
  res.json({ ok: true });
}));
api.post('/push/unsubscribe', (req, res) => {
  if (req.body && req.body.endpoint) push.removeSub(String(req.body.endpoint));
  res.json({ ok: true });
});
api.post('/push/test', wrap(async (req, res) => {
  const r = await push.notifyAdmins({ title: db.data.settings.siteName, body: 'এই ডিভাইসে নোটিফিকেশন ঠিকমতো চালু আছে।', url: '/admin/', tag: 'test' });
  res.json(r);
}));
api.post('/push/broadcast', wrap(async (req, res) => {
  const b = req.body || {};
  const title = U.str(b.title, 80);
  const body = U.str(b.body, 200);
  if (!title || !body) throw new HttpError(400, 'text_required', 'শিরোনাম ও মেসেজ লিখুন।');
  const url = linkOk(b.url) || '/';
  const r = await push.broadcast({ title, body, url, tag: 'campaign' });
  res.json(r);
}));

api.get('/export.json', (req, res) => {
  const { sessions, admin, push: pk, pushSubs, ...rest } = db.data;
  res.set('Content-Disposition', `attachment; filename="trendzznow-data-${new Date().toISOString().slice(0, 10)}.json"`).type('application/json').send(JSON.stringify(rest, null, 1));
});

api.post('/demo/delete', (req, res) => {
  const d = db.data;
  const counts = {
    products: d.products.filter((p) => p.demo).length,
    banners: d.banners.filter((b) => b.demo).length,
    categories: d.categories.filter((c) => c.demo).length,
    coupons: d.coupons.filter((c) => c.demo).length,
    orders: d.orders.filter((o) => o.demo).length,
  };
  const demoIds = new Set(d.products.filter((p) => p.demo).map((p) => p.id));
  d.products = d.products.filter((p) => !p.demo);
  d.reviews = d.reviews.filter((r) => !demoIds.has(r.productId));
  d.banners = d.banners.filter((b) => !b.demo);
  d.categories = d.categories.filter((c) => !c.demo);
  d.coupons = d.coupons.filter((c) => !c.demo);
  d.orders = d.orders.filter((o) => !o.demo);
  d.products.forEach((p) => d.categories.some((c) => c.id === p.categoryId) || (p.categoryId = ''));
  d.meta.demoDeleted = true;
  db.save();
  res.json({ ok: true, counts });
});

api.use((req, res) => res.status(404).json({ error: 'not_found', message: 'পাওয়া যায়নি।' }));

/* ---------------- printable invoice ---------------- */

const E = U.escapeHtml;
function invoiceHtml(o) {
  const S = db.data.settings;
  const due = o.payment.status === 'paid' ? 0 : o.total;
  const rows = o.items
    .map((i) => `<tr><td>${E(i.name)}${i.variantLabel ? `<br><small>${E(i.variantLabel)}</small>` : ''}</td><td class="r">${i.qty}</td><td class="r">৳${i.unitPrice}</td><td class="r">৳${i.unitPrice * i.qty}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>Invoice ${E(o.number)}</title>
<style>*{box-sizing:border-box}body{font-family:"Hind Siliguri","Nirmala UI",system-ui,sans-serif;margin:0;padding:24px;color:#17142e;font-size:14px}
.wrap{max-width:760px;margin:0 auto}h1{margin:0;font-size:26px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #17142e;padding-bottom:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f3f2f8}.r{text-align:right}small{color:#666}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}.tot td{border:0;padding:3px 8px}.big{font-size:18px;font-weight:700}.box{border:2px dashed #17142e;padding:10px 14px;margin-top:16px;font-size:16px}
.no-print{margin-bottom:16px}@media print{.no-print{display:none}body{padding:0}}</style></head><body><div class="wrap">
<div class="no-print"><button onclick="window.print()">প্রিন্ট করুন</button></div>
<div class="top"><div><h1>${E(S.siteName)}</h1><div>${E(S.contact.phone)}${S.contact.email ? ' | ' + E(S.contact.email) : ''}</div><div>${E((S.contact.address && S.contact.address.bn) || '')}</div>${S.legal.tradeLicense ? `<small>ট্রেড লাইসেন্স: ${E(S.legal.tradeLicense)}</small>` : ''}${S.legal.bin ? `<small> | BIN: ${E(S.legal.bin)}</small>` : ''}</div>
<div class="r"><div class="big">ইনভয়েস ${E(o.number)}</div><div>${E(o.createdAt.slice(0, 10))}</div></div></div>
<div class="two"><div><b>প্রাপক</b><br>${E(o.customer.name)}<br>${E(o.customer.phone)}<br>${E(o.customer.area ? o.customer.area + ', ' : '')}${E(o.customer.address)}<br>${E(o.customer.district)}</div>
<div><b>পেমেন্ট</b><br>${E(o.payment.method.toUpperCase())} (${E(o.payment.status)})${o.payment.trxId ? `<br>TrxID: ${E(o.payment.trxId)}` : ''}${o.courier.name ? `<br><b>কুরিয়ার:</b> ${E(o.courier.name)} ${E(o.courier.trackingId)}` : ''}${o.customer.note ? `<br><b>নোট:</b> ${E(o.customer.note)}` : ''}</div></div>
<table><thead><tr><th>পণ্য</th><th class="r">পরিমাণ</th><th class="r">দাম</th><th class="r">মোট</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot" style="width:280px;margin-left:auto"><tr><td>সাবটোটাল</td><td class="r">৳${o.subtotal}</td></tr>${o.discount ? `<tr><td>ছাড় ${E(o.couponCode)}</td><td class="r">−৳${o.discount}</td></tr>` : ''}<tr><td>ডেলিভারি চার্জ</td><td class="r">৳${o.shipping}</td></tr><tr class="big"><td>সর্বমোট</td><td class="r">৳${o.total}</td></tr></table>
<div class="box">কুরিয়ারকে দিতে হবে (COD): <b>৳${due}</b></div>
<p style="text-align:center;color:#666;margin-top:24px">ধন্যবাদ, ${E(S.siteName)} থেকে কেনাকাটা করার জন্য।</p></div></body></html>`;
}

function invoicePage(req, res) {
  if (!sessionOk(req)) return res.redirect('/admin/');
  const o = db.data.orders.find((x) => x.number === req.params.number || x.id === req.params.number);
  if (!o) return res.status(404).send('Order not found');
  res.set('Cache-Control', 'no-store').type('html').send(invoiceHtml(o));
}

module.exports = { api, invoicePage, sessionOk };
