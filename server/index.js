'use strict';
const express = require('express');
const compression = require('compression');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('./db');
const U = require('./util');
const { buildInitial } = require('./seed');
const push = require('./push');
const seo = require('./seo');
const admin = require('./routes-admin');
const publicApi = require('./routes-public');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');

db.init(buildInitial());
const d = db.data;
d.sessions = d.sessions || {};
d.pushSubs = d.pushSubs || [];
d.blocked = d.blocked || { phones: [] };
d.messages = d.messages || [];
d.reviews = d.reviews || [];
d.coupons = d.coupons || [];
d.meta = d.meta || { seq: { order: 10000 } };
// settings added in newer versions get their default values automatically
(function fillDefaults() {
  const def = require('./defaults').defaultSettings();
  const fill = (t, s) => {
    for (const k of Object.keys(s)) {
      if (!(k in t)) t[k] = JSON.parse(JSON.stringify(s[k]));
      else if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') fill(t[k], s[k]);
    }
  };
  fill(d.settings, def);
})();
push.ensureKeys();

function printBanner(lines) {
  const w = Math.max(...lines.map((l) => l.length)) + 4;
  const bar = '+' + '-'.repeat(w) + '+';
  console.log('\n' + bar);
  lines.forEach((l) => console.log('|  ' + l.padEnd(w - 2) + '|'));
  console.log(bar + '\n');
}

function ensureAdminPassword(force) {
  if (!d.admin) d.admin = {};
  if (force || !d.admin.passHash) {
    const pw = process.env.ADMIN_PASSWORD || U.randomPassword(10);
    d.admin.passHash = U.hashPassword(pw);
    d.sessions = {};
    db.saveNow();
    printBanner(['ADMIN LOGIN', '', 'Password: ' + pw, '', 'Open /admin in your browser and use this password.', 'Change it later from Settings > Security.']);
    return pw;
  }
  return null;
}

if (process.argv.includes('--reset-admin')) {
  ensureAdminPassword(true);
  process.exit(0);
}
ensureAdminPassword(false);

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY);
app.use(compression());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

const jsonParser = express.json({ limit: '12mb' });

// product, banner and logo photos uploaded by the owner
app.use('/uploads', express.static(db.UPLOADS, { maxAge: '30d', immutable: true, index: false, fallthrough: false }));

app.get('/sw.js', (req, res) => {
  const src = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8').replace(/__VERSION__/g, seo.assetVersionNow());
  res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }).send(src);
});
app.get('/manifest.webmanifest', seo.manifest);
app.get('/sitemap.xml', seo.sitemap);
app.get('/robots.txt', seo.robots);
app.get('/feed/meta.xml', seo.feedXml);
app.get('/feed/meta.csv', seo.feedCsv('meta'));
app.get('/feed/tiktok.csv', seo.feedCsv('tiktok'));

app.use('/api/admin', jsonParser, admin.api);
app.use('/api', jsonParser, publicApi);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'পাওয়া যায়নি।' }));

app.get('/admin/invoice/:number', admin.invoicePage);
app.use('/admin', express.static(path.join(PUBLIC, 'admin'), { index: 'index.html', maxAge: 0, etag: true }));

app.use(
  express.static(PUBLIC, {
    index: false,
    setHeaders(res, file) {
      if (/\.(js|css|html|json)$/.test(file) && !/bd-geo\.json$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
      else res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

const STORE_ROUTES = ['/', '/shop', '/search', '/categories', '/c/:slug', '/p/:slug', '/page/:slug', '/cart', '/checkout', '/track', '/account', '/wishlist', '/compare', '/order/:number'];
app.get(STORE_ROUTES, seo.renderShell);
app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) return seo.renderShell(req, res);
  res.status(404).send('Not found');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isApi = req.path.startsWith('/api/');
  let status = 500;
  let body = { error: 'server_error', message: 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।' };
  if (err instanceof U.HttpError) {
    status = err.status;
    body = { error: err.code, message: err.message, ...(err.extra || {}) };
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    body = { error: 'bad_json', message: 'অনুরোধটি ঠিক নেই।' };
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    body = { error: 'too_large', message: 'ফাইলটি অনেক বড়।' };
  } else if (err && err.status === 404) {
    status = 404;
    body = { error: 'not_found', message: 'পাওয়া যায়নি।' };
  } else {
    console.error('[error]', req.method, req.originalUrl, err && err.stack ? err.stack : err);
  }
  if (isApi) res.status(status).json(body);
  else res.status(status).send(status === 404 ? 'Not found' : 'Server error');
});

const server = app.listen(PORT, () => {
  const lanIps = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const lines = [`${d.settings.siteName} is running`, '', `Store : http://localhost:${PORT}`, `Admin : http://localhost:${PORT}/admin`];
  if (lanIps.length) lines.push('', 'On your phone (same Wi-Fi):', ...lanIps.map((ip) => `        http://${ip}:${PORT}`));
  lines.push('', 'Press Ctrl+C to stop.');
  printBanner(lines);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Close the other program, or run with another port:\n  set PORT=3001 && node server/index.js\n`);
    process.exit(1);
  }
  throw e;
});
