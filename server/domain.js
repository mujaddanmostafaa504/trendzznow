'use strict';
// Business logic: products, search, pricing, orders, reviews, stats.
const db = require('./db');
const U = require('./util');
const push = require('./push');
const { FONTS, SELF_FONTS } = require('./defaults');
const geo = require('../public/data/bd-geo.json');

const { HttpError } = U;

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
const INACTIVE = new Set(['cancelled', 'returned']);
const STATUS_TEXT = {
  pending: { bn: 'অর্ডার গ্রহণ করা হয়েছে', en: 'Order received' },
  confirmed: { bn: 'অর্ডার কনফার্ম হয়েছে', en: 'Order confirmed' },
  processing: { bn: 'পণ্য প্রস্তুত করা হচ্ছে', en: 'Preparing your order' },
  shipped: { bn: 'কুরিয়ারে পাঠানো হয়েছে', en: 'Handed to courier' },
  delivered: { bn: 'ডেলিভারি সম্পন্ন হয়েছে', en: 'Delivered' },
  cancelled: { bn: 'অর্ডার বাতিল হয়েছে', en: 'Order cancelled' },
  returned: { bn: 'পণ্য ফেরত এসেছে', en: 'Order returned' },
};
const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'rocket'];

const DISTRICTS = new Map();
geo.forEach((div) => div.districts.forEach((d) => DISTRICTS.set(d.en, { ...d, division: div.en, divisionBn: div.bn })));

const D = () => db.data;
const productById = (id) => D().products.find((p) => p.id === id);
const categoryById = (id) => D().categories.find((c) => c.id === id);

/* ---------------- products ---------------- */

function totalStock(p) {
  if (p.variants && p.variants.length) return p.variants.reduce((a, v) => a + (v.stock || 0), 0);
  return p.stock || 0;
}

function discountPct(p) {
  return p.comparePrice && p.comparePrice > p.price ? Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100) : 0;
}

function isNewProduct(p) {
  return Date.now() - new Date(p.createdAt).getTime() < 14 * 86400000;
}

function catBrief(c) {
  return c ? { id: c.id, slug: c.slug, name: c.name, nameEn: c.nameEn || '' } : null;
}

function cardOf(p) {
  const stock = totalStock(p);
  const th = D().settings.marketing.lowStockThreshold || 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    comparePrice: p.comparePrice || 0,
    discount: discountPct(p),
    image: p.images[0] || '',
    image2: p.images[1] || '',
    rating: p.ratingAvg || 0,
    ratingCount: p.ratingCount || 0,
    inStock: stock > 0,
    lowStock: stock > 0 && th > 0 && stock <= th ? stock : 0,
    brand: p.brand || '',
    category: catBrief(categoryById(p.categoryId)),
    hasVariants: !!(p.variants && p.variants.length),
    isNew: isNewProduct(p),
    featured: !!p.featured,
  };
}

