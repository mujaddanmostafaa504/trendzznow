const express = require('express');
const cookieSession = require('cookie-session');
const compression = require('compression');
const multer = require('multer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { sendOrderSMS, sendOrderEmail } = require('./notifications');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(compression());

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseKey || 'missing-key', {
  auth: { persistSession: false, autoRefreshToken: false }
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.json({ limit: '15mb' }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  if (req.path.startsWith('/secret-admin-panel-2026')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1h' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
// JSON for embedding inside <script> tags: "<" is escaped so data can never close the script tag.
app.locals.safeJson = (v) => JSON.stringify(v === undefined ? null : v)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!process.env.SESSION_SECRET_1 || !process.env.SESSION_SECRET_2)) {
  console.warn('[security] SESSION_SECRET_1 / SESSION_SECRET_2 not set. Using random per-boot secrets: admins will be logged out on every restart. Set them in your environment.');
}
if (IS_PROD && !process.env.SUPABASE_KEY) {
  console.warn('[config] SUPABASE_KEY missing. Use the service_role key (server side only).');
}

app.use(cookieSession({
  name: 'trendzznow_admin_sess',
  keys: [
    process.env.SESSION_SECRET_1 || crypto.randomBytes(32).toString('hex'),
    process.env.SESSION_SECRET_2 || crypto.randomBytes(32).toString('hex')
  ],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax'
}));

// Forget "missing column" lessons every 5 minutes so a freshly migrated database is picked up without a restart.
setInterval(() => { for (const k of Object.keys(missingColumns)) delete missingColumns[k]; }, 5 * 60 * 1000).unref();

// Generate CSRF token per session
app.use((req, res, next) => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session ? req.session.csrfToken : '';
  next();
});

// CSRF check for admin POST routes. Place it AFTER multer on multipart routes so req.body is parsed.
function csrfProtect(req, res, next) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
  const expected = (req.session && req.session.csrfToken) || '';
  if (!expected || !sent || !safeEqual(sent, expected)) {
    const wantsJson = (req.get('accept') || '').includes('application/json') || req.get('x-csrf-token');
    if (wantsJson) return res.status(403).json({ success: false, message: 'Security token expired. Reload the page and try again.' });
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Security token expired. Please try again.'));
  }
  next();
}

const defaultSettings = {
  site_title: 'TrendzzNow - Stay on trend. Stay in style.',
  brand_name_first: 'Trendzz',
  brand_name_second: 'Now',
  logo_light: '',
  logo_dark: '',
  hero_image: '',
  hero_badge_text: '🔥 Trending Spotlight',
  hero_featured_title: 'Dynamic Leaf Table Lamp',
  hero_featured_price: '৳ 950',
  hero_featured_link: '#products',
  tagline_en: 'Stay on trend. Stay in style.',
  tagline_bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন',
  banner_text: '⚡ Only Viral & Trending Products | 100% Cash on Delivery Across Bangladesh',
  banner_text_bn: '⚡ শুধুমাত্র সেরা ট্রেন্ডিং প্রোডাক্ট | সারা বাংলাদেশে ক্যাশ অন ডেলিভারি!',
  hero_title_en: 'Just Trending Products — Curated for You',
  hero_title_bn: 'শুধুমাত্র সেরা ট্রেন্ডিং প্রোডাক্ট কালেকশন',
  hero_subtitle_en: 'Stay on trend. Stay in style. Handpicked viral gadgets & modern essentials delivered straight to your doorstep.',
  hero_subtitle_bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন। বাছাইকৃত সেরা ভাইরাল গ্যাজেট ও আধুনিক পণ্য পান ক্যাশ অন ডেলিভারিতে।',
  whatsapp_number: '01731763504',
  bkash_number: '01731763504',
  nagad_number: '01731763504',
  delivery_inside_dhaka: '70',
  delivery_outside_dhaka: '130',
  cod_enabled: 'true',
  tax_percentage: '0',
  free_shipping_threshold: '0',
  courier_partners: 'SteadFast,Pathao,RedX',
  steadfast_api_key: '',
  steadfast_secret_key: '',
  pathao_client_id: '',
  facebook_pixel: '',
  promo_code: 'TREND50',
  promo_discount: '50',
  social_facebook: 'https://facebook.com/trendzznow',
  social_instagram: 'https://instagram.com/trendzznow',
  social_youtube: '',
  social_tiktok: '',
  footer_about_en: 'Official e-commerce destination for viral gadgets, home decor, and lifestyle essentials across Bangladesh.',
  footer_copyright: '© 2026 TrendzzNow (trendzznow.com). All rights reserved.',
  faq_1_q: 'How long does delivery take across Bangladesh?',
  faq_1_a: 'Inside Dhaka delivery takes 24–48 hours, and outside Dhaka takes 2–4 business days via SteadFast, Pathao, or RedX.',
  faq_2_q: 'Can I check the product before paying?',
  faq_2_a: 'Yes! We offer 100% Cash on Delivery (COD). You can inspect the parcel in front of the delivery rider before paying.',
  faq_3_q: 'What is your return & replacement policy?',
  faq_3_a: 'If you receive a damaged or wrong item, notify us immediately via WhatsApp (01731763504) for a free instant replacement.',
  faq_4_q: 'How can I track my order?',
  faq_4_a: 'Click the "Track Order" button in the top menu and enter your mobile number to see live order status.',
  privacy_policy: 'At TrendzzNow (trendzznow.com), we value your privacy. Customer names, phone numbers, and delivery addresses are strictly used only to process and ship your orders via our trusted courier partners.',
  return_policy: 'We offer a 7-Day Easy Replacement Policy for any manufacturing defect, transit damage, or wrong item delivered. Contact us on WhatsApp at 01731763504 within 24 hours.',
  terms_conditions: 'By placing an order on TrendzzNow, you agree to provide accurate contact and delivery details. Orders confirmed via website or WhatsApp are dispatched within 24 hours.',
  ai_enabled: 'true',
  ai_provider: 'gemini',
  ai_welcome_en: 'Hi! Welcome to TrendzzNow 👋 How can I help you with products, delivery, or order tracking today?',
  ai_welcome_bn: 'আসসালামু আলাইকুম! TrendzzNow-তে স্বাগতম 👋 প্রোডাক্ট, ডেলিভারি বা অর্ডার ট্র্যাকিং বিষয়ে কীভাবে সাহায্য করতে পারি?',
  ai_kb_text: 'Delivery inside Dhaka is 70 BDT (24-48 hours) and outside Dhaka is 130 BDT (2-4 days). 100% Cash on Delivery available with open-box inspection. WhatsApp Hotline: 01731763504.',
  ai_handoff_msg: 'For direct human assistance, please message our WhatsApp support at 01731763504.'
};

// Strips every angle bracket so user text can never become markup (stored XSS safe).
function sanitizeStr(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>]/g, '').trim();
}

function escapeHtml(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Password hashing (scrypt). Old plain-text values still verify and get upgraded on login. ----
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (isHashed(stored)) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(String(plain), salt, 64).toString('hex');
    return safeEqual(test, hash);
  }
  return safeEqual(plain, stored);
}

// ---- Tiny in-memory rate limiter ----
const rateBuckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { rateBuckets.set(key, arr); return true; }
  arr.push(now);
  rateBuckets.set(key, arr);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of rateBuckets) {
    const fresh = arr.filter(t => now - t < 3600000);
    if (fresh.length) rateBuckets.set(k, fresh); else rateBuckets.delete(k);
  }
}, 600000).unref();

// Image list: split on commas, but never inside a data: URL (base64 contains a comma)
function parseImageList(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(/,\s*(?=https?:\/\/|\/|data:)/i).map(s => s.trim()).filter(Boolean);
}

const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

const PROTECTED_SETTING_KEYS = ['admin_password', 'sub_admins', 'system_audit_logs', 'stock_history_logs', 'ai_conversations', 'share_analytics'];

