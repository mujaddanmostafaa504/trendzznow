'use strict';
const express = require('express');
const db = require('./db');
const U = require('./util');
const dom = require('./domain');
const push = require('./push');

const { wrap, HttpError } = U;
const router = express.Router();

const orderLimit = U.rateLimit({ max: 15, windowMs: 3600000, message: 'অনেকবার অর্ডার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা আমাদের ফোন করুন।' });
const reviewLimit = U.rateLimit({ max: 8, windowMs: 3600000 });
const contactLimit = U.rateLimit({ max: 6, windowMs: 3600000 });
const trackLimit = U.rateLimit({ max: 40, windowMs: 600000 });
const pushLimit = U.rateLimit({ max: 30, windowMs: 3600000 });

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* ---------- catalog ---------- */

router.get('/home', (req, res) => res.json(dom.homeSections()));

router.get('/products', (req, res) => res.json(dom.listProducts(req.query)));

router.get('/products/:slug', (req, res) => {
  const p = db.data.products.find((x) => (x.slug === req.params.slug || x.id === req.params.slug) && x.status === 'active');
  if (!p) throw new HttpError(404, 'not_found', 'পণ্যটি পাওয়া যায়নি।');
  p.views = (p.views || 0) + 1;
  db.save();
  const rs = db.data.reviews.filter((r) => r.productId === p.id && r.status === 'approved');
  const dist = [0, 0, 0, 0, 0];
  rs.forEach((r) => dist[r.rating - 1]++);
  res.json({
    product: dom.detailOf(p),
    related: dom.relatedProducts(p),
    reviews: {
      avg: p.ratingAvg || 0,
      count: rs.length,
      dist: dist.reverse(),
      photoCount: rs.filter((r) => r.photos.length).length,
      items: rs.slice(0, 6).map(dom.publicReview),
    },
  });
});

router.get('/products/:id/reviews', (req, res) => {
  const limit = 8;
  let rs = db.data.reviews.filter((r) => r.productId === req.params.id && r.status === 'approved');
  if (req.query.photos === '1') rs = rs.filter((r) => r.photos.length);
  const page = U.clampInt(req.query.page, 1, 1000, 1);
  res.json({ items: rs.slice((page - 1) * limit, page * limit).map(dom.publicReview), total: rs.length, page, pages: Math.max(1, Math.ceil(rs.length / limit)) });
});

router.post(
  '/products/:id/reviews',
  reviewLimit,
  wrap((req, res) => {
    const r = dom.addReview(req.params.id, req.body || {}, { ip: req.ip });
    res.status(201).json({ ok: true, status: r.status, review: r.status === 'approved' ? dom.publicReview(r) : null });
  })
);

router.get('/search/suggest', (req, res) => res.json(dom.suggest(req.query.q)));

router.get('/pages/:slug', (req, res) => {
  const pg = db.data.pages.find((x) => x.slug === req.params.slug);
  if (!pg) throw new HttpError(404, 'not_found', 'পেজটি পাওয়া যায়নি।');
  const S = db.data.settings;
  const ctx = {
    siteName: S.siteName,
    phone: S.contact.phone,
    email: S.contact.email || '—',
    insideFee: S.shipping.insideFee,
    outsideFee: S.shipping.outsideFee,
    freeAbove: S.shipping.freeAbove,
  };
  const fill = (txt, lang) =>
    String(txt || '').replace(/\{(\w+)\}/g, (m, k) => {
      if (k === 'address') return (S.contact.address && (S.contact.address[lang] || S.contact.address.bn)) || '';
      if (k === 'hours') return (S.contact.hours && (S.contact.hours[lang] || S.contact.hours.bn)) || '';
      return k in ctx ? ctx[k] : m;
    });
  res.json({
    slug: pg.slug,
    title: pg.title,
    titleEn: pg.titleEn || pg.title,
    body: fill(pg.body, 'bn'),
    bodyEn: fill(pg.bodyEn || pg.body, 'en'),
  });
});

/* ---------- cart / orders ---------- */

router.post('/cart/price', (req, res) => {
  const b = req.body || {};
  const dist = dom.DISTRICTS.get(String(b.district || ''));
  res.json(dom.priceCart({ items: b.items, district: dist ? dist.en : '', coupon: b.coupon }));
});

