'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const uid = (n = 6) => crypto.randomBytes(n).toString('hex');
const nowIso = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function slugify(s, fallback = 'item') {
  const base = String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : fallback;
}

function uniqueSlug(list, base, selfId) {
  let slug = base;
  let i = 2;
  while (list.some((x) => x.slug === slug && x.id !== selfId)) slug = `${base}-${i++}`;
  return slug;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${h}`;
}

function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':');
  const x = crypto.scryptSync(String(pw), salt, 64);
  const y = Buffer.from(h, 'hex');
  return y.length === x.length && crypto.timingSafeEqual(x, y);
}

function randomPassword(len = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function parseCookies(req) {
  const o = {};
  String(req.headers.cookie || '')
    .split(';')
    .forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) {
        try {
          o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
        } catch (e) {
          /* ignore bad cookie */
        }
      }
    });
  return o;
}

function rateLimit({ max, windowMs, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const t = Date.now();
    for (const [k, arr] of hits) {
      const fresh = arr.filter((x) => t - x < windowMs);
      if (fresh.length) hits.set(k, fresh);
      else hits.delete(k);
    }
  }, Math.max(windowMs, 60000));
  timer.unref();
  return (req, res, next) => {
    if (process.env.NO_RATE_LIMIT === '1') return next();
    const key = req.ip || 'x';
    const t = Date.now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) {
      res.status(429).json({
        error: 'too_many_requests',
        message: message || 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন।',
      });
      return;
    }
    arr.push(t);
    hits.set(key, arr);
    next();
  };
}

const IMAGE_KINDS = [
  ['image/jpeg', 'jpg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', 'png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/webp', 'webp', (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'],
  ['image/gif', 'gif', (b) => b.slice(0, 3).toString() === 'GIF'],
];

function saveDataUrlImage(dataUrl, uploadsDir, opts = {}) {
  const maxBytes = opts.maxBytes || 3 * 1024 * 1024;
  const prefix = opts.prefix || '';
  const s = String(dataUrl || '');
  const marker = ';base64,';
  const idx = s.indexOf(marker);
  if (!s.startsWith('data:image/') || idx < 0 || idx > 40) throw new HttpError(400, 'invalid_image', 'ছবিটি ঠিক নেই।');
  const buf = Buffer.from(s.slice(idx + marker.length), 'base64');
  if (buf.length < 12) throw new HttpError(400, 'invalid_image', 'ছবিটি ঠিক নেই।');
  if (buf.length > maxBytes) throw new HttpError(413, 'image_too_large', 'ছবির সাইজ অনেক বড়।');
  const kind = IMAGE_KINDS.find((k) => k[2](buf));
  if (!kind) throw new HttpError(400, 'invalid_image', 'শুধু JPG, PNG, WebP বা GIF ছবি দেওয়া যাবে।');
  const name = `${prefix}${Date.now().toString(36)}-${uid(5)}.${kind[1]}`;
  fs.writeFileSync(path.join(uploadsDir, name), buf);
  return `/uploads/${name}`;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function normPhone(p) {
  let s = String(p || '')
    .replace(/[\s\-().]/g, '')
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  if (s.startsWith('+88')) s = s.slice(3);
  else if (s.startsWith('88') && s.length === 13) s = s.slice(2);
  return /^01[3-9]\d{8}$/.test(s) ? s : null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(arr) {
  return arr.map(csvCell).join(',');
}

function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function clampInt(v, min, max, def) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return def === undefined ? min : def;
  return Math.min(max, Math.max(min, n));
}

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  HttpError, uid, nowIso, sha256, slugify, uniqueSlug, hashPassword, verifyPassword, randomPassword,
  parseCookies, rateLimit, saveDataUrlImage, normPhone, escapeHtml, escapeXml, csvCell, csvRow,
  jsonForScript, clampInt, num, str, stripTags, wrap,
};