function slugify(str) {
  return String(str || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function normalizeProduct(p) {
  if (!p) return p;
  let gallery = [];
  if (p.gallery_images) {
    try {
      gallery = typeof p.gallery_images === 'string' ? JSON.parse(p.gallery_images) : p.gallery_images;
      if (!Array.isArray(gallery)) gallery = [];
    } catch (e) {
      gallery = String(p.gallery_images).split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  const primaryImg = p.image || p.image_url || p.img || (gallery[0] || '');
  const slugBase = slugify(p.title || p.name);
  return {
    ...p,
    slug: slugBase,
    url: '/product/' + p.id + (slugBase ? '-' + slugBase : ''),
    seo_title_set: !!(p.seo_title && String(p.seo_title).trim()),
    seo_description_set: !!(p.seo_description && String(p.seo_description).trim()),
    title: p.title || p.name || 'Product',
    name: p.name || p.title || 'Product',
    sku: p.sku || `TN-${p.id || '001'}`,
    category: p.category || p.cat || 'Trending',
    subcategory: p.subcategory || p.subcat || '',
    image: primaryImg,
    gallery_images: gallery,
    price: p.price !== undefined && p.price !== null ? Number(p.price) : (Number(p.sale_price) || 0),
    regular_price: p.regular_price ? Number(p.regular_price) : (p.old_price ? Number(p.old_price) : 0),
    cost_price: p.cost_price !== undefined && p.cost_price !== null ? Number(p.cost_price) : 0,
    stock_quantity: p.stock_quantity !== undefined && p.stock_quantity !== null ? parseInt(p.stock_quantity, 10) : 50,
    is_archived: Boolean(p.is_archived) || p.is_active === false,
    free_delivery: p.free_delivery === true || p.free_delivery === 'true',
    description: p.description || p.desc || p.details || '',
    seo_title: p.seo_title || p.title || p.name || '',
    seo_description: p.seo_description || p.description || '',
    variant_options: p.variant_options || p.variants || ''
  };
}

function normalizeOrder(o) {
  if (!o) return o;
  let history = [];
  if (o.audit_history) {
    try {
      history = typeof o.audit_history === 'string' ? JSON.parse(o.audit_history) : o.audit_history;
      if (!Array.isArray(history)) history = [];
    } catch (e) { history = []; }
  }
  return {
    ...o,
    customer_name: o.customer_name || o.name || 'Customer',
    phone: o.phone || o.mobile || '',
    customer_email: o.customer_email || o.email || '',
    address: o.address || o.delivery_address || '',
    product_title: o.product_title || o.product_name || o.product || 'Order Item',
    price: o.price !== undefined && o.price !== null ? Number(o.price) : (Number(o.total || o.total_amount || o.amount) || 0),
    quantity: parseInt(o.quantity, 10) || 1,
    status: o.status || 'Pending',
    payment_status: o.payment_status || ((o.address || '').includes('TrxID:') ? 'Paid / Verify' : 'COD Pending'),
    consignment_id: o.consignment_id || '',
    admin_notes: o.admin_notes || '',
    audit_history: history
  };
}

async function getSettings() {
  try {
    if (!supabaseUrl || !supabaseKey) return { ...defaultSettings };
    const { data, error } = await supabase.from('settings').select('*');
    const settings = { ...defaultSettings };
    if (!error && data) {
      data.forEach(item => {
        if (item.value !== null && item.value !== '') {
          settings[item.key] = item.value;
        }
      });
    }
    return settings;
  } catch (err) {
    return { ...defaultSettings };
  }
}

async function appendAuditLog(actor, action, details) {
  try {
    const settings = await getSettings();
    let logs = [];
    if (settings.system_audit_logs) {
      try { logs = JSON.parse(settings.system_audit_logs); } catch (e) { logs = []; }
    }
    logs.unshift({
      timestamp: new Date().toISOString(),
      actor: actor || 'Admin',
      action,
      details
    });
    logs = logs.slice(0, 150);
    await supabase.from('settings').upsert({ key: 'system_audit_logs', value: JSON.stringify(logs) }, { onConflict: 'key' });
  } catch (e) {}
}

async function handleImageUpload(file) {
  if (!file) return null;
  try {
    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (publicUrlData && publicUrlData.publicUrl) return publicUrlData.publicUrl;
    }
  } catch (e) {}
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
}

async function getNextSequentialId(table) {
  try {
    const { data } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (data && data.length > 0 && !isNaN(Number(data[0].id))) {
      return Number(data[0].id) + 1;
    }
  } catch (e) {}
  return Math.floor(Date.now() / 1000);
}

// Columns learned to be missing per table, so later writes skip them without a failed round trip.
const missingColumns = {};
function stripMissing(table, payload) {
  const miss = missingColumns[table];
  const out = { ...payload };
  if (miss) for (const c of miss) delete out[c];
  return out;
}
function rememberMissing(table, col) {
  (missingColumns[table] = missingColumns[table] || new Set()).add(col);
}

async function universalInsert(table, payload, fallbackValues = {}) {
  let currentPayload = stripMissing(table, payload);
  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await supabase.from(table).insert([currentPayload]).select();
    if (!error) return { data, error: null };

    const msg = error.message || '';
    const colMatch = msg.match(/Could not find the '([^']+)' column/);
    if (colMatch && colMatch[1] && Object.prototype.hasOwnProperty.call(currentPayload, colMatch[1])) {
      console.warn(`[schema] ${table}.${colMatch[1]} missing in database, value skipped on insert`);
      rememberMissing(table, colMatch[1]);
      delete currentPayload[colMatch[1]];
      continue;
    }

    const nullMatch = msg.match(/null value in column "([^"]+)"/);
    if (nullMatch && nullMatch[1]) {
      const col = nullMatch[1];
      if (col === 'id') {
        currentPayload.id = await getNextSequentialId(table);
      } else if (fallbackValues[col] !== undefined) {
        currentPayload[col] = fallbackValues[col];
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|cost|stock|num|number)/i.test(col)) {
        currentPayload[col] = 0;
      } else {
        currentPayload[col] = '';
      }
      continue;
    }

    if (msg.includes('invalid input syntax for type')) {
      for (const k of Object.keys(currentPayload)) {
        if (currentPayload[k] === '') currentPayload[k] = 0;
      }
      continue;
    }

    if (msg.includes('duplicate key') && currentPayload.id) {
      currentPayload.id = Number(currentPayload.id) + 1;
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Insert failed after universal schema adaptation.' } };
}

async function universalUpdate(table, id, payload, fallbackValues = {}) {
  let currentPayload = stripMissing(table, payload);
  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await supabase.from(table).update(currentPayload).eq('id', id).select();
    if (!error) return { data, error: null };

    const msg = error.message || '';
    const colMatch = msg.match(/Could not find the '([^']+)' column/);
    if (colMatch && colMatch[1] && Object.prototype.hasOwnProperty.call(currentPayload, colMatch[1])) {
      console.warn(`[schema] ${table}.${colMatch[1]} missing in database, value skipped on update`);
      rememberMissing(table, colMatch[1]);
      delete currentPayload[colMatch[1]];
      continue;
    }

    const nullMatch = msg.match(/null value in column "([^"]+)"/);
    if (nullMatch && nullMatch[1]) {
      const col = nullMatch[1];
      if (fallbackValues[col] !== undefined) {
        currentPayload[col] = fallbackValues[col];
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|cost|stock|num|number)/i.test(col)) {
        currentPayload[col] = 0;
      } else {
        currentPayload[col] = '';
      }
      continue;
    }

    if (msg.includes('invalid input syntax for type')) {
      for (const k of Object.keys(currentPayload)) {
        if (currentPayload[k] === '') currentPayload[k] = 0;
      }
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Update failed after universal schema adaptation.' } };
}

// Give reserved stock back (used when an order fails after stock was deducted).
async function releaseStock(reserved) {
  for (const r of reserved) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: cur } = await supabase.from('products').select('stock_quantity').eq('id', r.id).single();
      const now = cur && cur.stock_quantity !== null ? Number(cur.stock_quantity) : 0;
      const { data: upd, error } = await supabase.from('products').update({ stock_quantity: now + r.qty }).eq('id', r.id).eq('stock_quantity', now).select('id');
      if (!error && upd && upd.length > 0) break;
    }
  }
  reserved.length = 0;
}

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Sent to SteadFast', 'Sent to Pathao', 'Delivered', 'Cancelled', 'Return', 'Returned'];
const STOCK_RELEASING = ['Cancelled', 'Return', 'Returned'];