router.post(
  '/orders',
  orderLimit,
  wrap((req, res) => {
    const { order, duplicate } = dom.createOrder(req.body || {}, { ip: req.ip, ua: req.get('user-agent'), host: req.hostname });
    res.status(duplicate ? 200 : 201).json({ ok: true, duplicate, order: dom.publicOrder(order) });
  })
);

router.get(
  '/orders/track',
  trackLimit,
  wrap((req, res) => {
    const number = U.str(req.query.number, 20).toUpperCase().replace(/\s+/g, '');
    const phone = U.normPhone(req.query.phone);
    const o = phone && db.data.orders.find((x) => x.number === number && x.customer.phone === phone);
    if (!o) throw new HttpError(404, 'not_found', 'এই নম্বর ও ফোন নম্বর দিয়ে কোনো অর্ডার পাওয়া যায়নি।');
    res.json({ order: dom.publicOrder(o) });
  })
);

/* ---------- social proof (real data only) ---------- */

router.get('/live', (req, res) => res.json({ items: dom.liveFeed() }));

const presence = new Map(); // productId -> Map(sid -> lastSeen)
setInterval(() => {
  const cut = Date.now() - 60000;
  for (const [pid, m] of presence) {
    for (const [sid, t] of m) if (t < cut) m.delete(sid);
    if (!m.size) presence.delete(pid);
  }
}, 30000).unref();

router.post('/presence', (req, res) => {
  const pid = U.str(req.body && req.body.pid, 40);
  const sid = U.str(req.body && req.body.sid, 40);
  if (!pid || !sid) return res.json({ viewers: 0 });
  let m = presence.get(pid);
  if (!m) presence.set(pid, (m = new Map()));
  m.set(sid, Date.now());
  const cut = Date.now() - 45000;
  let n = 0;
  for (const t of m.values()) if (t >= cut) n++;
  res.json({ viewers: db.data.settings.marketing.showViewers ? n : 0 });
});

/* ---------- contact ---------- */

router.post(
  '/contact',
  contactLimit,
  wrap((req, res) => {
    const b = req.body || {};
    if (b.hp) return res.json({ ok: true });
    const name = U.str(b.name, 80);
    const message = U.str(b.message, 2000);
    if (name.length < 2) throw new HttpError(400, 'name_required', 'আপনার নাম লিখুন।');
    if (message.length < 3) throw new HttpError(400, 'message_required', 'মেসেজ লিখুন।');
    db.data.messages.unshift({ id: U.uid(5), name, phone: U.str(b.phone, 20), email: U.str(b.email, 120), message, read: false, createdAt: U.nowIso() });
    db.save();
    push.notifyAdmins({ title: 'নতুন মেসেজ', body: `${name}: ${message.slice(0, 80)}`, url: '/admin/#/messages', tag: 'msg-new' }).catch(() => {});
    res.status(201).json({ ok: true });
  })
);

/* ---------- push ---------- */

router.get('/push/key', (req, res) => res.json({ key: push.publicKey() }));

router.post(
  '/push/subscribe',
  pushLimit,
  wrap((req, res) => {
    const b = req.body || {};
    const sub = push.addSub({ subscription: b.subscription, role: 'customer', order: U.str(b.order, 20).toUpperCase() || undefined, lang: b.lang });
    if (!sub) throw new HttpError(400, 'bad_subscription', 'সাবস্ক্রিপশন ঠিক নেই।');
    res.json({ ok: true });
  })
);

router.post('/push/unsubscribe', pushLimit, (req, res) => {
  const ep = req.body && req.body.endpoint;
  if (ep) push.removeSub(String(ep));
  res.json({ ok: true });
});

router.get('/bootstrap', (req, res) => {
  res.json({
    settings: dom.publicSettings(),
    categories: db.data.categories
      .filter((c) => c.active !== false)
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...dom.catBrief(c), image: c.image || '', count: db.data.products.filter((p) => p.status === 'active' && p.categoryId === c.id).length })),
    banners: db.data.banners.filter((b) => b.active).sort((a, b) => a.sort - b.sort),
  });
});

module.exports = router;
