'use strict';
// HTML shell with per-page meta tags (Open Graph), sitemap, manifest and product feeds.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const U = require('./util');
const dom = require('./domain');
const { FONTS } = require('./defaults');

const SHELL_FILE = path.join(__dirname, 'shell.html');
let shellCache = { mtime: 0, html: '' };
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
let verCache = { at: 0, v: '1' };

// version string that changes whenever a css/js/html file changes (cache busting)
function assetVersionNow() {
  const t = Date.now();
  if (t - verCache.at < 2000) return verCache.v;
  let max = 0;
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) walk(full);
      else if (/\.(js|css|html)$/.test(f.name)) max = Math.max(max, fs.statSync(full).mtimeMs);
    }
  };
  try {
    walk(path.join(PUBLIC_DIR, 'js'));
    walk(path.join(PUBLIC_DIR, 'css'));
    max = Math.max(max, fs.statSync(SHELL_FILE).mtimeMs);
  } catch (e) {
    max = t;
  }
  verCache = { at: t, v: Math.floor(max).toString(36) };
  return verCache.v;
}

function shell() {
  const st = fs.statSync(SHELL_FILE);
  if (st.mtimeMs !== shellCache.mtime) shellCache = { mtime: st.mtimeMs, html: fs.readFileSync(SHELL_FILE, 'utf8') };
  return shellCache.html;
}

function siteUrl(req) {
  const s = db.data.settings.siteUrl;
  if (s) return s.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function absUrl(base, u) {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) return u;
  return base + encodeURI(u);
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function onColor(hex) {
  const L = luminance(hex);
  const white = 1.05 / (L + 0.05);
  const dark = (L + 0.05) / (luminance('#17142e') + 0.05);
  return white >= dark ? '#ffffff' : '#17142e';
}

function fontStack(name) {
  return `"${name}","Hind Siliguri","Nirmala UI","Noto Sans Bengali",system-ui,-apple-system,"Segoe UI",sans-serif`;
}

function brandCss(b) {
  const radius = { sharp: ['4px', '8px'], soft: ['12px', '20px'], round: ['18px', '28px'] }[b.radius] || ['12px', '20px'];
  return `:root{--primary:${b.primary};--accent:${b.accent};--ink:${b.ink};--on-primary:${onColor(b.primary)};--on-accent:${onColor(b.accent)};--font-head:${fontStack(b.headingFont)};--font-body:${fontStack(b.bodyFont)};--r:${radius[0]};--r-lg:${radius[1]};--card-ratio:${b.cardRatio}}`;
}

function trackingHead(m) {
  let out = '';
  if (m.fbPixelId) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m.fbPixelId}');fbq('track','PageView');</script>`;
  }
  if (m.tiktokPixelId) {
    out += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${m.tiktokPixelId}');ttq.page()}(window,document,'ttq');</script>`;
  }
  if (m.ga4Id) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${m.ga4Id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${m.ga4Id}');</script>`;
  }
  return out;
}