// When an order is cancelled/returned its stock goes back; if it is revived, the stock is taken again.
async function syncOrderStock(orderTitle, oldStatus, newStatus) {
  const wasReleased = STOCK_RELEASING.includes(oldStatus);
  const nowReleased = STOCK_RELEASING.includes(newStatus);
  if (wasReleased === nowReleased) return;
  const sign = nowReleased ? 1 : -1;
  const { data: prods } = await supabase.from('products').select('id, title, stock_quantity');
  const byTitle = {};
  (prods || []).forEach(p => { byTitle[String(p.title || '').toLowerCase()] = p; });
  for (const part of String(orderTitle || '').split(/\),\s*/)) {
    const m = part.match(/^(.*?)(?:\s*\[[^\]]*\])?\s*\(x(\d+)/);
    if (!m) continue;
    const prod = byTitle[m[1].trim().toLowerCase()];
    if (!prod) continue;
    const qty = parseInt(m[2], 10) || 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: cur } = await supabase.from('products').select('stock_quantity').eq('id', prod.id).single();
      const now = cur && cur.stock_quantity !== null ? Number(cur.stock_quantity) : 0;
      const { data: upd, error } = await supabase.from('products').update({ stock_quantity: Math.max(0, now + sign * qty) }).eq('id', prod.id).eq('stock_quantity', now).select('id');
      if (!error && upd && upd.length > 0) break;
    }
  }
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect('/secret-admin-panel-2026');
  }
  next();
}

app.get('/healthz', (req, res) => res.status(200).send('OK'));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /\nDisallow: /secret-admin-panel-2026\nDisallow: /order/\nDisallow: /api/\nSitemap: https://trendzznow.com/sitemap.xml");
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: products } = await supabase.from('products').select('*').order('id', { ascending: false });
    const esc = (v) => escapeHtml(v);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
    xml += '  <url><loc>https://trendzznow.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
    (products || []).map(normalizeProduct).filter(p => !p.is_archived).forEach(p => {
      const last = p.created_at ? `<lastmod>${new Date(p.created_at).toISOString().slice(0, 10)}</lastmod>` : '';
      const img = p.image && /^https?:\/\//i.test(p.image) ? `<image:image><image:loc>${esc(p.image)}</image:loc><image:title>${esc(p.title)}</image:title></image:image>` : '';
      xml += `  <url><loc>https://trendzznow.com${esc(p.url)}</loc>${last}<changefreq>weekly</changefreq><priority>0.8</priority>${img}</url>\n`;
    });
    features.pageSlugs.forEach(slug => {
      xml += `  <url><loc>https://trendzznow.com/${slug}</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>\n`;
    });
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('');
  }
});

// Info pages, reviews, manifest (see server/features.js)
const features = require('./features')(app, {
  supabase, getSettings, sanitizeStr, rateLimited, requireAdmin, csrfProtect,
  normalizeProduct, appendAuditLog, BD_PHONE_RE
});
const commerce = require('./commerce')(app, {
  supabase, getSettings, sanitizeStr, rateLimited, requireAdmin, csrfProtect,
  appendAuditLog, universalInsert, universalUpdate
});

// ================= STOREFRONT ROUTES =================
app.get('/', async (req, res) => {
  try {
    let { data: products, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) products = [];
    const normalizedProducts = (products || []).map(normalizeProduct).filter(p => !p.is_archived);
    const settings = await getSettings();

    // Calculate real product order counts from orders table for genuine Trending/Popular badges
    const { data: rawOrders } = await supabase.from('orders').select('product_title, quantity, status');
    const productSalesCount = {};
    if (rawOrders) {
      rawOrders.forEach(o => {
        if (o.status !== 'Cancelled') {
          const title = (o.product_title || '').split(' [')[0].split(' (x')[0].trim();
          productSalesCount[title] = (productSalesCount[title] || 0) + (parseInt(o.quantity, 10) || 1);
        }
      });
    }

    const ratingStats = await features.getRatingStats().catch(() => ({}));
    res.render('index', { products: normalizedProducts, productSalesCount, settings, ratingStats });
  } catch (err) {
    res.render('index', { products: [], productSalesCount: {}, settings: defaultSettings, ratingStats: {} });
  }
});

app.get('/product/:idslug', async (req, res) => {
  const idMatch = String(req.params.idslug).match(/^(\d{1,12})(?:-.*)?$/);
  if (!idMatch) return res.status(404).render('404', { settings: await getSettings() });
  const productId = idMatch[1];
  try {
    const { data: rawProduct, error } = await supabase.from('products').select('*').eq('id', productId).single();
    if (error || !rawProduct) return res.status(404).render('404', { settings: await getSettings() });
    const product = normalizeProduct(rawProduct);
    if (product.is_archived) return res.status(404).render('404', { settings: await getSettings() });
    // One canonical address per product: /product/12-leaf-lamp. Old /product/12 links redirect permanently.
    if ('/product/' + req.params.idslug !== product.url) return res.redirect(301, product.url);
    const settings = await getSettings();
    const { data: relatedRaw } = await supabase.from('products').select('*').neq('id', productId).limit(4);
    const relatedProducts = (relatedRaw || []).map(normalizeProduct).filter(p => !p.is_archived);
    const reviews = await features.getProductReviews(product.id).catch(() => []);
    res.render('product-detail', { product, relatedProducts, settings, reviews });
  } catch (err) {
    res.redirect('/');
  }
});