function detailOf(p) {
  return {
    ...cardOf(p),
    description: p.description || '',
    images: p.images,
    options: p.options || [],
    variants: (p.variants || []).map((v) => ({ key: v.key, label: v.label, values: v.values, stock: v.stock, price: v.price == null ? p.price : v.price })),
    stock: totalStock(p),
    sold: p.sold || 0,
    sku: p.sku || '',
    tags: p.tags || [],
    seoTitle: p.seoTitle || '',
    seoDesc: p.seoDesc || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function haystackScore(p, tokens) {
  const name = (p.name || '').toLowerCase();
  const brand = (p.brand || '').toLowerCase();
  const tags = (p.tags || []).join(' ').toLowerCase();
  const sku = (p.sku || '').toLowerCase();
  const c = categoryById(p.categoryId);
  const cn = c ? `${c.name} ${c.nameEn || ''}`.toLowerCase() : '';
  const desc = (p.description || '').toLowerCase();
  let score = 0;
  for (const t of tokens) {
    let s = 0;
    if (name.startsWith(t)) s += 10;
    else if (name.includes(' ' + t)) s += 8;
    else if (name.includes(t)) s += 6;
    if (brand.includes(t)) s += 4;
    if (tags.includes(t)) s += 4;
    if (sku.includes(t)) s += 5;
    if (cn.includes(t)) s += 3;
    if (desc.includes(t)) s += 1;
    if (!s) return 0;
    score += s;
  }
  return score;
}

function tokenize(q) {
  return String(q || '').toLowerCase().split(/\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
}

function listProducts(q = {}) {
  let list = D().products.filter((p) => p.status === 'active');
  const scores = new Map();

  if (q.ids) {
    const ids = String(q.ids).split(',').filter(Boolean).slice(0, 60);
    const items = ids.map((id) => list.find((p) => p.id === id)).filter(Boolean).map(cardOf);
    return { items, total: items.length, page: 1, pages: 1, facets: { brands: [], priceMin: 0, priceMax: 0 } };
  }
  if (q.cat) {
    const c = D().categories.find((x) => x.slug === q.cat || x.id === q.cat);
    list = c ? list.filter((p) => p.categoryId === c.id) : [];
  }
  if (q.featured) list = list.filter((p) => p.featured);
  if (q.tag) list = list.filter((p) => (p.tags || []).map((t) => t.toLowerCase()).includes(String(q.tag).toLowerCase()));
  const tokens = tokenize(q.q);
  if (tokens.length) {
    list = list.filter((p) => {
      const s = haystackScore(p, tokens);
      if (s) scores.set(p.id, s);
      return s > 0;
    });
  }
  if (q.inStock === '1' || q.inStock === true) list = list.filter((p) => totalStock(p) > 0);

  // facets are computed before the sidebar filters so the sidebar does not shrink as you filter
  const brandCount = new Map();
  let pMin = Infinity;
  let pMax = 0;
  list.forEach((p) => {
    if (p.brand) brandCount.set(p.brand, (brandCount.get(p.brand) || 0) + 1);
    pMin = Math.min(pMin, p.price);
    pMax = Math.max(pMax, p.price);
  });
  const facets = {
    brands: [...brandCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    priceMin: Number.isFinite(pMin) ? Math.floor(pMin) : 0,
    priceMax: Math.ceil(pMax),
  };

  if (q.brand) {
    const set = new Set(String(q.brand).split(',').map((x) => x.trim()).filter(Boolean));
    list = list.filter((p) => set.has(p.brand));
  }
  const min = U.num(q.min, 0);
  const max = U.num(q.max, 0);
  if (min > 0) list = list.filter((p) => p.price >= min);
  if (max > 0) list = list.filter((p) => p.price <= max);
  const rating = U.num(q.rating, 0);
  if (rating > 0) list = list.filter((p) => (p.ratingAvg || 0) >= rating && (p.ratingCount || 0) > 0);
  const disc = U.num(q.discount, 0);
  if (disc > 0) list = list.filter((p) => discountPct(p) >= disc);

  const sort = q.sort || (tokens.length ? 'relevance' : 'new');
  const byNew = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const sorters = {
    new: byNew,
    relevance: (a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0) || (b.sold || 0) - (a.sold || 0),
    popular: (a, b) => (b.sold || 0) - (a.sold || 0) || (b.views || 0) - (a.views || 0),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    discount: (a, b) => discountPct(b) - discountPct(a),
    rating: (a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || (b.ratingCount || 0) - (a.ratingCount || 0),
  };
  list = list.slice().sort(sorters[sort] || byNew);
  // sold out items go last on every list except explicit price sort
  if (!['price_asc', 'price_desc'].includes(sort)) {
    list = [...list.filter((p) => totalStock(p) > 0), ...list.filter((p) => totalStock(p) <= 0)];
  }

  const limit = U.clampInt(q.limit, 1, 60, 24);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = U.clampInt(q.page, 1, pages, 1);
  const items = list.slice((page - 1) * limit, page * limit).map(cardOf);
  return { items, total, page, pages, facets };
}

function relatedProducts(p, n = 8) {
  const pool = D().products.filter((x) => x.status === 'active' && x.id !== p.id);
  const scored = pool
    .map((x) => {
      let s = 0;
      if (x.categoryId && x.categoryId === p.categoryId) s += 5;
      if (x.brand && x.brand === p.brand) s += 3;
      const shared = (x.tags || []).filter((t) => (p.tags || []).includes(t)).length;
      s += shared * 2;
      if (totalStock(x) > 0) s += 1;
      return { x, s };
    })
    .filter((r) => r.s > 1)
    .sort((a, b) => b.s - a.s || (b.x.sold || 0) - (a.x.sold || 0));
  return scored.slice(0, n).map((r) => cardOf(r.x));
}

function suggest(qstr) {
  const tokens = tokenize(qstr);
  if (!tokens.length) return { products: [], categories: [] };
  const products = D().products
    .filter((p) => p.status === 'active')
    .map((p) => ({ p, s: haystackScore(p, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((r) => cardOf(r.p));
  const categories = D().categories
    .filter((c) => c.active !== false && tokens.every((t) => `${c.name} ${c.nameEn || ''}`.toLowerCase().includes(t)))
    .slice(0, 3)
    .map(catBrief);
  return { products, categories };
}

function homeSections() {
  const active = D().products.filter((p) => p.status === 'active');
  const inStock = (p) => totalStock(p) > 0;
  const top = (arr, n = 8) => arr.slice(0, n).map(cardOf);
  const byNew = active.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const byPop = active.slice().sort((a, b) => (b.sold || 0) - (a.sold || 0) || (b.views || 0) - (a.views || 0));
  let featured = active.filter((p) => p.featured && inStock(p));
  if (featured.length < 4) featured = [...featured, ...byPop.filter((p) => !featured.includes(p) && inStock(p))].slice(0, 8);
  return {
    featured: top(featured),
    newArrivals: top(byNew.filter(inStock)),
    bestSellers: top(byPop.filter(inStock)),
    onSale: top(active.filter((p) => discountPct(p) > 0 && inStock(p)).sort((a, b) => discountPct(b) - discountPct(a))),
  };
}

function recalcRating(productId) {
  const p = productById(productId);
  if (!p) return;
  const rs = D().reviews.filter((r) => r.productId === productId && r.status === 'approved');
  p.ratingCount = rs.length;
  p.ratingAvg = rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : 0;
}

/* ---------------- admin product input ---------------- */

const IMG_RE = /^(\/(uploads|demo|img)\/[\w.\-]+|https?:\/\/[^\s"'<>]+)$/;

function cleanImages(list, max = 12) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => String(x || '').trim()).filter((x) => IMG_RE.test(x)).slice(0, max);
}

function cartesian(options) {
  let combos = [[]];
  for (const o of options) combos = combos.flatMap((c) => o.values.map((v) => [...c, v]));
  return combos;
}

function normalizeProductInput(inp, existing) {
  const d = D();
  const name = U.str(inp.name, 200);
  if (!name) throw new HttpError(400, 'name_required', 'প্রোডাক্টের নাম লিখুন।');
  const price = Math.round(U.num(inp.price) * 100) / 100;
  if (!(price > 0)) throw new HttpError(400, 'price_required', 'সঠিক দাম লিখুন।');
  let comparePrice = Math.round(U.num(inp.comparePrice) * 100) / 100;
  if (!(comparePrice > price)) comparePrice = 0;

  const options = (Array.isArray(inp.options) ? inp.options : [])
    .map((o) => ({
      name: U.str(o && o.name, 40),
      values: [...new Set((Array.isArray(o && o.values) ? o.values : String((o && o.values) || '').split(',')).map((v) => U.str(v, 40)).filter(Boolean))].slice(0, 30),
    }))
    .filter((o) => o.name && o.values.length)
    .slice(0, 3);

  let variants = [];
  if (options.length) {
    const combos = cartesian(options);
    if (combos.length > 200) throw new HttpError(400, 'too_many_variants', 'ভ্যারিয়েশন ২০০টির বেশি হয়ে গেছে। অপশন কমান।');
    const given = new Map((Array.isArray(inp.variants) ? inp.variants : []).map((v) => [String(v.key), v]));
    variants = combos.map((c) => {
      const key = c.join('|');
      const g = given.get(key) || {};
      const vp = U.num(g.price, 0);
      const values = {};
      options.forEach((o, i) => (values[o.name] = c[i]));
      return {
        key,
        label: c.join(' / '),
        values,
        stock: U.clampInt(g.stock, 0, 1000000, 0),
        price: vp > 0 && vp !== price ? vp : null,
        sku: U.str(g.sku, 60),
      };
    });
  }

  const tags = [...new Set((Array.isArray(inp.tags) ? inp.tags : String(inp.tags || '').split(',')).map((t) => U.str(t, 30)).filter(Boolean))].slice(0, 20);
  const slugBase = U.slugify(inp.slug || (existing && existing.slug) || name, 'product');
  const base = {
    name,
    slug: U.uniqueSlug(d.products, slugBase, existing && existing.id),
    description: String(inp.description || '').slice(0, 8000),
    categoryId: d.categories.some((c) => c.id === inp.categoryId) ? inp.categoryId : '',
    brand: U.str(inp.brand, 60),
    price,
    comparePrice,
    cost: Math.max(0, U.num(inp.cost, 0)),
    sku: U.str(inp.sku, 60),
    stock: variants.length ? 0 : U.clampInt(inp.stock, 0, 1000000, 0),
    images: cleanImages(inp.images),
    options,
    variants,
    tags,
    featured: !!inp.featured,
    status: inp.status === 'draft' ? 'draft' : 'active',
    seoTitle: U.str(inp.seoTitle, 120),
    seoDesc: U.str(inp.seoDesc, 300),
  };
  return base;
}

/* ---------------- pricing ---------------- */

function zoneFor(districtEn) {
  const s = D().settings.shipping;
  return (s.insideDistricts || ['Dhaka']).includes(districtEn) ? 'inside' : 'outside';
}

function checkCoupon(code, subtotal) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  const cp = D().coupons.find((x) => x.code.toUpperCase() === c);
  if (!cp || !cp.active) return { error: 'coupon_invalid' };
  const t = Date.now();
  if (cp.startsAt && t < new Date(cp.startsAt).getTime()) return { error: 'coupon_not_started' };
  if (cp.endsAt && t > new Date(cp.endsAt).getTime() + 86399999) return { error: 'coupon_expired' };
  if (cp.usageLimit && (cp.used || 0) >= cp.usageLimit) return { error: 'coupon_used_up' };
  if (cp.minOrder && subtotal < cp.minOrder) return { error: 'coupon_min_order', min: cp.minOrder };
  let discount = 0;
  if (cp.type === 'percent') {
    discount = Math.floor((subtotal * cp.value) / 100);
    if (cp.maxDiscount) discount = Math.min(discount, cp.maxDiscount);
  } else if (cp.type === 'fixed') discount = Math.min(cp.value, subtotal);
  return { code: cp.code, type: cp.type, value: cp.value, discount, freeShipping: cp.type === 'freeship', coupon: cp };
}

function priceCart({ items, district, coupon }) {
  const merged = new Map();
  for (const it of (Array.isArray(items) ? items : []).slice(0, 60)) {
    const key = `${it.productId}|${it.variantKey || ''}`;
    const prev = merged.get(key);
    const qty = U.clampInt(it.qty, 1, 99, 1);
    if (prev) prev.qty = Math.min(99, prev.qty + qty);
    else merged.set(key, { productId: String(it.productId || ''), variantKey: String(it.variantKey || ''), qty });
  }
  const lines = [];
  for (const it of merged.values()) {
    const p = productById(it.productId);
    if (!p || p.status !== 'active') {
      lines.push({ productId: it.productId, variantKey: it.variantKey, qty: 0, requestedQty: it.qty, issue: 'unavailable', name: '', image: '', unitPrice: 0, lineTotal: 0, stock: 0 });
      continue;
    }
    let variant = null;
    let issue = null;
    if (p.variants.length) {
      variant = p.variants.find((v) => v.key === it.variantKey);
      if (!variant) issue = 'variant_required';
    }
    const unit = variant && variant.price != null ? variant.price : p.price;
    const stock = variant ? variant.stock : p.stock;
    let qty = it.qty;
    if (!issue) {
      if (stock <= 0) {
        issue = 'out_of_stock';
        qty = 0;
      } else if (qty > stock) {
        issue = 'limited';
        qty = stock;
      }
    }
    lines.push({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0] || '',
      variantKey: variant ? variant.key : '',
      variantLabel: variant ? variant.label : '',
      unitPrice: unit,
      comparePrice: p.comparePrice || 0,
      qty,
      requestedQty: it.qty,
      stock,
      issue,
      lineTotal: unit * qty,
    });
  }
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const cp = checkCoupon(coupon, subtotal);
  const discount = cp && !cp.error ? cp.discount : 0;
  const s = D().settings.shipping;
  let shipping = null;
  let zone = null;
  if (district) {
    zone = zoneFor(district);
    shipping = zone === 'inside' ? s.insideFee : s.outsideFee;
    if (s.freeAbove > 0 && subtotal - discount >= s.freeAbove) shipping = 0;
    if (cp && !cp.error && cp.freeShipping) shipping = 0;
  }
  const total = subtotal - discount + (shipping || 0);
  return {
    lines,
    subtotal,
    discount,
    coupon: cp ? (cp.error ? { error: cp.error, min: cp.min } : { code: cp.code, type: cp.type, value: cp.value, freeShipping: cp.freeShipping }) : null,
    shipping,
    zone,
    total,
    freeAbove: s.freeAbove || 0,
    insideFee: s.insideFee,
    outsideFee: s.outsideFee,
  };
}

/* ---------------- orders ---------------- */

function lowerUa(ua) {
  return String(ua || '').toLowerCase();
}

function detectSource(src = {}, ua = '') {
  const norm = (s) => {
    s = String(s || '').toLowerCase();
    if (!s) return '';
    if (/(^|\W)(fb|facebook|meta)(\W|$)|facebook/.test(s)) return 'facebook';
    if (/instagram|(^|\W)ig(\W|$)/.test(s)) return 'instagram';
    if (/tiktok|(^|\W)tt(\W|$)/.test(s)) return 'tiktok';
    if (/whatsapp|(^|\W)wa(\W|$)/.test(s)) return 'whatsapp';
    if (/messenger/.test(s)) return 'messenger';
    if (/youtube|(^|\W)yt(\W|$)/.test(s)) return 'youtube';
    if (/google|(^|\W)gclid/.test(s)) return 'google';
    return s.replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  };
  let label = norm(src.utm_source);
  if (!label && src.fbclid) label = 'facebook';
  if (!label && src.ttclid) label = 'tiktok';
  if (!label && src.gclid) label = 'google';
  if (!label && src.referrer) {
    try {
      const h = new URL(src.referrer).hostname.replace(/^www\./, '');
      if (/facebook\.com|fb\.com|fb\.me|messenger\.com/.test(h)) label = h.includes('messenger') ? 'messenger' : 'facebook';
      else if (/instagram\.com/.test(h)) label = 'instagram';
      else if (/tiktok\.com/.test(h)) label = 'tiktok';
      else if (/google\./.test(h)) label = 'google';
      else if (/youtube\.com|youtu\.be/.test(h)) label = 'youtube';
      else if (/wa\.me|whatsapp/.test(h)) label = 'whatsapp';
      else if (!src.ownHost || h !== src.ownHost) label = h.slice(0, 30);
    } catch (e) {
      /* ignore */
    }
  }
  if (!label) {
    const u = lowerUa(ua);
    if (/fban|fbav|fb_iab/.test(u)) label = 'facebook';
    else if (/instagram/.test(u)) label = 'instagram';
    else if (/tiktok|musical_ly|bytedance/.test(u)) label = 'tiktok';
  }
  return label || 'direct';
}

function orderSignature(phone, lines) {
  return `${phone}|${lines.map((l) => `${l.productId}:${l.variantKey}:${l.qty}`).sort().join(',')}`;
}

function applyStock(order, dir) {
  for (const it of order.items) {
    const p = productById(it.productId);
    if (!p) continue;
    if (p.variants.length && it.variantKey) {
      const v = p.variants.find((x) => x.key === it.variantKey);
      if (v) v.stock = Math.max(0, v.stock + dir * it.qty);
    } else p.stock = Math.max(0, p.stock + dir * it.qty);
    p.sold = Math.max(0, (p.sold || 0) - dir * it.qty);
  }
}

function createOrder(inp, ctx = {}) {
  const d = D();
  const S = d.settings;
  const c = inp.customer || {};
  const name = U.str(c.name, 80);
  if (name.length < 2) throw new HttpError(400, 'name_required', 'আপনার নাম লিখুন।');
  const phone = U.normPhone(c.phone);
  if (!phone) throw new HttpError(400, 'phone_invalid', 'সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।');
  const dist = DISTRICTS.get(String(c.district || ''));
  if (!dist) throw new HttpError(400, 'district_required', 'জেলা বেছে নিন।');
  const address = U.str(c.address, 300);
  if (address.length < 5) throw new HttpError(400, 'address_required', 'পুরো ঠিকানা লিখুন।');

  if (!ctx.admin) {
    if (inp.hp) throw new HttpError(400, 'bad_request', 'অনুরোধটি গ্রহণ করা যায়নি।');
    if ((d.blocked && d.blocked.phones || []).includes(phone)) {
      throw new HttpError(403, 'blocked', 'এই নম্বর থেকে অনলাইনে অর্ডার নেওয়া যাচ্ছে না। অনুগ্রহ করে আমাদের ফোন করুন।');
    }
    const since = Date.now() - 86400000;
    const todays = d.orders.filter((o) => o.customer.phone === phone && new Date(o.createdAt).getTime() > since).length;
    const lim = S.policies.maxOrdersPerPhonePerDay || 0;
    if (lim && todays >= lim) throw new HttpError(429, 'too_many_orders', 'আজকের জন্য এই নম্বরে অর্ডারের সীমা শেষ। অনুগ্রহ করে আমাদের ফোন করুন।');
  }

  const priced = priceCart({ items: inp.items, district: dist.en, coupon: inp.coupon });
  const bad = priced.lines.filter((l) => l.issue);
  if (!priced.lines.length) throw new HttpError(400, 'cart_empty', 'কার্ট খালি।');
  if (bad.length) throw new HttpError(409, 'cart_invalid', 'কিছু পণ্যের স্টক বা তথ্য বদলে গেছে। কার্ট দেখে নিন।', { lines: priced.lines });
  if (priced.coupon && priced.coupon.error) throw new HttpError(400, priced.coupon.error, 'কুপন কোডটি ব্যবহার করা যাচ্ছে না।', { min: priced.coupon.min });
  if (!ctx.admin && S.policies.minOrder && priced.subtotal < S.policies.minOrder) {
    throw new HttpError(400, 'min_order', `ন্যূনতম অর্ডার ৳${S.policies.minOrder}।`, { min: S.policies.minOrder });
  }

  // duplicate guard (double click, flaky network)
  const sig = orderSignature(phone, priced.lines);
  const recent = d.orders.find((o) => o.sig === sig && Date.now() - new Date(o.createdAt).getTime() < 3 * 60000);
  if (recent && !ctx.admin) return { order: recent, duplicate: true };

  const method = PAYMENT_METHODS.includes(inp.paymentMethod) ? inp.paymentMethod : 'cod';
  const pm = S.payments[method];
  if (!ctx.admin && (!pm || !pm.enabled)) throw new HttpError(400, 'payment_unavailable', 'এই পেমেন্ট মাধ্যম এখন চালু নেই।');
  let trxId = '';
  let senderNumber = '';
  if (method !== 'cod') {
    trxId = U.str(inp.trxId, 30).replace(/\s+/g, '').toUpperCase();
    if (!ctx.admin && !/^[A-Z0-9]{6,24}$/.test(trxId)) throw new HttpError(400, 'trx_required', 'পেমেন্টের Transaction ID সঠিকভাবে লিখুন।');
    senderNumber = U.normPhone(inp.senderNumber) || '';
  }

  const number = `${S.orderPrefix || 'TN'}${db.nextSeq('order', 10000)}`;
  const createdAt = U.nowIso();
  const srcIn = inp.source && typeof inp.source === 'object' ? inp.source : {};
  const source = {
    label: ctx.admin && inp.channel ? U.str(inp.channel, 20) : detectSource({ ...srcIn, ownHost: ctx.host }, ctx.ua),
    utm_source: U.str(srcIn.utm_source, 60),
    utm_medium: U.str(srcIn.utm_medium, 60),
    utm_campaign: U.str(srcIn.utm_campaign, 100),
    utm_content: U.str(srcIn.utm_content, 100),
    referrer: U.str(srcIn.referrer, 200),
    landing: U.str(srcIn.landing, 200),
    channel: ctx.admin ? 'manual' : 'web',
  };
  const order = {
    id: U.uid(6),
    number,
    sig,
    items: priced.lines.map((l) => {
      const p = productById(l.productId);
      return {
        productId: l.productId,
        slug: l.slug,
        name: l.name,
        image: l.image,
        variantKey: l.variantKey,
        variantLabel: l.variantLabel,
        unitPrice: l.unitPrice,
        cost: p ? p.cost || 0 : 0,
        qty: l.qty,
      };
    }),
    customer: {
      name,
      phone,
      email: U.str(c.email, 120),
      division: dist.division,
      district: dist.en,
      area: U.str(c.area, 100),
      address,
      note: U.str(c.note, 400),
    },
    subtotal: priced.subtotal,
    discount: priced.discount,
    couponCode: priced.coupon ? priced.coupon.code : '',
    shipping: priced.shipping || 0,
    total: priced.total,
    payment: { method, status: method === 'cod' ? 'unpaid' : 'pending_verification', trxId, senderNumber },
    status: 'pending',
    timeline: [{ status: 'pending', at: createdAt, note: '' }],
    courier: { name: '', trackingId: '', url: '' },
    source,
    showInLive: inp.showInLive !== false,
    adminNote: '',
    stockApplied: true,
    demo: false,
    createdAt,
    updatedAt: createdAt,
  };
  applyStock(order, -1);
  d.orders.unshift(order);
  if (priced.coupon && !priced.coupon.error) {
    const cp = d.coupons.find((x) => x.code.toUpperCase() === priced.coupon.code.toUpperCase());
    if (cp) cp.used = (cp.used || 0) + 1;
  }
  db.save();

  push
    .notifyAdmins({
      title: `নতুন অর্ডার ${number}`,
      body: `${name}, ${dist.bn} | ৳${priced.total}`,
      url: `/admin/#/orders/${number}`,
      tag: 'order-new',
    })
    .catch(() => {});
  return { order, duplicate: false };
}

function setOrderStatus(order, status, note, opts = {}) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'bad_status', 'স্ট্যাটাস ঠিক নেই।');
  if (order.status === status && !note) return false;
  const wasInactive = INACTIVE.has(order.status);
  const nowInactive = INACTIVE.has(status);
  if (!wasInactive && nowInactive && order.stockApplied) {
    applyStock(order, +1);
    order.stockApplied = false;
  } else if (wasInactive && !nowInactive && !order.stockApplied) {
    applyStock(order, -1);
    order.stockApplied = true;
  }
  if (order.status !== status) {
    order.status = status;
    order.timeline.push({ status, at: U.nowIso(), note: U.str(note, 300) });
  } else if (note) {
    order.timeline.push({ status, at: U.nowIso(), note: U.str(note, 300) });
  }
  if (status === 'delivered' && order.payment.method === 'cod' && order.payment.status !== 'paid') {
    order.payment.status = 'paid';
    order.payment.paidAt = U.nowIso();
  }
  order.updatedAt = U.nowIso();
  db.save();
  if (opts.notify !== false && order.status !== 'pending') {
    push
      .notifyOrder(order.number, (sub) => ({
        title: `${D().settings.siteName}`,
        body: `${order.number}: ${(STATUS_TEXT[order.status] || {})[sub.lang] || order.status}`,
        url: `/order/${order.number}`,
        tag: `order-${order.number}`,
      }))
      .catch(() => {});
  }
  return true;
}

function publicOrder(o) {
  return {
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    timeline: o.timeline,
    items: o.items.map((i) => ({ name: i.name, slug: i.slug, image: i.image, variantLabel: i.variantLabel, unitPrice: i.unitPrice, qty: i.qty })),
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.couponCode,
    shipping: o.shipping,
    total: o.total,
    payment: { method: o.payment.method, status: o.payment.status },
    courier: o.courier,
    customer: { name: o.customer.name, district: o.customer.district, area: o.customer.area, address: o.customer.address, phone: o.customer.phone.slice(0, 3) + '****' + o.customer.phone.slice(-3) },
  };
}

function liveFeed() {
  const S = D().settings;
  if (!S.marketing.liveNotices) return [];
  const since = Date.now() - 48 * 3600000;
  const out = [];
  for (const o of D().orders) {
    if (out.length >= 10) break;
    if (INACTIVE.has(o.status) || o.showInLive === false || o.demo) continue;
    const t = new Date(o.createdAt).getTime();
    if (t < since) continue;
    const it = o.items[0];
    const dist = DISTRICTS.get(o.customer.district);
    out.push({
      name: o.customer.name.split(/\s+/)[0].slice(0, 20),
      district: dist ? dist.bn : o.customer.district,
      districtEn: o.customer.district,
      product: it ? it.name : '',
      slug: it ? it.slug : '',
      image: it ? it.image : '',
      qty: it ? it.qty : 1,
      minutesAgo: Math.max(1, Math.round((Date.now() - t) / 60000)),
    });
  }
  return out;
}

/* ---------------- reviews ---------------- */

function addReview(productId, inp, ctx = {}) {
  const p = productById(productId);
  if (!p || p.status !== 'active') throw new HttpError(404, 'not_found', 'পণ্যটি পাওয়া যায়নি।');
  if (inp.hp) throw new HttpError(400, 'bad_request', 'অনুরোধটি গ্রহণ করা যায়নি।');
  const name = U.str(inp.name, 60);
  const text = U.str(inp.text, 1500);
  const rating = U.clampInt(inp.rating, 1, 5, 0);
  if (name.length < 2) throw new HttpError(400, 'name_required', 'আপনার নাম লিখুন।');
  if (!rating) throw new HttpError(400, 'rating_required', 'রেটিং দিন।');
  if (text.length < 3) throw new HttpError(400, 'text_required', 'রিভিউ লিখুন।');
  const photos = [];
  for (const ph of (Array.isArray(inp.photos) ? inp.photos : []).slice(0, 3)) {
    photos.push(U.saveDataUrlImage(ph, db.UPLOADS, { maxBytes: 1.6 * 1024 * 1024, prefix: 'r-' }));
  }
  const phone = U.normPhone(inp.phone);
  const verified = !!phone && D().orders.some((o) => o.customer.phone === phone && o.status === 'delivered' && o.items.some((i) => i.productId === p.id));
  const review = {
    id: U.uid(6),
    productId: p.id,
    name,
    rating,
    text,
    photos,
    verified,
    status: D().settings.reviews.autoApprove ? 'approved' : 'pending',
    createdAt: U.nowIso(),
  };
  D().reviews.unshift(review);
  recalcRating(p.id);
  db.save();
  return review;
}

function publicReview(r) {
  return { id: r.id, name: r.name, rating: r.rating, text: r.text, photos: r.photos, verified: r.verified, createdAt: r.createdAt };
}

/* ---------------- settings ---------------- */

function publicSettings() {
  const s = D().settings;
  return {
    siteName: s.siteName,
    tagline: s.tagline,
    orderPrefix: s.orderPrefix,
    defaultLang: s.defaultLang,
    defaultTheme: s.defaultTheme,
    brand: s.brand,
    logo: s.logo,
    logoDark: s.logoDark,
    appIcon192: s.appIcon192,
    appIcon512: s.appIcon512,
    contact: s.contact,
    social: s.social,
    announcement: s.announcement,
    shipping: s.shipping,
    payments: s.payments,
    badges: s.badges,
    marketing: s.marketing,
    legal: s.legal,
    policies: { minOrder: s.policies.minOrder },
    currency: 'BDT',
  };
}

function adminSettings() {
  const s = JSON.parse(JSON.stringify(D().settings));
  return s;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function mergeSettings(target, incoming, def, path = '') {
  if (!incoming || typeof incoming !== 'object') return;
  for (const key of Object.keys(def)) {
    if (!(key in incoming)) continue;
    const dv = def[key];
    const iv = incoming[key];
    const here = path + key;
    if (Array.isArray(dv)) {
      if (!Array.isArray(iv)) continue;
      if (here === 'badges.payment' || here === 'badges.courier') {
        target[key] = iv.slice(0, 12).map((b) => ({
          id: U.slugify(b.id || b.label, 'badge'),
          label: U.str(b.label, 40),
          image: /^(\/(uploads|img)\/[\w.\-]+|https?:\/\/[^\s"'<>]+)$/.test(String(b.image || '')) ? String(b.image) : '',
          enabled: !!b.enabled,
        }));
      } else if (here === 'shipping.insideDistricts') {
        target[key] = iv.map((x) => String(x)).filter((x) => DISTRICTS.has(x));
      }
    } else if (dv && typeof dv === 'object') {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      mergeSettings(target[key], iv, dv, here + '.');
    } else if (typeof dv === 'number') {
      const n = Number(iv);
      if (Number.isFinite(n) && n >= 0) target[key] = n;
    } else if (typeof dv === 'boolean') {
      target[key] = !!iv;
    } else if (typeof dv === 'string') {
      let v = String(iv == null ? '' : iv).trim().slice(0, 1000);
      if (['primary', 'accent', 'ink'].includes(key) && here.startsWith('brand.')) {
        if (!HEX.test(v)) continue;
      } else if (key === 'headingFont' || key === 'bodyFont') {
        if (!FONTS[v]) continue;
      } else if (key === 'radius') {
        if (!['sharp', 'soft', 'round'].includes(v)) continue;
      } else if (key === 'cardRatio') {
        if (!['1 / 1', '4 / 5', '3 / 4'].includes(v)) continue;
      } else if (key === 'defaultLang') {
        if (!['bn', 'en'].includes(v)) continue;
      } else if (key === 'defaultTheme') {
        if (!['system', 'light', 'dark'].includes(v)) continue;
      } else if (key === 'siteUrl') {
        v = v.replace(/\/+$/, '');
        if (v && !/^https?:\/\/[^\s]+$/.test(v)) continue;
      } else if (['logo', 'logoDark', 'appIcon512', 'appIcon192'].includes(key)) {
        if (v && !/^(\/(uploads|img)\/[\w.\-]+|https?:\/\/[^\s"'<>]+)$/.test(v)) continue;
      } else if (key === 'orderPrefix') {
        v = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'TN';
      } else if (['fbPixelId', 'tiktokPixelId'].includes(key)) {
        v = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      } else if (key === 'ga4Id') {
        v = v.replace(/[^A-Za-z0-9\-]/g, '').slice(0, 30);
      } else if (['phone', 'whatsapp'].includes(key) && path === 'contact.') {
        v = v.replace(/[^\d+]/g, '').slice(0, 16);
      } else if (key === 'number') {
        v = v.replace(/[^\d+]/g, '').slice(0, 16);
      } else if (key === 'kind') {
        if (!['personal', 'merchant', 'agent'].includes(v)) continue;
      } else if (key === 'messenger') {
        v = v.replace(/^https?:\/\/(www\.)?(m\.me|facebook\.com|fb\.com)\//i, '').replace(/[^A-Za-z0-9._\-]/g, '').slice(0, 80);
      }
      target[key] = v;
    }
  }
}

function updateSettings(incoming) {
  const def = require('./defaults').defaultSettings();
  mergeSettings(D().settings, incoming, def);
  db.save();
}

/* ---------------- stats ---------------- */

const DHAKA_OFFSET = 6 * 3600000;
const dayKey = (iso) => new Date(new Date(iso).getTime() + DHAKA_OFFSET).toISOString().slice(0, 10);

function dashboard() {
  const orders = D().orders;
  const live = orders.filter((o) => !INACTIVE.has(o.status));
  const today = dayKey(new Date().toISOString());
  const sums = (pred) => {
    const list = live.filter(pred);
    return { orders: list.length, revenue: list.reduce((a, o) => a + o.total, 0) };
  };
  const k = (days) => {
    const cutoff = Date.now() - days * 86400000;
    return sums((o) => new Date(o.createdAt).getTime() >= cutoff);
  };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * 86400000).toISOString());
    const list = live.filter((o) => dayKey(o.createdAt) === key);
    daily.push({ date: key, orders: list.length, revenue: list.reduce((a, o) => a + o.total, 0) });
  }
  const statusCounts = {};
  STATUSES.forEach((s) => (statusCounts[s] = 0));
  orders.forEach((o) => (statusCounts[o.status] = (statusCounts[o.status] || 0) + 1));
  const since30 = Date.now() - 30 * 86400000;
  const topMap = new Map();
  const srcMap = new Map();
  let profit30 = 0;
  live.forEach((o) => {
    if (new Date(o.createdAt).getTime() < since30) return;
    o.items.forEach((i) => {
      const t = topMap.get(i.productId) || { productId: i.productId, name: i.name, image: i.image, qty: 0, revenue: 0 };
      t.qty += i.qty;
      t.revenue += i.unitPrice * i.qty;
      topMap.set(i.productId, t);
      profit30 += (i.unitPrice - (i.cost || 0)) * i.qty;
    });
    const lab = (o.source && o.source.label) || 'direct';
    const s = srcMap.get(lab) || { source: lab, orders: 0, revenue: 0 };
    s.orders += 1;
    s.revenue += o.total;
    srcMap.set(lab, s);
  });
  const th = D().settings.marketing.lowStockThreshold || 5;
  const lowStock = D().products
    .filter((p) => p.status === 'active' && totalStock(p) <= th)
    .map((p) => ({ id: p.id, name: p.name, image: p.images[0] || '', stock: totalStock(p) }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);
  return {
    today: sums((o) => dayKey(o.createdAt) === today),
    week: k(7),
    month: k(30),
    allTime: sums(() => true),
    profit30,
    daily,
    statusCounts,
    topProducts: [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
    sources: [...srcMap.values()].sort((a, b) => b.orders - a.orders),
    lowStock,
    pendingOrders: statusCounts.pending || 0,
    pendingReviews: D().reviews.filter((r) => r.status === 'pending').length,
    unreadMessages: D().messages.filter((m) => !m.read).length,
    productCount: D().products.length,
    recentOrders: orders.slice(0, 8).map(adminOrderRow),
  };
}

function adminOrderRow(o) {
  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    total: o.total,
    customer: { name: o.customer.name, phone: o.customer.phone, district: o.customer.district },
    itemCount: o.items.reduce((a, i) => a + i.qty, 0),
    paymentMethod: o.payment.method,
    paymentStatus: o.payment.status,
    source: (o.source && o.source.label) || 'direct',
    demo: !!o.demo,
  };
}

function customersList() {
  const map = new Map();
  for (const o of D().orders) {
    const c = map.get(o.customer.phone) || { phone: o.customer.phone, name: o.customer.name, district: o.customer.district, orders: 0, delivered: 0, cancelled: 0, spent: 0, lastOrderAt: o.createdAt, firstOrderAt: o.createdAt };
    c.orders += 1;
    if (o.status === 'delivered') c.delivered += 1;
    if (INACTIVE.has(o.status)) c.cancelled += 1;
    else c.spent += o.total;
    if (o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
    if (o.createdAt < c.firstOrderAt) c.firstOrderAt = o.createdAt;
    map.set(o.customer.phone, c);
  }
  const blocked = new Set((D().blocked && D().blocked.phones) || []);
  return [...map.values()].map((c) => ({ ...c, blocked: blocked.has(c.phone) })).sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : -1));
}

function fontsUrl(s) {
  const fams = [...new Set([s.brand.headingFont, s.brand.bodyFont])].filter((f) => FONTS[f] && !SELF_FONTS.has(f)).map((f) => `family=${FONTS[f]}`);
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap` : '';
}

module.exports = {
  STATUSES, INACTIVE, STATUS_TEXT, PAYMENT_METHODS, DISTRICTS, geo,
  productById, categoryById, totalStock, discountPct, cardOf, detailOf, catBrief,
  listProducts, relatedProducts, suggest, homeSections, recalcRating,
  normalizeProductInput, cleanImages, priceCart, checkCoupon, createOrder, setOrderStatus, publicOrder, liveFeed,
  addReview, publicReview, publicSettings, adminSettings, updateSettings, dashboard, adminOrderRow, customersList,
  applyStock, fontsUrl, detectSource, zoneFor,
};