function mdToPlain(s) {
  return U.stripTags(String(s || '').replace(/[#*_`>\[\]()]/g, ' ')).replace(/\s+/g, ' ').trim();
}

function metaFor(req, base) {
  const S = db.data.settings;
  const p = req.path;
  const tag = S.tagline.bn || '';
  const meta = {
    title: `${S.siteName} | ${tag}`,
    desc: `${S.siteName}: ${tag}। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।`,
    image: '',
    type: 'website',
    noindex: false,
    status: 200,
    jsonld: null,
    extra: '',
  };
  const banner = db.data.banners.filter((b) => b.active).sort((a, b) => a.sort - b.sort)[0];
  meta.image = absUrl(base, S.appIcon512 || (banner && banner.image) || S.logo || '/img/og-default.png');
  meta.url = base + (req.originalUrl.split('?')[0] === '/' ? '/' : req.originalUrl.split('?')[0]);

  let m;
  if ((m = /^\/p\/([^/]+)\/?$/.exec(p))) {
    const slug = decodeURIComponent(m[1]);
    const prod = db.data.products.find((x) => (x.slug === slug || x.id === slug) && x.status === 'active');
    if (!prod) {
      meta.status = 404;
      meta.noindex = true;
      meta.title = `পণ্যটি পাওয়া যায়নি | ${S.siteName}`;
      return meta;
    }
    const card = dom.cardOf(prod);
    const plain = mdToPlain(prod.description).slice(0, 180);
    const priceText = `৳${prod.price}`;
    meta.title = prod.seoTitle || `${prod.name} | ${S.siteName}`;
    meta.desc = prod.seoDesc || `${priceText}${card.discount ? ` (${card.discount}% ছাড়)` : ''}. ${plain || prod.name}`.slice(0, 200);
    meta.image = absUrl(base, prod.images[0] || meta.image);
    meta.type = 'product';
    meta.url = `${base}/p/${encodeURIComponent(prod.slug)}`;
    const inStock = dom.totalStock(prod) > 0;
    meta.extra =
      `<meta property="product:price:amount" content="${prod.price}"><meta property="product:price:currency" content="BDT">` +
      `<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}"><meta property="product:condition" content="new">` +
      (prod.brand ? `<meta property="product:brand" content="${U.escapeHtml(prod.brand)}">` : '');
    meta.jsonld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: prod.name,
      image: prod.images.map((i) => absUrl(base, i)),
      description: plain || prod.name,
      sku: prod.sku || prod.id,
      ...(prod.brand ? { brand: { '@type': 'Brand', name: prod.brand } } : {}),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BDT',
        price: String(prod.price),
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: meta.url,
      },
      ...(prod.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: prod.ratingAvg, reviewCount: prod.ratingCount } } : {}),
    };
  } else if ((m = /^\/c\/([^/]+)\/?$/.exec(p))) {
    const slug = decodeURIComponent(m[1]);
    const c = db.data.categories.find((x) => x.slug === slug && x.active !== false);
    if (!c) {
      meta.status = 404;
      meta.noindex = true;
    } else {
      meta.title = `${c.name} | ${S.siteName}`;
      meta.desc = `${c.name} এর সেরা কালেকশন, সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।`;
      if (c.image) meta.image = absUrl(base, c.image);
      meta.url = `${base}/c/${encodeURIComponent(c.slug)}`;
    }
  } else if ((m = /^\/page\/([^/]+)\/?$/.exec(p))) {
    const pg = db.data.pages.find((x) => x.slug === decodeURIComponent(m[1]));
    if (!pg) {
      meta.status = 404;
      meta.noindex = true;
    } else {
      meta.title = `${pg.title} | ${S.siteName}`;
      meta.desc = mdToPlain(pg.body).slice(0, 180);
    }
  } else if (p === '/shop' || p === '/categories') {
    meta.title = `${p === '/shop' ? 'সব পণ্য' : 'ক্যাটাগরি'} | ${S.siteName}`;
    if (req.query.q || Object.keys(req.query).length) meta.noindex = true;
  } else if (/^\/(cart|checkout|account|track|wishlist|compare|search|order)(\/|$)/.test(p)) {
    meta.noindex = true;
    meta.title = `${S.siteName}`;
  } else if (p !== '/') {
    meta.status = 404;
    meta.noindex = true;
  }
  return meta;
}