// Customer Order Tracking API with Phone + Optional Order ID Verification
app.get('/order/track', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/[^0-9]/g, '');
  const orderId = String(req.query.order_id || '').replace(/[^0-9]/g, '');
  if (!phone || phone.length < 10) {
    return res.json({ success: false, message: 'Please enter a valid 11-digit mobile number.' });
  }
  if (rateLimited('track:' + req.ip, 30, 10 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
  }
  try {
    let query = supabase.from('orders').select('id, customer_name, product_title, price, quantity, status, consignment_id, created_at, phone').ilike('phone', `%${phone.slice(-10)}`).order('id', { ascending: false }).limit(20);
    if (orderId) {
      query = query.eq('id', orderId);
    }
    const { data: orders, error } = await query;
    if (error) return res.json({ success: false, message: error.message });
    // Public endpoint: return only what the tracking table needs, never address, phone, notes or audit data.
    const publicOrders = (orders || []).map(normalizeOrder).map(o => ({
      id: o.id,
      customer_name: o.customer_name,
      product_title: o.product_title,
      price: o.price,
      quantity: o.quantity,
      status: o.status,
      consignment_id: o.consignment_id,
      created_at: o.created_at
    }));
    res.json({ success: true, orders: publicOrders });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Track Share & Click Analytics
app.post('/api/share-track', async (req, res) => {
  const allowedPlatforms = ['facebook', 'whatsapp', 'messenger', 'twitter', 'telegram', 'instagram', 'tiktok', 'copy', 'copy_link', 'web_share', 'link', 'native'];
  const platform = allowedPlatforms.includes(String(req.body.platform || '').toLowerCase()) ? String(req.body.platform).toLowerCase() : 'link';
  const product_id = /^\d{1,12}$/.test(String(req.body.product_id || '')) ? String(req.body.product_id) : 'store';
  if (rateLimited('share:' + req.ip, 30, 10 * 60 * 1000)) return res.json({ success: false });
  try {
    const settings = await getSettings();
    let stats = {};
    if (settings.share_analytics) {
      try { stats = JSON.parse(settings.share_analytics); } catch (e) { stats = {}; }
    }
    const key = `${platform}_${product_id}`;
    stats[key] = (stats[key] || 0) + 1;
    stats.total_shares = (stats.total_shares || 0) + 1;
    await supabase.from('settings').upsert({ key: 'share_analytics', value: JSON.stringify(stats) }, { onConflict: 'key' });
    res.json({ success: true, total: stats.total_shares });
  } catch (e) {
    res.json({ success: false });
  }
});

// AI Customer Support Chat Endpoint (Server-side KB & Provider, never exposes keys)
app.post('/api/ai-support', async (req, res) => {
  const userMsg = sanitizeStr(req.body.message || '').slice(0, 300);
  const lang = req.body.lang === 'bn' ? 'bn' : 'en';
  if (!userMsg) return res.json({ reply: 'Please enter a message.' });
  if (rateLimited('ai:' + req.ip, 20, 10 * 60 * 1000)) {
    return res.json({ success: false, reply: 'Too many messages. Please wait a few minutes or contact us on WhatsApp.' });
  }

  try {
    const settings = await getSettings();
    const kb = settings.ai_kb_text || defaultSettings.ai_kb_text;
    const { data: rawProducts } = await supabase.from('products').select('title, price, stock_quantity, category').limit(15);
    const productsList = (rawProducts || []).map(p => `${p.title} (৳${p.price}, Stock: ${p.stock_quantity ?? 50})`).join('; ');

    let reply = '';
    const q = userMsg.toLowerCase();
    if (q.includes('delivery') || q.includes('ডেলিভারি') || q.includes('charge') || q.includes('চার্জ')) {
      reply = lang === 'bn'
        ? `ঢাকার ভেতরে ডেলিভারি চার্জ ৳${settings.delivery_inside_dhaka || 70} (২৪-৪৮ ঘণ্টা) এবং ঢাকার বাইরে ৳${settings.delivery_outside_dhaka || 130} (২-৪ দিন)। শতভাগ ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।`
        : `Delivery inside Dhaka is ৳${settings.delivery_inside_dhaka || 70} (24–48h) and outside Dhaka is ৳${settings.delivery_outside_dhaka || 130} (2–4 days) via ${settings.courier_partners}. 100% Cash on Delivery!`;
    } else if (q.includes('track') || q.includes('ট্র্যাক') || q.includes('order') || q.includes('অর্ডার')) {
      reply = lang === 'bn'
        ? `আপনার অর্ডার ট্র্যাক করতে উপরের মেনু থেকে "Track Order" বাটনে ক্লিক করে আপনার মোবাইল নম্বর দিন।`
        : `You can track your order live by clicking the "Track" button in the top header and entering your mobile number.`;
    } else if (q.includes('return') || q.includes('রিটার্ন') || q.includes('replace')) {
      reply = settings.return_policy || defaultSettings.return_policy;
    } else if (q.includes('price') || q.includes('দাম') || q.includes('product') || q.includes('প্রোডাক্ট')) {
      reply = lang === 'bn'
        ? `আমাদের বর্তমান ট্রেন্ডিং পণ্যসমূহ: ${productsList || 'হোমপেজে সকল পণ্য দেখুন'}। সরাসরি অর্ডার করতে পণ্যের নিচে "Order Now" বাটনে ক্লিক করুন।`
        : `Our available products include: ${productsList || 'Browse our catalog on the homepage'}. Click "Order Now" on any item for instant checkout!`;
    } else {
      reply = `${kb} ${settings.ai_handoff_msg || ''}`;
    }

    // Log conversation for admin monitoring
    let convs = [];
    if (settings.ai_conversations) {
      try { convs = JSON.parse(settings.ai_conversations); } catch (e) { convs = []; }
    }
    convs.unshift({ time: new Date().toISOString(), query: userMsg, reply });
    convs = convs.slice(0, 50);
    await supabase.from('settings').upsert({ key: 'ai_conversations', value: JSON.stringify(convs) }, { onConflict: 'key' });

    res.json({ success: true, reply });
  } catch (e) {
    res.json({ success: false, reply: 'Please contact us on WhatsApp at 01731763504 for immediate assistance.' });
  }
});

// Place Order Route (Supports both Single Product & Multi-Item Cart + Backend Price/Stock Validation!)
app.post('/order/place', async (req, res) => {
  const { 
    customer_name, phone, customer_email, address, product_id, product_title, price, quantity,
    cart_items, delivery_area, payment_method, trx_id, courier_choice, variant, promo_code
  } = req.body;

  if (!customer_name || !phone || !address) {
    return res.status(400).json({ success: false, message: 'Customer Name, Phone Number, and Delivery Address are required.' });
  }
  const cleanPhone = String(phone).replace(/[\s-]/g, '');
  if (!BD_PHONE_RE.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).' });
  }
  if (String(customer_name).trim().length < 2 || String(address).trim().length < 6) {
    return res.status(400).json({ success: false, message: 'Please enter your full name and a complete delivery address.' });
  }
  if (rateLimited('order:' + cleanPhone, 5, 60 * 60 * 1000) || rateLimited('orderip:' + req.ip, 20, 60 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'Too many orders from this number. Please try again later or contact us on WhatsApp.' });
  }

  if (await commerce.isBlockedPhone(cleanPhone)) {
    return res.status(403).json({ success: false, message: 'Sorry, we cannot take this order online. Please contact us on WhatsApp.' });
  }

  const reservedStock = []; // { id, qty } already deducted, used for rollback if the order insert fails
  try {
    const settings = await getSettings();
    if (settings.cod_enabled === 'false' && /cash|cod/i.test(String(payment_method || 'COD'))) {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is currently unavailable. Please pay with bKash or Nagad.' });
    }
    const { data: dbProducts } = await supabase.from('products').select('*');
    const productMap = {};
    (dbProducts || []).forEach(p => {
      const norm = normalizeProduct(p);
      productMap[String(norm.id)] = norm;
      productMap[norm.title.toLowerCase()] = norm;
    });

    let computedSubtotal = 0;
    let totalQty = 0;
    let orderSummaryTitles = [];

    // Check if multi-item cart or single item
    let parsedCart = [];
    if (cart_items && typeof cart_items === 'string') {
      try { parsedCart = JSON.parse(cart_items); } catch (e) { parsedCart = []; }
    } else if (Array.isArray(cart_items)) {
      parsedCart = cart_items;
    }

    // Merge duplicate lines of the same product so stock is checked against the combined quantity.
    const lines = [];
    const pushLine = (matched, q, vTxt) => {
      const existing = lines.find(l => String(l.matched.id) === String(matched.id) && l.vTxt === vTxt);
      if (existing) existing.q += q; else lines.push({ matched, q, vTxt });
    };
    const lookup = (id, title) => productMap[String(id)] || productMap[String(title || '').toLowerCase()];

    if (parsedCart.length > 0) {
      if (parsedCart.length > 30) {
        return res.status(400).json({ success: false, message: 'Too many items in cart.' });
      }
      for (const item of parsedCart) {
        const q = Math.min(100, Math.max(1, parseInt(item.quantity, 10) || 1));
        const matched = lookup(item.id, item.title);
        if (!matched || matched.is_archived) {
          return res.status(400).json({ success: false, message: `Sorry, "${sanitizeStr(String(item.title || 'This product'))}" is no longer available.` });
        }
        pushLine(matched, q, item.variant ? ` [${sanitizeStr(String(item.variant))}]` : '');
      }
    } else {
      const q = Math.min(100, Math.max(1, parseInt(quantity, 10) || 1));
      const matched = lookup(product_id, product_title);
      if (!matched || matched.is_archived) {
        return res.status(400).json({ success: false, message: `Sorry, "${sanitizeStr(String(product_title || 'This product'))}" is no longer available.` });
      }
      pushLine(matched, q, variant ? ` [Variant: ${sanitizeStr(String(variant))}]` : '');
    }

    for (const l of lines) {
      if (l.matched.stock_quantity < l.q) {
        return res.status(400).json({
          success: false,
          message: l.matched.stock_quantity > 0
            ? `Sorry, "${l.matched.title}" only has ${l.matched.stock_quantity} left in stock.`
            : `Sorry, "${l.matched.title}" is out of stock.`
        });
      }
      computedSubtotal += Number(l.matched.price) * l.q;
      totalQty += l.q;
      orderSummaryTitles.push(`${l.matched.title}${l.vTxt} (x${l.q})`);
    }

    // Reserve stock atomically: the update only succeeds if the stock is still what we read.
    // A concurrent order that changed it makes this fail, so we re-read and retry instead of overselling.
    for (const l of lines) {
      let ok = false;
      let current = l.matched.stock_quantity;
      for (let attempt = 0; attempt < 5 && !ok; attempt++) {
        if (current < l.q) break;
        const { data: upd, error: updErr } = await supabase
          .from('products').update({ stock_quantity: current - l.q })
          .eq('id', l.matched.id).eq('stock_quantity', current).select('id');
        if (!updErr && upd && upd.length > 0) { ok = true; reservedStock.push({ id: l.matched.id, qty: l.q }); break; }
        const { data: fresh } = await supabase.from('products').select('stock_quantity').eq('id', l.matched.id).single();
        current = fresh && fresh.stock_quantity !== null ? Number(fresh.stock_quantity) : 0;
      }
      if (!ok) {
        await releaseStock(reservedStock);
        return res.status(409).json({ success: false, message: `Sorry, "${l.matched.title}" just ran low on stock. Please reduce the quantity and try again.` });
      }
    }

    // Backend delivery charge and coupon validation (the browser total is only a preview)
    const areaText = String(delivery_area || '').toLowerCase();
    const midOn = settings.delivery_mid_charge !== undefined && String(settings.delivery_mid_charge).trim() !== '';
    let dCharge = areaText.includes('outside')
      ? (parseFloat(settings.delivery_outside_dhaka) || 130)
      : (areaText.includes('suburb') && midOn)
        ? (parseFloat(settings.delivery_mid_charge) || 0)
        : (parseFloat(settings.delivery_inside_dhaka) || 70);

    const freeThreshold = parseFloat(settings.free_shipping_threshold) || 0;
    if (freeThreshold > 0 && computedSubtotal >= freeThreshold) {
      dCharge = 0;
    }
    // Free delivery when every item in the order is marked free delivery
    if (lines.length > 0 && lines.every(l => l.matched.free_delivery)) {
      dCharge = 0;
    }

    let discountVal = 0;
    let claimedCoupon = null;
    if (promo_code && String(promo_code).trim()) {
      const cr = await commerce.resolveCoupon(promo_code, computedSubtotal);
      if (cr.ok) {
        if (cr.coupon && !(await commerce.claimCoupon(cr.coupon))) {
          await releaseStock(reservedStock);
          return res.status(400).json({ success: false, message: 'This coupon has just been fully used. Please remove it and try again.' });
        }
        claimedCoupon = cr.coupon;
        discountVal = cr.discount;
      }
    }

    const taxPct = parseFloat(settings.tax_percentage) || 0;
    const taxAmount = Math.round((computedSubtotal * taxPct) / 100);
    const totalAmount = Math.max(0, computedSubtotal + dCharge + taxAmount - discountVal);

    const emailNote = (customer_email && customer_email.trim()) ? ` | Email: ${sanitizeStr(customer_email)}` : '';
    const discountText = discountVal > 0 ? ` | Discount: -৳${discountVal}` : '';
    const detailedAddress = `${sanitizeStr(address)} | Area: ${sanitizeStr(delivery_area || 'Inside Dhaka')} | Payment: ${sanitizeStr(payment_method || 'COD')}${trx_id ? ' (TrxID: ' + sanitizeStr(trx_id) + ')' : ''} | Courier: ${sanitizeStr(courier_choice || 'SteadFast')}${discountText}${emailNote}`;
    const fullProdTitle = orderSummaryTitles.join(', ');

    const initialAudit = JSON.stringify([{
      time: new Date().toISOString(),
      actor: 'Customer Checkout',
      status: 'Pending',
      note: 'Order placed via storefront'
    }]);

    const orderPayload = {
      customer_name: sanitizeStr(customer_name),
      name: sanitizeStr(customer_name),
      phone: cleanPhone,
      mobile: cleanPhone,
      customer_email: sanitizeStr(customer_email || ''),
      email: sanitizeStr(customer_email || ''),
      address: detailedAddress,
      delivery_address: detailedAddress,
      product_title: fullProdTitle,
      product_name: fullProdTitle,
      product: fullProdTitle,
      price: totalAmount,
      total: totalAmount,
      total_amount: totalAmount,
      amount: totalAmount,
      quantity: totalQty,
      delivery_charge: dCharge,
      discount_applied: discountVal,
      status: 'Pending',
      consignment_id: '',
      admin_notes: '',
      audit_history: initialAudit,
      created_at: new Date().toISOString()
    };
    if (lines.length === 1) {
      orderPayload.product_id = lines[0].matched.id;
      orderPayload.unit_price = Number(lines[0].matched.price);
    }

    const fallbacks = {
      customer_name: sanitizeStr(customer_name),
      name: sanitizeStr(customer_name),
      phone: sanitizeStr(phone),
      mobile: sanitizeStr(phone),
      address: detailedAddress,
      product_title: fullProdTitle,
      price: totalAmount,
      quantity: totalQty,
      status: 'Pending'
    };

    const { data: insertedRows, error } = await universalInsert('orders', orderPayload, fallbacks);
    if (error) {
      await releaseStock(reservedStock); // order was not saved, give the stock back
      await commerce.releaseCoupon(claimedCoupon);
      return res.status(500).json({ success: false, message: 'Could not place your order right now. Please try again or contact us on WhatsApp.' });
    }

    const savedOrder = (insertedRows && insertedRows[0]) ? insertedRows[0] : { id: Math.floor(Date.now() / 1000) };

    sendOrderSMS({
      phone: phone.trim(),
      customerName: customer_name.trim(),
      orderId: savedOrder.id,
      totalAmount,
      status: 'Pending',
      hotLine: settings.whatsapp_number
    });

    if (customer_email && customer_email.trim()) {
      sendOrderEmail({
        email: customer_email.trim(),
        customerName: customer_name.trim(),
        phone: phone.trim(),
        orderId: savedOrder.id,
        productTitle: fullProdTitle,
        totalAmount,
        address: detailedAddress,
        status: 'Pending',
        hotLine: settings.whatsapp_number
      });
    }

    res.json({ success: true, message: 'Order placed successfully!', orderId: savedOrder.id, totalAmount });
  } catch (err) {
    console.error('[order/place]', err);
    try { await releaseStock(reservedStock); } catch (e) {}
    res.status(500).json({ success: false, message: 'Could not place your order right now. Please try again or contact us on WhatsApp.' });
  }
});

