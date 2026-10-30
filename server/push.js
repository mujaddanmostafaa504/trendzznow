'use strict';
// Web Push helper (browser notifications for customers and the shop owner).
const webpush = require('web-push');
const db = require('./db');
const { uid, nowIso } = require('./util');

function ensureKeys() {
  const d = db.data;
  d.push = d.push || {};
  if (!d.push.publicKey || !d.push.privateKey) {
    const k = webpush.generateVAPIDKeys();
    d.push.publicKey = k.publicKey;
    d.push.privateKey = k.privateKey;
    db.save();
  }
  d.pushSubs = d.pushSubs || [];
}

function subject() {
  const s = db.data.settings;
  const url = String(s.siteUrl || '');
  if (/^https:\/\//.test(url)) return url;
  const email = s.contact && s.contact.email;
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return `mailto:${email}`;
  return 'mailto:owner@example.com';
}

function publicKey() {
  ensureKeys();
  return db.data.push.publicKey;
}

function addSub({ subscription, role = 'customer', order, lang }) {
  ensureKeys();
  if (!subscription || typeof subscription.endpoint !== 'string' || !/^https:\/\//.test(subscription.endpoint)) return null;
  const keys = subscription.keys || {};
  if (!keys.p256dh || !keys.auth) return null;
  let sub = db.data.pushSubs.find((x) => x.endpoint === subscription.endpoint);
  if (!sub) {
    sub = { id: uid(5), role, endpoint: subscription.endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, orders: [], lang: lang === 'en' ? 'en' : 'bn', createdAt: nowIso() };
    db.data.pushSubs.push(sub);
  }
  if (role === 'admin') sub.role = 'admin';
  if (lang) sub.lang = lang === 'en' ? 'en' : 'bn';
  if (order && !sub.orders.includes(order)) sub.orders.push(order);
  sub.orders = sub.orders.slice(-30);
  db.save();
  return sub;
}

function removeSub(endpoint) {
  ensureKeys();
  const before = db.data.pushSubs.length;
  db.data.pushSubs = db.data.pushSubs.filter((x) => x.endpoint !== endpoint);
  if (db.data.pushSubs.length !== before) db.save();
}

async function sendOne(sub, payload) {
  ensureKeys();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, vapidDetails: { subject: subject(), publicKey: db.data.push.publicKey, privateKey: db.data.push.privateKey } }
    );
    return true;
  } catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) removeSub(sub.endpoint);
    else console.error('[push] send failed:', e && (e.statusCode || e.message));
    return false;
  }
}

async function sendMany(subs, payloadFor) {
  let ok = 0;
  const queue = subs.slice();
  const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      if (await sendOne(s, payloadFor(s))) ok++;
    }
  });
  await Promise.all(workers);
  return { sent: ok, total: subs.length };
}

function notifyAdmins(payload) {
  ensureKeys();
  const subs = db.data.pushSubs.filter((s) => s.role === 'admin');
  if (!subs.length) return Promise.resolve({ sent: 0, total: 0 });
  return sendMany(subs, () => payload);
}

function notifyOrder(number, payloadFor) {
  ensureKeys();
  const subs = db.data.pushSubs.filter((s) => s.role === 'customer' && s.orders.includes(number));
  if (!subs.length) return Promise.resolve({ sent: 0, total: 0 });
  return sendMany(subs, payloadFor);
}

function broadcast(payload) {
  ensureKeys();
  const subs = db.data.pushSubs.filter((s) => s.role === 'customer');
  return sendMany(subs, () => payload);
}

function stats() {
  ensureKeys();
  return {
    customers: db.data.pushSubs.filter((s) => s.role === 'customer').length,
    admins: db.data.pushSubs.filter((s) => s.role === 'admin').length,
  };
}

module.exports = { ensureKeys, publicKey, addSub, removeSub, notifyAdmins, notifyOrder, broadcast, stats };