function renderShell(req, res) {
  const S = db.data.settings;
  const base = siteUrl(req);
  const meta = metaFor(req, base);
  const E = U.escapeHtml;
  let head = `<title>${E(meta.title)}</title><meta name="description" content="${E(meta.desc)}">`;
  head += `<link rel="canonical" href="${E(meta.url || base + req.path)}">`;
  if (meta.noindex) head += '<meta name="robots" content="noindex,follow">';
  head += `<meta property="og:site_name" content="${E(S.siteName)}"><meta property="og:type" content="${meta.type}">`;
  head += `<meta property="og:title" content="${E(meta.title)}"><meta property="og:description" content="${E(meta.desc)}">`;
  head += `<meta property="og:url" content="${E(meta.url || base)}"><meta property="og:image" content="${E(meta.image)}"><meta property="og:locale" content="bn_BD">`;
  head += `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${E(meta.title)}"><meta name="twitter:description" content="${E(meta.desc)}"><meta name="twitter:image" content="${E(meta.image)}">`;
  head += meta.extra || '';
  if (meta.jsonld) head += `<script type="application/ld+json">${U.jsonForScript(meta.jsonld)}</script>`;
  if (req.path === '/') {
    head += `<script type="application/ld+json">${U.jsonForScript({ '@context': 'https://schema.org', '@type': 'Organization', name: S.siteName, url: base, logo: absUrl(base, S.logo || S.appIcon512 || '/img/icon-512.png') })}</script>`;
  }

  const icon192 = S.appIcon192 || S.appIcon512 || '/img/icon-192.png';
  const boot = {
    settings: dom.publicSettings(),
    categories: db.data.categories
      .filter((c) => c.active !== false)
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...dom.catBrief(c), image: c.image || '', count: db.data.products.filter((p) => p.status === 'active' && p.categoryId === c.id).length })),
    banners: db.data.banners.filter((b) => b.active).sort((a, b) => a.sort - b.sort),
    pages: db.data.pages.map((p) => ({ slug: p.slug, title: p.title, titleEn: p.titleEn || '' })),
    vapid: require('./push').publicKey(),
    v: assetVersionNow(),
    siteUrl: base,
  };

  const map = {
    LANG: S.defaultLang,
    THEME: S.defaultTheme,
    HEAD: head,
    FAVICON: E(icon192),
    PRIMARY: S.brand.primary,
    FONT_LINK: dom.fontsUrl(S)
      ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${E(dom.fontsUrl(S))}">`
      : '',
    BRAND_CSS: brandCss(S.brand),
    TRACKING: trackingHead(S.marketing),
    BOOT: U.jsonForScript(boot),
    V: assetVersionNow(),
  };
  // single pass so text inside the injected values is never treated as a placeholder
  const html = shell().replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m));
  res.status(meta.status).set('Cache-Control', 'no-cache').type('html').send(html);
}

/* ---------------- sitemap / robots / manifest ---------------- */

function sitemap(req, res) {
  const base = siteUrl(req);
  const urls = [{ loc: base + '/', pr: '1.0' }, { loc: base + '/shop', pr: '0.8' }];
  db.data.categories.filter((c) => c.active !== false).forEach((c) => urls.push({ loc: `${base}/c/${encodeURIComponent(c.slug)}`, pr: '0.7' }));
  db.data.products.filter((p) => p.status === 'active').forEach((p) => urls.push({ loc: `${base}/p/${encodeURIComponent(p.slug)}`, pr: '0.9', mod: (p.updatedAt || p.createdAt || '').slice(0, 10) }));
  db.data.pages.forEach((p) => urls.push({ loc: `${base}/page/${encodeURIComponent(p.slug)}`, pr: '0.3' }));
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `<url><loc>${U.escapeXml(u.loc)}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.pr}</priority></url>`).join('\n') +
    '\n</urlset>';
  res.type('application/xml').send(xml);
}

function robots(req, res) {
  const base = siteUrl(req);
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /track\nDisallow: /order/\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
}