// ================= SECURE HIDDEN ADMIN ROUTES =================
app.get('/admin', (req, res) => res.redirect('/'));

app.get('/secret-admin-panel-2026', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/secret-admin-panel-2026/dashboard');
  res.render('admin-login', { error: null });
});

app.post('/secret-admin-panel-2026/login', async (req, res) => {
  const entered = String(req.body.password || '').trim();
  const loginKey = 'login:' + req.ip;
  if (rateLimited(loginKey, 8, 15 * 60 * 1000)) {
    return res.status(429).render('admin-login', { error: 'Too many login attempts. Please wait 15 minutes and try again.' });
  }
  const envPass = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';
  let dbPass = '';
  let subAdmins = [];
  let settings = null;
  try {
    settings = await getSettings();
    if (settings && settings.admin_password) dbPass = settings.admin_password.trim();
    if (settings && settings.sub_admins) subAdmins = JSON.parse(settings.sub_admins);
  } catch (e) {}

  const matchedSub = entered ? subAdmins.find(sub => verifyPassword(entered, sub.password)) : null;
  // The built-in admin123 fallback only exists outside production, and only when no password is configured anywhere.
  const masterValid = !!entered && (
    (dbPass && verifyPassword(entered, dbPass)) ||
    (envPass && safeEqual(entered, envPass)) ||
    (!IS_PROD && !dbPass && !envPass && entered === 'admin123')
  );

  // Silently upgrade plain-text passwords to hashes after a successful login.
  try {
    if (masterValid && dbPass && !isHashed(dbPass) && verifyPassword(entered, dbPass)) {
      await supabase.from('settings').upsert({ key: 'admin_password', value: hashPassword(entered) }, { onConflict: 'key' });
    } else if (!masterValid && matchedSub && !isHashed(matchedSub.password)) {
      const upgraded = subAdmins.map(s => (s === matchedSub ? { ...s, password: hashPassword(entered) } : s));
      await supabase.from('settings').upsert({ key: 'sub_admins', value: JSON.stringify(upgraded) }, { onConflict: 'key' });
    }
  } catch (e) {}

  if (masterValid || matchedSub) {
    req.session.isAdmin = true;
    req.session.adminRole = masterValid ? 'SuperAdmin' : (matchedSub.role || 'Staff');
    req.session.adminName = masterValid ? 'Super Admin' : (matchedSub.name || 'Staff');
    await appendAuditLog(req.session.adminName, 'Admin Login', `Logged in with role: ${req.session.adminRole}`);
    return res.redirect('/secret-admin-panel-2026/dashboard');
  } else {
    return res.render('admin-login', { error: 'Invalid credentials. Access denied.' });
  }
});

