import { addDict } from './a-i18n.js';
import { h, raw, $, $$, api, toast, fail, confirmBox, pickImages, imgBox, openModal } from './a-core.js';

const TABS = [['brand', 'ব্র্যান্ড ও ডিজাইন'], ['contact', 'যোগাযোগ ও সোশ্যাল'], ['shipping', 'ডেলিভারি'], ['payments', 'পেমেন্ট ও ব্যাজ'], ['marketing', 'মার্কেটিং ও পিক্সেল'], ['policies', 'নিয়ম'], ['push', 'নোটিফিকেশন'], ['account', 'পাসওয়ার্ড ও ডেটা']];
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setp = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => (c = c[k] = c[k] || {})); c[ks.at(-1)] = v; };

export async function render(el, ctx) {
  const { settings: S, fonts, districts } = await api('/settings');
  if (!ctx.alive()) return;
  addDict(Object.fromEntries(districts.flatMap((d) => [[d.bn, d.en], ...d.districts.map((x) => [x.bn, x.en])])));
  let tab = el._tab || 'brand';
  const f = (path, label, { type = 'text', hint = '', ph = '', area = false } = {}) => h`<label class="f">${label}${hint ? h`<small>${hint}</small>` : ''}${area ? h`<textarea data-p="${path}" rows="2">${get(S, path) || ''}</textarea>` : h`<input data-p="${path}" type="${type}" value="${get(S, path) == null ? '' : get(S, path)}" placeholder="${ph}">`}</label>`;
  const chk = (path, label) => h`<label class="chk"><input type="checkbox" data-p="${path}" ${get(S, path) ? raw('checked') : ''}> ${label}</label>`;
  const sel = (path, label, opts) => h`<label class="f">${label}<select data-p="${path}">${opts.map(([k, v]) => h`<option value="${k}" ${get(S, path) === k ? raw('selected') : ''}>${v}</option>`)}</select></label>`;
  const img = (path, label, hint) => h`<div class="f"><b>${label}</b>${hint ? h`<small>${hint}</small>` : ''}<div class="row" data-imgf="${path}">${imgBox(get(S, path))}<button type="button" class="btn sm" data-pick>বদলান</button>${get(S, path) ? h`<button type="button" class="btn sm" data-clr>সরান</button>` : ''}</div></div>`;
  const col = (path, label) => h`<label class="f">${label}<span class="row"><input type="color" data-p="${path}" value="${get(S, path)}" style="width:54px;height:38px;padding:2px"><input data-pc="${path}" value="${get(S, path)}" style="width:110px"></span></label>`;

  const panels = {
    brand: () => h`<div class="card"><h2>নাম ও লোগো</h2><div class="g2">${f('siteName', 'দোকানের নাম')}${f('orderPrefix', 'অর্ডার নম্বরের প্রিফিক্স', { hint: 'যেমন TN → TN10001' })}</div><div class="g2">${f('tagline.bn', 'ট্যাগলাইন (বাংলা)')}${f('tagline.en', 'Tagline (English)')}</div>
${f('siteUrl', 'ওয়েবসাইটের ঠিকানা', { hint: 'ডোমেইন পেলে লিখুন, যেমন https://trendzznow.com। শেয়ার প্রিভিউ ও ফিডের লিংকে এটা ব্যবহার হয়', ph: 'https://' })}
<div class="g2">${img('logo', 'লোগো (হালকা থিম)', 'স্বচ্ছ ব্যাকগ্রাউন্ডের PNG ভালো')}${img('logoDark', 'লোগো (ডার্ক থিম)', 'খালি রাখলে একই লোগো')}</div><div class="g2">${img('appIcon512', 'অ্যাপ আইকন (বর্গাকার, ৫১২px)', 'হোম স্ক্রিনে যে আইকন বসবে')}</div></div>
<div class="card"><h2>রঙ ও ফন্ট</h2><div class="g3">${col('brand.primary', 'প্রধান রঙ')}${col('brand.accent', 'অ্যাকসেন্ট রঙ')}${col('brand.ink', 'লেখার গাঢ় রঙ')}</div><div class="g2">${sel('brand.headingFont', 'হেডিং ফন্ট', fonts.map((x) => [x, x]))}${sel('brand.bodyFont', 'বডি ফন্ট', fonts.map((x) => [x, x]))}</div><div class="g3">${sel('brand.radius', 'কোণের ধরন', [['sharp', 'ধারালো'], ['soft', 'নরম'], ['round', 'গোল']])}${sel('brand.cardRatio', 'প্রোডাক্ট ছবির অনুপাত', [['1 / 1', 'বর্গ'], ['4 / 5', 'লম্বা (৪:৫)'], ['3 / 4', 'আরও লম্বা (৩:৪)']])}${sel('defaultTheme', 'ডিফল্ট থিম', [['system', 'ডিভাইস অনুযায়ী'], ['light', 'লাইট'], ['dark', 'ডার্ক']])}</div>${sel('defaultLang', 'ডিফল্ট ভাষা', [['bn', 'বাংলা'], ['en', 'English']])}</div>
<div class="card"><h2>উপরের ঘোষণা বার</h2>${chk('announcement.enabled', 'দেখান')}${f('announcement.text.bn', 'লেখা (বাংলা)')}${f('announcement.text.en', 'Text (English)')}${f('announcement.link', 'লিংক (ঐচ্ছিক)', { ph: '/shop' })}</div>`,
    contact: () => h`<div class="card"><h2>যোগাযোগ</h2><div class="g2">${f('contact.phone', 'ফোন', { type: 'tel' })}${f('contact.whatsapp', 'WhatsApp নম্বর', { type: 'tel', hint: 'অর্ডার বাটনে ব্যবহার হবে' })}</div><div class="g2">${f('contact.messenger', 'Messenger ইউজারনেম', { hint: 'facebook.com/xxxx এর xxxx অংশ' })}${f('contact.email', 'ইমেইল', { type: 'email' })}</div><div class="g2">${f('contact.address.bn', 'ঠিকানা (বাংলা)')}${f('contact.address.en', 'Address (English)')}</div><div class="g2">${f('contact.hours.bn', 'সময় (বাংলা)')}${f('contact.hours.en', 'Hours (English)')}</div></div>
<div class="card"><h2>সোশ্যাল লিংক</h2>${['facebook', 'instagram', 'tiktok', 'youtube'].map((k) => f('social.' + k, k[0].toUpperCase() + k.slice(1) + ' পেজের লিংক', { ph: 'https://' }))}</div>
<div class="card"><h2>ব্যবসার তথ্য (ইনভয়েসে)</h2><div class="g2">${f('legal.tradeLicense', 'ট্রেড লাইসেন্স')}${f('legal.bin', 'BIN')}</div></div>`,
    shipping: () => h`<div class="card"><h2>ডেলিভারি চার্জ</h2><div class="g3">${f('shipping.insideFee', 'ঢাকার ভেতরে (৳)', { type: 'number' })}${f('shipping.outsideFee', 'ঢাকার বাইরে (৳)', { type: 'number' })}${f('shipping.freeAbove', 'এর বেশি অর্ডারে ফ্রি (৳)', { type: 'number', hint: '0 = কখনো ফ্রি না' })}</div>
<div class="g2">${f('shipping.etaInside.bn', 'ঢাকার ভেতরে সময় (বাংলা)')}${f('shipping.etaInside.en', 'Inside ETA (English)')}${f('shipping.etaOutside.bn', 'ঢাকার বাইরে সময় (বাংলা)')}${f('shipping.etaOutside.en', 'Outside ETA (English)')}</div></div>
<div class="card"><h2>"ঢাকার ভেতরে" ধরা হবে যে জেলাগুলো</h2><p class="hint">যেমন সাভার বা গাজীপুরেও কম চার্জ দিতে চাইলে টিক দিন।</p><div class="chips2">${districts.flatMap((d) => d.districts).map((d) => h`<label class="chk"><input type="checkbox" data-dist="${d.en}" ${S.shipping.insideDistricts.includes(d.en) ? raw('checked') : ''}> ${d.bn}</label>`)}</div></div>`,
    payments: () => h`<div class="card"><h2>পেমেন্ট পদ্ধতি</h2>${chk('payments.cod.enabled', 'ক্যাশ অন ডেলিভারি চালু')}
${['bkash', 'nagad', 'rocket'].map((k) => h`<div class="card" style="background:var(--bg)"><b>${k === 'bkash' ? 'bKash' : k === 'nagad' ? 'Nagad' : 'Rocket'}</b>${chk(`payments.${k}.enabled`, 'চালু')}<div class="g2">${f(`payments.${k}.number`, 'নম্বর', { type: 'tel' })}${sel(`payments.${k}.kind`, 'ধরন (কাস্টমার কীভাবে পাঠাবে)', [['personal', 'পার্সোনাল (Send Money)'], ['merchant', 'মার্চেন্ট (Payment)'], ['agent', 'এজেন্ট (Cash Out)']])}</div></div>`)}<p class="hint">bKash/Nagad পেমেন্ট ম্যানুয়াল: কাস্টমার টাকা পাঠিয়ে TrxID দেয়, আপনি অর্ডারে দেখে "পরিশোধিত" করবেন।</p></div>
<div class="card"><h2>ফুটারের ব্যাজ</h2><p class="hint">লোগোর ছবি না দিলে নাম লেখা ব্যাজ দেখাবে।</p>${['payment', 'courier'].map((g) => h`<h3>${g === 'payment' ? 'পেমেন্ট' : 'কুরিয়ার'}</h3>${S.badges[g].map((b, i) => h`<div class="row" style="margin-bottom:6px" data-badge="${g}.${i}">${imgBox(b.image)}<input value="${b.label}" data-bl style="width:150px"><label class="chk"><input type="checkbox" data-be ${b.enabled ? raw('checked') : ''}> দেখান</label><button type="button" class="btn sm" data-bpick>ছবি</button></div>`)}`)}</div>`,
    marketing: () => h`<div class="card"><h2>ট্র্যাকিং পিক্সেল</h2><p class="hint">শুধু আইডি বসান। Purchase, AddToCart, ViewContent ইভেন্ট নিজে থেকে যাবে।</p>${f('marketing.fbPixelId', 'Facebook Pixel ID')}${f('marketing.tiktokPixelId', 'TikTok Pixel ID')}${f('marketing.ga4Id', 'Google Analytics 4 ID', { ph: 'G-XXXXXXX' })}</div>
<div class="card"><h2>সোশ্যাল প্রুফ ও চ্যাট</h2>${chk('marketing.liveNotices', '"কেউ এইমাত্র কিনেছে" নোটিফিকেশন দেখান (শুধু সত্যিকারের অর্ডার থেকে)')}${chk('marketing.showViewers', '"এখন N জন দেখছে" দেখান (শুধু সত্যিকারের ভিজিটর)')}${chk('marketing.chatButton', 'WhatsApp/Messenger চ্যাট বাটন')}${f('marketing.lowStockThreshold', '"মাত্র N টি বাকি" দেখানোর সীমা', { type: 'number' })}${chk('reviews.autoApprove', 'রিভিউ নিজে থেকে অনুমোদন (বন্ধ থাকলে আপনি দেখে অনুমোদন করবেন)')}</div>
<div class="card"><h2>প্রোডাক্ট ফিড (Meta ও TikTok Catalog)</h2><p class="hint">Facebook/Instagram Shop বা TikTok Catalog এ "Data feed" হিসেবে এই লিংক দিন। ডোমেইন ছাড়া লোকাল থাকলে কাজ করবে না, পাবলিক ঠিকানা লাগবে।</p>${[['/feed/meta.xml', 'Meta (XML)'], ['/feed/meta.csv', 'Meta (CSV)'], ['/feed/tiktok.csv', 'TikTok (CSV)']].map(([u, l]) => h`<div class="row" style="margin-bottom:6px"><b style="width:110px">${l}</b><input readonly value="${(S.siteUrl || location.origin) + u}" class="grow"><button type="button" class="btn sm" data-cp="${(S.siteUrl || location.origin) + u}">কপি</button></div>`)}</div>`,
    policies: () => h`<div class="card"><h2>অর্ডারের নিয়ম</h2><div class="g2">${f('policies.minOrder', 'ন্যূনতম অর্ডার (৳)', { type: 'number', hint: '0 = নেই' })}${f('policies.maxOrdersPerPhonePerDay', 'একই নম্বর থেকে দিনে সর্বোচ্চ অর্ডার', { type: 'number', hint: 'ফেক অর্ডার ঠেকাতে' })}</div><p class="hint">রিটার্ন, ডেলিভারি, প্রাইভেসি লেখা বদলাতে "পেজ" মেনু থেকে এডিট করুন।</p></div>`,
    push: () => h`<div class="card"><h2>আপনার ফোনে নতুন অর্ডারের নোটিফিকেশন</h2><p class="hint">যে ডিভাইসে নোটিফিকেশন চান সেখানে অ্যাডমিন খুলে চালু করুন। HTTPS বা localhost লাগে।</p><div class="row"><button class="btn btn-primary" data-padmin>এই ডিভাইসে চালু করুন</button><button class="btn" data-ptest>টেস্ট পাঠান</button></div><p data-pstat class="hint"></p></div>
<div class="card"><h2>কাস্টমারদের নোটিফিকেশন পাঠান</h2><p class="hint">যারা সাইটে নোটিফিকেশন চালু করেছে তাদের সবাইকে যাবে। অফার বা নতুন পণ্যের জন্য।</p><form data-bc><label class="f">শিরোনাম<input name="title" maxlength="80" required></label><label class="f">মেসেজ<input name="body" maxlength="200" required></label><label class="f">লিংক<input name="url" placeholder="/shop"></label><button class="btn btn-dark">পাঠান</button></form></div>`,
    account: () => h`<div class="card"><h2>পাসওয়ার্ড বদলান</h2><form data-pw><label class="f">বর্তমান পাসওয়ার্ড<input name="current" type="password" required autocomplete="current-password"></label><label class="f">নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input name="next" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-dark">বদলান</button></form></div>
<div class="card"><h2>ডেটা</h2><p class="hint">নিয়মিত ব্যাকআপ রাখুন। ডেটা থাকে প্রজেক্টের data ফোল্ডারে (db.json ও uploads)।</p><a class="btn" href="/api/admin/export.json">সব ডেটা ডাউনলোড (JSON)</a></div>
<div class="card"><h2>ডেমো ডেটা</h2><p class="hint">সাজানো ডেমো প্রোডাক্ট, অর্ডার, ব্যানার ও কুপন একবারে মুছে ফেলুন। নিজের প্রোডাক্ট যোগ করার আগে বা পরে মুছতে পারেন।</p><button class="btn btn-danger" data-demo>সব ডেমো ডেটা মুছুন</button></div>`,
  };

  const draw = () => {
    el._tab = tab;
    el.innerHTML = h`<h1>সেটিংস</h1><div class="tabs">${TABS.map(([k, v]) => h`<button class="tab${tab === k ? ' on' : ''}" data-tab="${k}">${v}</button>`)}</div><form data-sf>${panels[tab]()}${['push', 'account'].includes(tab) ? '' : h`<div class="sticky-save"><button class="btn btn-primary">সেটিংস সেভ করুন</button></div>`}</form>`.s;
    if (tab === 'push') pushStat();
  };
  const collect = () => {
    const out = {};
    $$('[data-p]', el).forEach((i) => setp(out, i.dataset.p, i.type === 'checkbox' ? i.checked : i.value));
    $$('[data-imgf]', el).forEach((b) => setp(out, b.dataset.imgf, get(S, b.dataset.imgf) || ''));
    if (tab === 'shipping') setp(out, 'shipping.insideDistricts', $$('[data-dist]', el).filter((c) => c.checked).map((c) => c.dataset.dist));
    if (tab === 'payments') ['payment', 'courier'].forEach((g) => setp(out, 'badges.' + g, S.badges[g].map((b, i) => { const r = $(`[data-badge="${g}.${i}"]`, el); return { ...b, label: $('[data-bl]', r).value, enabled: $('[data-be]', r).checked }; })));
    return out;
  };
  const keepInputs = () => { const o = collect(); $$('[data-p]', el).forEach((i) => { const v = get(o, i.dataset.p); if (v !== undefined) setp(S, i.dataset.p, v); }); if (tab === 'shipping') S.shipping.insideDistricts = get(o, 'shipping.insideDistricts'); if (tab === 'payments') S.badges = o.badges; };

  async function pushStat() {
    const st = $('[data-pstat]', el);
    try { const s = await api('/push/stats'); if (st) st.textContent = `অ্যাডমিন ডিভাইস: ${s.admins || 0}, কাস্টমার সাবস্ক্রাইবার: ${s.customers || 0}`; } catch (e) { /* ignore */ }
  }
  async function enableAdminPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('এই ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই (HTTPS বা localhost লাগে)');
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('নোটিফিকেশনের অনুমতি দেওয়া হয়নি');
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const { key } = await api('/push/key');
    const b64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
    const raw2 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw2 }));
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  }

  el.onclick = async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { if (!['push', 'account'].includes(tab)) keepInputs(); tab = t.dataset.tab; return draw(); }
    const pk = e.target.closest('[data-pick]');
    if (pk) { const host = pk.closest('[data-imgf]'); const [u] = await pickImages({ multiple: false, max: 1024 }); if (u) { keepInputs(); setp(S, host.dataset.imgf, u); draw(); } return; }
    const cl = e.target.closest('[data-clr]');
    if (cl) { keepInputs(); setp(S, cl.closest('[data-imgf]').dataset.imgf, ''); return draw(); }
    const bp = e.target.closest('[data-bpick]');
    if (bp) { const [g, i] = bp.closest('[data-badge]').dataset.badge.split('.'); const [u] = await pickImages({ multiple: false, max: 400 }); if (u) { keepInputs(); S.badges[g][i].image = u; draw(); } return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.cp); toast('কপি হয়েছে'); } catch (er) { toast('কপি করা যায়নি', 'bad'); } }
    try {
      if (e.target.closest('[data-padmin]')) { await enableAdminPush(); toast('এই ডিভাইসে চালু হয়েছে'); pushStat(); }
      if (e.target.closest('[data-ptest]')) { await api('/push/test', { method: 'POST' }); toast('টেস্ট পাঠানো হয়েছে'); }
      if (e.target.closest('[data-demo]') && (await confirmBox('সব ডেমো প্রোডাক্ট, অর্ডার, ব্যানার, কুপন ও ডেমো ক্যাটাগরি মুছে যাবে। আপনার নিজের যোগ করা ডেটা থাকবে।', { ok: 'মুছুন' }))) {
        const r = await api('/demo/delete', { method: 'POST' });
        toast(`মুছে গেছে: ${r.counts.products} প্রোডাক্ট, ${r.counts.orders} অর্ডার`); ctx.refresh();
      }
    } catch (er) { fail(er); }
  };
  el.oninput = (e) => {
    const c = e.target.dataset.pc;
    if (c && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) $(`[data-p="${c}"]`, el).value = e.target.value;
    if (e.target.type === 'color' && e.target.dataset.p) { const x = $(`[data-pc="${e.target.dataset.p}"]`, el); if (x) x.value = e.target.value; }
  };
  el.onsubmit = async (e) => {
    e.preventDefault();
    const f2 = e.target;
    try {
      if (f2.matches('[data-sf]')) {
        keepInputs();
        const r = await api('/settings', { method: 'PUT', body: { settings: collect() } });
        Object.assign(S, r.settings);
        toast('সেটিংস সেভ হয়েছে');
        document.title = S.siteName + ' অ্যাডমিন';
      } else if (f2.matches('[data-pw]')) {
        await api('/password', { method: 'POST', body: { current: f2.current.value, next: f2.next.value } });
        f2.reset(); toast('পাসওয়ার্ড বদলেছে');
      } else if (f2.matches('[data-bc]')) {
        const d = { title: f2.title.value, body: f2.body.value, url: f2.url.value };
        if (!(await confirmBox('সব সাবস্ক্রাইবারকে এই নোটিফিকেশন যাবে।', { ok: 'পাঠান', danger: false }))) return;
        const r = await api('/push/broadcast', { method: 'POST', body: d });
        toast(`পাঠানো হয়েছে (${r.sent || 0}টি ডিভাইসে)`); f2.reset();
      }
    } catch (er) { fail(er); }
  };
  draw();
}