function manifest(req, res) {
  const S = db.data.settings;
  const i192 = S.appIcon192 || S.appIcon512 || '/img/icon-192.png';
  const i512 = S.appIcon512 || S.appIcon192 || '/img/icon-512.png';
  const custom = !!(S.appIcon192 || S.appIcon512);
  const icons = [
    { src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ];
  if (!custom) icons.push({ src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  res.type('application/manifest+json').set('Cache-Control', 'no-cache').json({
    name: `${S.siteName} | ${S.tagline.bn}`,
    short_name: S.siteName.slice(0, 12),
    description: S.tagline.bn,
    lang: S.defaultLang === 'en' ? 'en' : 'bn',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: S.brand.primary,
    icons,
    shortcuts: [
      { name: 'Cart', url: '/cart', icons: [{ src: i192, sizes: '192x192' }] },
      { name: 'Track order', url: '/track', icons: [{ src: i192, sizes: '192x192' }] },
    ],
  });
}

/* ---------------- product feeds (Meta / TikTok / Google) ---------------- */

function feedRows(req) {
  const base = siteUrl(req);
  const S = db.data.settings;
  const rows = [];
  for (const p of db.data.products.filter((x) => x.status === 'active')) {
    const cat = dom.categoryById(p.categoryId);
    const link = `${base}/p/${encodeURIComponent(p.slug)}`;
    const imgs = p.images.map((i) => absUrl(base, i));
    if (!imgs.length) continue; // catalogs reject items without a photo
    const desc = (mdToPlain(p.description) || p.name).slice(0, 4900);
    const common = { title: p.name.slice(0, 150), description: desc, link, image: imgs[0], extra: imgs.slice(1, 10), brand: p.brand || S.siteName, category: cat ? cat.name : '', group: p.id };
    if (p.variants.length) {
      p.variants.forEach((v) => {
        const vp = v.price == null ? p.price : v.price;
        const lowerKeys = Object.keys(v.values).reduce((a, k) => ((a[k.toLowerCase()] = v.values[k]), a), {});
        rows.push({
          ...common,
          id: `${p.id}-${U.sha256(v.key).slice(0, 6)}`,
          title: `${p.name} (${v.label})`.slice(0, 150),
          inStock: v.stock > 0,
          qty: v.stock,
          price: p.comparePrice && p.comparePrice > vp ? p.comparePrice : vp,
          sale: p.comparePrice && p.comparePrice > vp ? vp : 0,
          size: lowerKeys.size || lowerKeys['সাইজ'] || '',
          color: lowerKeys.color || lowerKeys.colour || lowerKeys['রঙ'] || lowerKeys['কালার'] || '',
          link: `${link}?variant=${encodeURIComponent(v.key)}`,
        });
      });
    } else {
      rows.push({
        ...common,
        id: p.id,
        inStock: p.stock > 0,
        qty: p.stock,
        price: p.comparePrice && p.comparePrice > p.price ? p.comparePrice : p.price,
        sale: p.comparePrice && p.comparePrice > p.price ? p.price : 0,
        size: '',
        color: '',
      });
    }
  }
  return rows;
}

const money = (n) => `${Number(n).toFixed(2)} BDT`;

function feedXml(req, res) {
  const base = siteUrl(req);
  const S = db.data.settings;
  const items = feedRows(req)
    .map(
      (r) =>
        `<item><g:id>${U.escapeXml(r.id)}</g:id><g:title>${U.escapeXml(r.title)}</g:title><g:description>${U.escapeXml(r.description)}</g:description>` +
        `<g:link>${U.escapeXml(r.link)}</g:link><g:image_link>${U.escapeXml(r.image)}</g:image_link>` +
        r.extra.map((e) => `<g:additional_image_link>${U.escapeXml(e)}</g:additional_image_link>`).join('') +
        `<g:availability>${r.inStock ? 'in stock' : 'out of stock'}</g:availability><g:condition>new</g:condition><g:price>${money(r.price)}</g:price>` +
        (r.sale ? `<g:sale_price>${money(r.sale)}</g:sale_price>` : '') +
        `<g:brand>${U.escapeXml(r.brand)}</g:brand><g:item_group_id>${U.escapeXml(r.group)}</g:item_group_id>` +
        (r.category ? `<g:product_type>${U.escapeXml(r.category)}</g:product_type>` : '') +
        (r.size ? `<g:size>${U.escapeXml(r.size)}</g:size>` : '') +
        (r.color ? `<g:color>${U.escapeXml(r.color)}</g:color>` : '') +
        `</item>`
    )
    .join('\n');
  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${U.escapeXml(S.siteName)}</title><link>${U.escapeXml(base)}</link><description>${U.escapeXml(S.tagline.bn)}</description>\n${items}\n</channel></rss>`
    );
}

function feedCsv(kind) {
  return (req, res) => {
    const rows = feedRows(req);
    const tiktok = kind === 'tiktok';
    const head = tiktok
      ? ['sku_id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'item_group_id', 'size', 'color', 'product_type']
      : ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'item_group_id', 'size', 'color', 'product_type', 'quantity_to_sell_on_facebook'];
    const lines = [U.csvRow(head)];
    rows.forEach((r) => {
      const base = [r.id, r.title, r.description, tiktok ? (r.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK') : r.inStock ? 'in stock' : 'out of stock', 'new', money(r.price), r.sale ? money(r.sale) : '', r.link, r.image, r.extra.join(','), r.brand, r.group, r.size, r.color, r.category];
      if (!tiktok) base.push(r.qty);
      lines.push(U.csvRow(base));
    });
    res.type('text/csv; charset=utf-8').set('Content-Disposition', `inline; filename="${kind}-catalog.csv"`).send('﻿' + lines.join('\r\n'));
  };
}

module.exports = { renderShell, sitemap, robots, manifest, feedXml, feedCsv, siteUrl, assetVersionNow, onColor, brandCss };