app.get('/secret-admin-panel-2026/logout', async (req, res) => {
  if (req.session && req.session.adminName) {
    await appendAuditLog(req.session.adminName, 'Admin Logout', 'Session terminated');
  }
  req.session = null;
  res.redirect('/secret-admin-panel-2026');
});

app.get('/secret-admin-panel-2026/dashboard', requireAdmin, async (req, res) => {
  try {
    const { data: rawProducts } = await supabase.from('products').select('*').order('id', { ascending: false });
    const { data: rawOrders } = await supabase.from('orders').select('*').order('id', { ascending: false });
    const products = (rawProducts || []).map(normalizeProduct);
    const orders = (rawOrders || []).map(normalizeOrder);
    const settings = await getSettings();

    let totalRevenue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let deliveredCount = 0;
    let returnCount = 0;
    let totalCost = 0;
    const customerMap = {};
    const dailyRevenue = {};

    // Cost of goods actually sold (matched by product title inside each order), not the value of stock on the shelf.
    const costByTitle = {};
    products.forEach(p => { costByTitle[String(p.title).toLowerCase()] = parseFloat(p.cost_price) || 0; });
    const orderCost = (o) => {
      let cost = 0;
      String(o.product_title || '').split(/\),\s*/).forEach(part => {
        const m = part.match(/^(.*?)(?:\s*\[[^\]]*\])?\s*\(x(\d+)/);
        if (!m) return;
        cost += (costByTitle[m[1].trim().toLowerCase()] || 0) * (parseInt(m[2], 10) || 1);
      });
      return cost;
    };

    orders.forEach(o => {
      const p = parseFloat(o.price) || 0;
      const dateKey = o.created_at ? o.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      if (o.status === 'Cancelled' || o.status === 'Return' || o.status === 'Returned') {
        returnCount++;
      } else {
        totalRevenue += p;
        totalCost += orderCost(o);
        dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + p;
        if (o.status === 'Pending') pendingCount++;
        else if (o.status === 'Delivered') deliveredCount++;
        else confirmedCount++;
      }
      const cPhone = o.phone || 'Unknown';
      if (!customerMap[cPhone]) {
        customerMap[cPhone] = { name: o.customer_name, phone: cPhone, orders: 0, spent: 0 };
      }
      customerMap[cPhone].orders += 1;
      customerMap[cPhone].spent += p;
    });

    const netProfit = totalRevenue - totalCost;
    const customersList = Object.values(customerMap);

    let auditLogs = [];
    if (settings.system_audit_logs) {
      try { auditLogs = JSON.parse(settings.system_audit_logs); } catch (e) {}
    }
    let stockLogs = [];
    if (settings.stock_history_logs) {
      try { stockLogs = JSON.parse(settings.stock_history_logs); } catch (e) {}
    }
    let subAdmins = [];
    if (settings.sub_admins) {
      try { subAdmins = JSON.parse(settings.sub_admins); } catch (e) {}
    }
    let aiConversations = [];
    if (settings.ai_conversations) {
      try { aiConversations = JSON.parse(settings.ai_conversations); } catch (e) {}
    }
    let shareAnalytics = {};
    if (settings.share_analytics) {
      try { shareAnalytics = JSON.parse(settings.share_analytics); } catch (e) {}
    }

    const { data: rawReviews } = await supabase.from('reviews').select('*').order('id', { ascending: false }).limit(200);
    const { data: rawCoupons } = await supabase.from('coupons').select('*').order('id', { ascending: false }).limit(100);
    const { data: rawBlocked } = await supabase.from('blocked_phones').select('*').limit(500);
    res.render('admin-dashboard', { 
      couponsList: rawCoupons || [],
      blockedList: rawBlocked || [],
      phoneRisk: commerce.phoneRisk(orders),
      topSellers: commerce.topSellers(products, orders),
      products, 
      orders, 
      reviewsList: rawReviews || [],
      customersList,
      settings, 
      adminRole: req.session.adminRole || 'SuperAdmin',
      adminName: req.session.adminName || 'Super Admin',
      auditLogs,
      stockLogs,
      subAdmins: subAdmins.map(({ password, ...rest }) => rest), // never send password hashes to the page
      aiConversations,
      shareAnalytics,
      dailyRevenue,
      analytics: { totalRevenue, pendingCount, confirmedCount, deliveredCount, returnCount, netProfit, totalCustomers: customersList.length },
      msg: req.query.msg || null 
    });
  } catch (err) {
    res.render('admin-dashboard', { 
      products: [], orders: [], reviewsList: [], couponsList: [], blockedList: [], phoneRisk: {}, topSellers: [], customersList: [], settings: defaultSettings, 
      adminRole: 'SuperAdmin', adminName: 'Admin', auditLogs: [], stockLogs: [], subAdmins: [], aiConversations: [], shareAnalytics: {}, dailyRevenue: {},
      analytics: { totalRevenue: 0, pendingCount: 0, confirmedCount: 0, deliveredCount: 0, returnCount: 0, netProfit: 0, totalCustomers: 0 }, 
      msg: null 
    });
  }
});

