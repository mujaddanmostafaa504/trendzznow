// Shared helpers for the admin panel.
import { h, raw, esc, md, safeUrl } from '/js/h.js';
export { h, raw, esc, md, safeUrl };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nf = new Intl.NumberFormat('en-IN');
export const money = (n) => '৳' + nf.format(Math.round(Number(n) || 0));
export const num = (n) => nf.format(Number(n) || 0);
export const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
export const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== '' && v != null && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

export const fmtDate = (iso, time = true) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString((() => { try { return localStorage.getItem('tn_alang') === 'en' ? 'en-GB' : 'bn-BD'; } catch (e) { return 'bn-BD'; } })(), { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) });
};

export const STATUS = { pending: 'নতুন', confirmed: 'কনফার্মড', processing: 'প্যাকিং', shipped: 'কুরিয়ারে', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'ফেরত' };
export const PAYST = { unpaid: 'বাকি', paid: 'পরিশোধিত', pending_verification: 'যাচাই বাকি', refunded: 'রিফান্ড', failed: 'ব্যর্থ' };
export const PAYM = { cod: 'ক্যাশ অন ডেলিভারি', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket' };
export const pill = (cls, text) => h`<span class="pl pl-${cls}">${text}</span>`;
export const statusPill = (s) => pill(s, STATUS[s] || s);

/* ---------- api ---------- */
export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || 'কিছু একটা ঠিক হয়নি।');
    this.status = status;
    this.data = body || {};
  }
}
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api/admin' + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'x-tn-admin': '1' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch (e) {
    throw new ApiError(0, { message: 'ইন্টারনেট বা সার্ভারে সমস্যা। সার্ভার চালু আছে কিনা দেখুন।' });
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* empty */
  }
  if (res.status === 401) window.dispatchEvent(new Event('tn-unauth'));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/* ---------- toast, dialogs ---------- */
export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6000 : 3000);
}
export const fail = (e) => toast(e && e.message ? e.message : 'ত্রুটি হয়েছে', 'bad');

export function openModal(content, { wide = false, title = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'mdl';
  el.innerHTML = `<div class="mdl-bg" data-x></div><div class="mdl-card${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><div class="mdl-head"><h3>${esc(title)}</h3><button type="button" class="x" data-x aria-label="বন্ধ">&times;</button></div><div class="mdl-body"></div></div>`;
  const body = $('.mdl-body', el);
  if (content && content.s != null) body.innerHTML = content.s;
  document.body.appendChild(el);
  document.documentElement.classList.add('noscroll');
  const close = () => {
    el.remove();
    if (!$('.mdl')) document.documentElement.classList.remove('noscroll');
  };
  el.addEventListener('click', (e) => e.target.closest('[data-x]') && close());
  return { el, body, close };
}

export function confirmBox(message, { ok = 'হ্যাঁ, নিশ্চিত', danger = true } = {}) {
  return new Promise((resolve) => {
    const m = openModal(h`<p class="cfm">${message}</p><div class="row end"><button class="btn" data-x data-no>না</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${ok}</button></div>`, { title: 'নিশ্চিত করুন' });
    let done = false;
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) {
        done = true;
        resolve(true);
        m.close();
      } else if (e.target.closest('[data-x]') && !done) {
        done = true;
        resolve(false);
      }
    });
  });
}

/* ---------- images ---------- */
export function resizeImage(file, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('ছবি ফাইল দিন'));
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
      reject(new Error('ছবিটি পড়া যায়নি'));
    };
    img.src = url;
  });
}
export async function uploadImage(file, max = 1600) {
  const dataUrl = await resizeImage(file, max);
  return (await api('/upload', { method: 'POST', body: { dataUrl } })).url;
}

// <input type=file> helper: pick files, upload, return urls
export function pickImages({ multiple = true, max = 1600 } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = multiple;
    inp.onchange = async () => {
      const urls = [];
      toast('ছবি আপলোড হচ্ছে...');
      for (const f of [...inp.files]) {
        try {
          urls.push(await uploadImage(f, max));
        } catch (e) {
          fail(e);
        }
      }
      resolve(urls);
    };
    inp.click();
  });
}

export const imgBox = (url, label = '') => (url ? h`<img class="thumb" src="${url}" alt="${label}">` : h`<span class="thumb ph">ছবি নেই</span>`);

export function pager(page, pages, key = 'page') {
  if (pages <= 1) return '';
  return h`<div class="pager"><button class="btn sm" data-${raw(key)}="${page - 1}" ${page <= 1 ? raw('disabled') : ''}>আগের</button><span>${page} / ${pages}</span><button class="btn sm" data-${raw(key)}="${page + 1}" ${page >= pages ? raw('disabled') : ''}>পরের</button></div>`;
}

export const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('কপি হয়েছে');
  } catch (e) {
    toast('কপি করা যায়নি', 'bad');
  }
};
export const waLink = (phone, text = '') => `https://wa.me/88${String(phone).replace(/^\+?88/, '')}${text ? '?text=' + encodeURIComponent(text) : ''}`;

// read a form into a plain object (checkboxes become booleans)
export function formData(form) {
  const o = {};
  [...form.elements].forEach((el) => {
    if (!el.name || el.disabled) return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) o[el.name] = el.value;
    } else o[el.name] = el.value;
  });
  return o;
}