// Add Product (Supports Multiple Gallery Images + SEO + SKU + Subcategory)
app.post('/secret-admin-panel-2026/products/add', requireAdmin, upload.array('image_files', 5), csrfProtect, async (req, res) => {
  const { title, sku, category, subcategory, price, regular_price, cost_price, stock_quantity, description, seo_title, seo_description, image, variant_options } = req.body;

  const cleanTitle = sanitizeStr(title || 'Untitled Product');
  const cleanPrice = Math.max(0, parseFloat(price) || 0);
  const cleanRegPrice = Math.max(0, parseFloat(regular_price) || cleanPrice);
  const cleanCost = Math.max(0, parseFloat(cost_price) || 0);
  const cleanStock = Math.max(0, parseInt(stock_quantity, 10) || 0);

  let uploadedUrls = [];
  if (req.files && req.files.length > 0) {
    for (const f of req.files) {
      const u = await handleImageUpload(f);
      if (u) uploadedUrls.push(u);
    }
  }
  if (image && image.trim()) {
    parseImageList(image).forEach(u => uploadedUrls.push(u));
  }
  const primaryImage = uploadedUrls[0] || '';

  const productPayload = {
    title: cleanTitle,
    name: cleanTitle,
    sku: sanitizeStr(sku || `TN-${Date.now().toString().slice(-4)}`),
    category: sanitizeStr(category || 'Trending'),
    subcategory: sanitizeStr(subcategory || ''),
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: sanitizeStr(description || ''),
    seo_title: sanitizeStr(seo_title || cleanTitle),
    seo_description: sanitizeStr(seo_description || description || ''),
    image: primaryImage,
    image_url: primaryImage,
    gallery_images: JSON.stringify(uploadedUrls),
    variant_options: sanitizeStr(variant_options || ''),
    free_delivery: req.body.free_delivery === 'on' || req.body.free_delivery === 'true',
    is_archived: false,
    is_active: true,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await universalInsert('products', productPayload, productPayload);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: ' + error.message));
    await appendAuditLog(req.session.adminName, 'Product Added', `Added "${cleanTitle}" (Price: ৳${cleanPrice}, Stock: ${cleanStock})`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product added successfully!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: ' + err.message));
  }
});

// Edit Product
app.post('/secret-admin-panel-2026/products/edit/:id', requireAdmin, upload.array('image_files', 5), csrfProtect, async (req, res) => {
  const { id } = req.params;
  const { title, sku, category, subcategory, price, regular_price, cost_price, stock_quantity, description, seo_title, seo_description, image, variant_options, is_archived } = req.body;

  const cleanTitle = sanitizeStr(title || 'Untitled Product');
  const cleanPrice = Math.max(0, parseFloat(price) || 0);
  const cleanRegPrice = Math.max(0, parseFloat(regular_price) || cleanPrice);
  const cleanCost = Math.max(0, parseFloat(cost_price) || 0);
  const cleanStock = Math.max(0, parseInt(stock_quantity, 10) || 0);

  let uploadedUrls = [];
  if (req.files && req.files.length > 0) {
    for (const f of req.files) {
      const u = await handleImageUpload(f);
      if (u) uploadedUrls.push(u);
    }
  }
  if (image && image.trim()) {
    parseImageList(image).forEach(u => uploadedUrls.push(u));
  }
  const primaryImage = uploadedUrls[0] || '';

  const updatePayload = {
    title: cleanTitle,
    name: cleanTitle,
    sku: sanitizeStr(sku || `TN-${id}`),
    category: sanitizeStr(category || 'Trending'),
    subcategory: sanitizeStr(subcategory || ''),
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: sanitizeStr(description || ''),
    seo_title: sanitizeStr(seo_title || cleanTitle),
    seo_description: sanitizeStr(seo_description || description || ''),
    image: primaryImage,
    image_url: primaryImage,
    gallery_images: JSON.stringify(uploadedUrls),
    variant_options: sanitizeStr(variant_options || ''),
    free_delivery: req.body.free_delivery === 'on' || req.body.free_delivery === 'true',
    is_archived: is_archived === 'true',
    is_active: is_archived !== 'true'
  };
  // No image given in this edit: keep the images the product already has instead of wiping them.
  if (uploadedUrls.length === 0) {
    delete updatePayload.image;
    delete updatePayload.image_url;
    delete updatePayload.gallery_images;
  }

  try {
    const { data: updatedRows, error } = await universalUpdate('products', id, updatePayload, updatePayload);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Update Error: ' + error.message));
    if (!updatedRows || updatedRows.length === 0) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Update Error: product not found.'));
    await appendAuditLog(req.session.adminName, 'Product Updated', `Edited Product #${id} "${cleanTitle}"`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product updated successfully!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Update Error: ' + err.message));
  }
});

// Archive / Unarchive Product
app.post('/secret-admin-panel-2026/products/archive/:id', requireAdmin, csrfProtect, async (req, res) => {
  const { id } = req.params;
  const archiveState = req.body.archive === 'true';
  try {
    const { error } = await universalUpdate('products', id, { is_archived: archiveState, is_active: !archiveState }, { is_archived: archiveState });
    if (error) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Archive failed: ' + error.message));
    }
    await appendAuditLog(req.session.adminName, 'Product Archive Toggle', `Product #${id} archived=${archiveState}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(`Product #${id} ${archiveState ? 'archived' : 'restored'}!`));
  } catch (e) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Archive failed.'));
  }
});

// Stock Adjustment with History Log
app.post('/secret-admin-panel-2026/inventory/adjust', requireAdmin, csrfProtect, async (req, res) => {
  const { product_id, adjustment_type, quantity, reason } = req.body;
  try {
    const { data: rawProd } = await supabase.from('products').select('*').eq('id', product_id).single();
    if (!rawProd) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product not found!'));
    const prod = normalizeProduct(rawProd);
    const delta = parseInt(quantity, 10) || 0;
    const newStock = adjustment_type === 'set'
      ? Math.max(0, delta)
      : Math.max(0, prod.stock_quantity + (adjustment_type === 'subtract' ? -delta : delta));

    const { error: stockErr } = await universalUpdate('products', product_id, { stock_quantity: newStock }, { stock_quantity: newStock });
    if (stockErr) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Stock adjustment failed: ' + stockErr.message));
    }

    const settings = await getSettings();
    let stockLogs = [];
    if (settings.stock_history_logs) {
      try { stockLogs = JSON.parse(settings.stock_history_logs); } catch (e) {}
    }
    stockLogs.unshift({
      time: new Date().toISOString(),
      actor: req.session.adminName || 'Admin',
      product: prod.title,
      oldStock: prod.stock_quantity,
      newStock,
      reason: sanitizeStr(reason || 'Manual adjustment')
    });
    stockLogs = stockLogs.slice(0, 100);
    await supabase.from('settings').upsert({ key: 'stock_history_logs', value: JSON.stringify(stockLogs) }, { onConflict: 'key' });
    await appendAuditLog(req.session.adminName, 'Inventory Adjusted', `${prod.title}: ${prod.stock_quantity} -> ${newStock}`);

    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(`Stock updated for "${prod.title}" (${newStock} units)!`));
  } catch (e) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Stock adjustment failed.'));
  }
});

// Bulk Products Import via CSV JSON payload
app.post('/secret-admin-panel-2026/products/import-csv', requireAdmin, csrfProtect, async (req, res) => {
  const { csv_rows } = req.body;
  try {
    const rows = JSON.parse(csv_rows || '[]');
    let imported = 0;
    for (const r of rows) {
      if (!r.title) continue;
      const p = {
        title: sanitizeStr(r.title),
        name: sanitizeStr(r.title),
        sku: sanitizeStr(r.sku || `TN-${Math.floor(Math.random()*9000+1000)}`),
        category: sanitizeStr(r.category || 'Trending'),
        price: Math.max(0, parseFloat(r.price) || 0),
        regular_price: Math.max(0, parseFloat(r.regular_price) || parseFloat(r.price) || 0),
        cost_price: Math.max(0, parseFloat(r.cost_price) || 0),
        stock_quantity: Math.max(0, parseInt(r.stock_quantity, 10) || 25),
        description: sanitizeStr(r.description || ''),
        image: sanitizeStr(r.image || ''),
        created_at: new Date().toISOString()
      };
      await universalInsert('products', p, p);
      imported++;
    }
    await appendAuditLog(req.session.adminName, 'CSV Product Import', `Imported ${imported} products`);
    res.json({ success: true, imported });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.post('/secret-admin-panel-2026/products/delete/:id', requireAdmin, csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: Only SuperAdmin can permanently delete products.'));
  }
  try {
    const { error: delErr } = await supabase.from('products').delete().eq('id', req.params.id);
    if (delErr) {
      // Orders reference products (foreign key), so a product that has orders cannot be hard deleted. Archive it instead.
      const hint = /foreign key|violates/i.test(delErr.message || '') ? 'This product has orders, so it cannot be deleted. Archive it instead.' : delErr.message;
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Delete failed: ' + hint));
    }
    await appendAuditLog(req.session.adminName, 'Product Deleted', `Deleted Product #${req.params.id}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product permanently deleted.'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Delete failed.'));
  }
});

// Update Order Status + Audit History
app.post('/secret-admin-panel-2026/orders/status/:id', requireAdmin, csrfProtect, async (req, res) => {
  const orderId = req.params.id;
  const { status, consignment_id, admin_notes } = req.body;
  try {
    if (status && !ORDER_STATUSES.includes(status)) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Invalid status.'));
    }
    const { data: existingRaw } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!existingRaw) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order not found.'));
    }
    const existing = normalizeOrder(existingRaw);
    const history = existing.audit_history || [];
    const newStatus = status || existing.status;
    history.unshift({
      time: new Date().toISOString(),
      actor: req.session.adminName || 'Admin',
      status: newStatus,
      consignment_id: consignment_id || existing.consignment_id,
      note: sanitizeStr(admin_notes || '')
    });

    const updateObj = {
      status: newStatus,
      consignment_id: sanitizeStr(consignment_id || ''),
      admin_notes: sanitizeStr(admin_notes || ''),
      audit_history: JSON.stringify(history)
    };

    const { error: ordErr } = await universalUpdate('orders', orderId, updateObj, { status: newStatus });
    if (ordErr) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order update failed: ' + ordErr.message));
    }
    await syncOrderStock(existing.product_title, existing.status, newStatus);
    await appendAuditLog(req.session.adminName, 'Order Status Updated', `Order #${orderId} -> ${status}`);

    const settings = await getSettings();
    if (existing && existing.phone) {
      sendOrderSMS({
        phone: existing.phone,
        customerName: existing.customer_name,
        orderId,
        totalAmount: existing.price,
        status: newStatus,
        hotLine: settings.whatsapp_number
      });
    }

    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(`Order #${orderId} updated & logged!`));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order update failed.'));
  }
});

app.post('/secret-admin-panel-2026/orders/bulk-action', requireAdmin, csrfProtect, async (req, res) => {
  const { selected_orders, bulk_status } = req.body;
  if (!selected_orders || !bulk_status) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('No orders selected!'));
  const orderIds = Array.isArray(selected_orders) ? selected_orders : [selected_orders];
  if (!ORDER_STATUSES.includes(bulk_status)) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Invalid status.'));
  try {
    const settings = await getSettings();
    for (const id of orderIds) {
      const { data: before } = await supabase.from('orders').select('*').eq('id', id).single();
      if (!before) continue;
      const { error: bulkErr } = await universalUpdate('orders', id, { status: bulk_status }, { status: bulk_status });
      if (bulkErr) continue;
      await syncOrderStock(before.product_title || before.product_name || before.product, before.status || 'Pending', bulk_status);
      const orderData = before;
      if (orderData && orderData.phone) {
        sendOrderSMS({
          phone: orderData.phone,
          customerName: orderData.customer_name || orderData.name || 'Customer',
          orderId: orderData.id,
          totalAmount: orderData.price || orderData.total || 0,
          status: bulk_status,
          hotLine: settings.whatsapp_number
        });
      }
    }
    await appendAuditLog(req.session.adminName, 'Bulk Order Update', `Updated ${orderIds.length} orders to ${bulk_status}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(`Updated ${orderIds.length} orders to "${bulk_status}"!`));
  } catch (e) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Bulk action failed.'));
  }
});

app.post('/secret-admin-panel-2026/orders/delete/:id', requireAdmin, csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: Only SuperAdmin can delete orders.'));
  }
  try {
    await supabase.from('orders').delete().eq('id', req.params.id);
    await appendAuditLog(req.session.adminName, 'Order Deleted', `Deleted Order #${req.params.id}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order deleted.'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

// Open Graph Metadata Extractor for Social Media Management
app.post('/secret-admin-panel-2026/social/extract-og', requireAdmin, csrfProtect, async (req, res) => {
  const { target_url } = req.body;
  if (!target_url) return res.json({ success: false, message: 'URL required' });
  try {
    let parsed;
    try { parsed = new URL(target_url); } catch (e) { return res.json({ success: false, message: 'Invalid URL' }); }
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol) || host === 'localhost' || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(host) || !host.includes('.')) {
      return res.json({ success: false, message: 'This address is not allowed.' });
    }
    const response = await fetch(parsed.href, { headers: { 'User-Agent': 'Mozilla/5.0 TrendzzNowBot/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8000) });
    const html = await response.text();
    const getMeta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
             || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1] : '';
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    res.json({
      success: true,
      og: {
        title: getMeta('og:title') || (titleMatch ? titleMatch[1] : ''),
        description: getMeta('og:description') || getMeta('description') || '',
        image: getMeta('og:image') || '',
        url: target_url
      }
    });
  } catch (e) {
    res.json({ success: false, message: 'Could not fetch URL metadata: ' + e.message });
  }
});

app.post('/secret-admin-panel-2026/settings/update', requireAdmin, upload.fields([{ name: 'logo_file', maxCount: 1 }, { name: 'hero_file', maxCount: 1 }]), csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: Only SuperAdmin can change store settings.'));
  }
  const settingsData = { ...req.body };
  delete settingsData._csrf;
  // These keys hold credentials and system logs. They are changed only through their own routes.
  PROTECTED_SETTING_KEYS.forEach(k => delete settingsData[k]);

  if (req.files && req.files['logo_file'] && req.files['logo_file'][0]) {
    const uploadedLogoUrl = await handleImageUpload(req.files['logo_file'][0]);
    if (uploadedLogoUrl) settingsData.logo_light = uploadedLogoUrl;
  }

  if (req.files && req.files['hero_file'] && req.files['hero_file'][0]) {
    const uploadedHeroUrl = await handleImageUpload(req.files['hero_file'][0]);
    if (uploadedHeroUrl) settingsData.hero_image = uploadedHeroUrl;
  }

  try {
    const rows = Object.entries(settingsData).map(([key, value]) => ({ key, value: typeof value === 'string' ? value.trim() : String(value) }));
    if (rows.length) {
      const { error: setErr } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (setErr) throw setErr;
    }
    await appendAuditLog(req.session.adminName, 'Settings Updated', `Updated ${Object.keys(settingsData).length} configuration keys`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('All settings saved to database!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error saving settings.'));
  }
});

app.post('/secret-admin-panel-2026/password/change', requireAdmin, csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: Only SuperAdmin can change master password.'));
  }
  const { new_password, confirm_password } = req.body;
  if (!new_password || new_password.trim().length < 6) {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Password must be at least 6 characters!'));
  }
  if (new_password.trim() !== confirm_password.trim()) {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Passwords do not match!'));
  }
  try {
    const { error: pwErr } = await supabase.from('settings').upsert({ key: 'admin_password', value: hashPassword(new_password.trim()) }, { onConflict: 'key' });
    if (pwErr) throw pwErr;
    await appendAuditLog(req.session.adminName, 'Master Password Changed', 'Updated master administrator password');
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Master password updated!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Failed to update password.'));
  }
});

app.post('/secret-admin-panel-2026/subadmin/add', requireAdmin, csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') {
    return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: Only SuperAdmin can manage staff roles.'));
  }
  const { sub_name, sub_pass, sub_role } = req.body;
  if (!sub_name || !sub_pass) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Name and password required!'));
  if (String(sub_pass).trim().length < 6) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Staff password must be at least 6 characters!'));
  const safeRole = ['OrderManager', 'InventoryStaff'].includes(sub_role) ? sub_role : 'OrderManager';
  try {
    const settings = await getSettings();
    let subAdmins = [];
    if (settings.sub_admins) {
      try { subAdmins = JSON.parse(settings.sub_admins); } catch(e){}
    }
    if (subAdmins.some(s => s.name === sanitizeStr(sub_name))) {
      return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('A staff account with this name already exists.'));
    }
    subAdmins.push({ name: sanitizeStr(sub_name), password: hashPassword(String(sub_pass).trim()), role: safeRole, created: new Date().toISOString() });
    const { error: saErr } = await supabase.from('settings').upsert({ key: 'sub_admins', value: JSON.stringify(subAdmins) }, { onConflict: 'key' });
    if (saErr) throw saErr;
    await appendAuditLog(req.session.adminName, 'Sub-Admin Created', `Added ${sub_name} (${sub_role})`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Staff role account created!'));
  } catch(e) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Failed to add sub-admin.'));
  }
});

app.post('/secret-admin-panel-2026/subadmin/delete', requireAdmin, csrfProtect, async (req, res) => {
  if (req.session.adminRole !== 'SuperAdmin') return res.redirect('/secret-admin-panel-2026/dashboard');
  const { sub_name } = req.body;
  try {
    const settings = await getSettings();
    let subAdmins = [];
    if (settings.sub_admins) {
      try { subAdmins = JSON.parse(settings.sub_admins); } catch(e){}
    }
    subAdmins = subAdmins.filter(s => s.name !== sub_name);
    await supabase.from('settings').upsert({ key: 'sub_admins', value: JSON.stringify(subAdmins) }, { onConflict: 'key' });
    await appendAuditLog(req.session.adminName, 'Sub-Admin Removed', `Removed ${sub_name}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Staff account removed.'));
  } catch (e) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

require('./features').registerErrorHandlers(app, { getSettings });

app.listen(PORT, () => {
  console.log(`TrendzzNow Enterprise Server v22 running on port ${PORT}`);
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /\nDisallow: /secret-admin-panel-2026\nSitemap: https://www.trendzznow.com/sitemap.xml\n");
});
