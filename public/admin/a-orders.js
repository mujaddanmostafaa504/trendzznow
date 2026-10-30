import { addDict } from './a-i18n.js';
import { h, raw, $, $$, api, qs, money, num, fmtDate, statusPill, pill, STATUS, PAYM, PAYST, toast, fail, confirmBox, pager, copy, waLink, debounce, openModal, formData, imgBox } from './a-core.js';

const SRC = { all: 'সব সোর্স', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', messenger: 'Messenger', google: 'Google', youtube: 'YouTube', direct: 'সরাসরি', manual: 'ম্যানুয়াল' };
const NEXT = { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered' };

export async function render(el, ctx) {
  if (ctx.param === 'new') return renderNew(el, ctx);
  if (ctx.param) return renderDetail(el, ctx);
  return renderList(el, ctx);
}

/* ---------------- list ---------------- */
async function renderList(el, ctx) {
  const st = { status: ctx.query.status || 'all', q: '', payment: 'all', source: 'all', from: '', to: '', page: 1 };
  const sel = new Set();
  el.innerHTML = h`<div class="row between"><h1>অর্ডার</h1><div class="row"><a class="btn" href="/api/admin/orders.csv" data-csv>CSV এক্সপোর্ট</a><a class="btn btn-primary" href="#/orders/new">+ নতুন অর্ডার</a></div></div>
<div class="tabs" data-tabs></div>
<div class="filters"><input type="search" placeholder="নাম, ফোন, অর্ডার নম্বর, TrxID..." data-f="q"><select data-f="payment"><option value="all">সব পেমেন্ট</option>${Object.entries(PAYST).map(([k, v]) => h`<option value="${k}">${v}</option>`)}</select><select data-f="source" data-src><option value="all">সব সোর্স</option></select><div class="row" style="flex-wrap:nowrap"><input type="date" data-f="from" title="শুরু"><input type="date" data-f="to" title="শেষ"></div><button class="btn" data-reset>রিসেট</button></div>
<div data-bulk class="row" hidden style="margin-bottom:10px"><b data-bn></b><select data-bs><option value="">স্ট্যাটাস বদলান...</option>${Object.entries(STATUS).map(([k, v]) => h`<option value="${k}">${v}</option>`)}</select><button class="btn btn-dark sm" data-bapply>প্রয়োগ</button><a class="btn sm" data-bcourier href="#">কুরিয়ার শিট (CSV)</a></div>
<div class="tw"><table><thead><tr><th><input type="checkbox" data-all></th><th>অর্ডার</th><th>কাস্টমার</th><th>পণ্য</th><th class="r">মোট</th><th>পেমেন্ট</th><th>সোর্স</th><th>স্ট্যাটাস</th></tr></thead><tbody data-rows></tbody></table></div><div data-pg></div>`.s;
  const rows = $('[data-rows]', el);
  const q = () => qs({ status: st.status, q: st.q, payment: st.payment, source: st.source, from: st.from, to: st.to });
  async function load() {
    const d = await api('/orders?' + qs({ status: st.status, q: st.q, payment: st.payment, source: st.source, from: st.from, to: st.to, page: st.page, limit: 30 }));
    if (!ctx.alive()) return;
    $('[data-tabs]', el).innerHTML = h`${['all', ...Object.keys(STATUS)].map((k) => h`<button class="tab${st.status === k ? ' on' : ''}" data-tab="${k}">${k === 'all' ? 'সব' : STATUS[k]} (${d.counts[k] || 0})</button>`)}`.s;
    const src = $('[data-src]', el);
    if (src.options.length <= 1) src.innerHTML = h`<option value="all">সব সোর্স</option>${d.sources.map((s) => h`<option value="${s}">${SRC[s] || s}</option>`)}`.s;
    $('[data-csv]', el).href = '/api/admin/orders.csv?' + q();
    rows.innerHTML = d.items.length
      ? d.items.map((o) => h`<tr><td><input type="checkbox" data-sel="${o.id}" ${sel.has(o.id) ? raw('checked') : ''}></td><td><a href="#/orders/${o.number}"><b>${o.number}</b></a>${o.demo ? h` <small class="muted">(ডেমো)</small>` : ''}<br><small class="muted">${fmtDate(o.createdAt)}</small></td><td>${o.customer.name}<br><small class="muted">${o.customer.phone} · ${o.customer.district}</small></td><td>${o.itemCount}টি</td><td class="r"><b>${money(o.total)}</b></td><td>${PAYM[o.paymentMethod] || o.paymentMethod}<br>${pill(o.paymentStatus, PAYST[o.paymentStatus] || o.paymentStatus)}</td><td>${SRC[o.source] || o.source}</td><td>${statusPill(o.status)}</td></tr>`).map(String).join('')
      : '<tr><td colspan="8" class="muted" style="padding:30px;text-align:center">কোনো অর্ডার নেই</td></tr>';
    $('[data-pg]', el).innerHTML = pager(d.page, d.pages).s;
    bulkUi();
  }
  function bulkUi() {
    $('[data-bulk]', el).hidden = !sel.size;
    $('[data-bn]', el).textContent = `${sel.size}টি বেছেছেন`;
    $('[data-bcourier]', el).href = '/api/admin/orders-courier.csv?ids=' + [...sel].join(',');
  }
  const reload = debounce(() => { st.page = 1; load().catch(fail); }, 300);
  el.oninput = (e) => {
    const f = e.target.dataset.f;
    if (f) { st[f] = e.target.value; reload(); }
  };
  el.onclick = async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { st.status = t.dataset.tab; st.page = 1; load().catch(fail); }
    const p = e.target.closest('[data-page]');
    if (p) { st.page = Number(p.dataset.page); load().catch(fail); window.scrollTo(0, 0); }
    if (e.target.closest('[data-reset]')) { Object.assign(st, { status: 'all', q: '', payment: 'all', source: 'all', from: '', to: '', page: 1 }); $$('[data-f]', el).forEach((i) => (i.value = i.dataset.f === 'payment' || i.dataset.f === 'source' ? 'all' : '')); load().catch(fail); }
    if (e.target.closest('[data-bapply]')) {
      const s = $('[data-bs]', el).value;
      if (!s) return toast('স্ট্যাটাস বেছে নিন', 'bad');
      if (!(await confirmBox(`${sel.size}টি অর্ডার "${STATUS[s]}" করা হবে। কাস্টমারকে নোটিফিকেশন যাবে (চালু থাকলে)।`, { danger: false, ok: 'প্রয়োগ করুন' }))) return;
      try { const r = await api('/orders/bulk', { method: 'POST', body: { ids: [...sel], status: s } }); toast(`${r.updated}টি আপডেট হয়েছে`); sel.clear(); load(); } catch (err) { fail(err); }
    }
  };
  el.onchange = (e) => {
    if (e.target.matches('[data-sel]')) { e.target.checked ? sel.add(e.target.dataset.sel) : sel.delete(e.target.dataset.sel); bulkUi(); }
    if (e.target.matches('[data-all]')) { $$('[data-sel]', el).forEach((c) => { c.checked = e.target.checked; e.target.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); }); bulkUi(); }
    if (e.target.matches('select[data-f]')) { st[e.target.dataset.f] = e.target.value; reload(); }
  };
  await load();
}

/* ---------------- detail ---------------- */
async function renderDetail(el, ctx) {
  const { order: o } = await api('/orders/' + encodeURIComponent(ctx.param));
  if (!ctx.alive()) return;
  const c = o.customer;
  const msgWa = `আপনার অর্ডার ${o.number} সম্পর্কে। মোট ${money(o.total)}।`;
  el.innerHTML = h`<div class="row between"><div><a href="#/orders">← সব অর্ডার</a><h1>${o.number} ${statusPill(o.status)}</h1><span class="muted">${fmtDate(o.createdAt)}${o.demo ? ' · ডেমো অর্ডার' : ''}</span></div>
<div class="row"><a class="btn" href="/admin/invoice/${o.number}" target="_blank">ইনভয়েস / প্রিন্ট</a>${NEXT[o.status] ? h`<button class="btn btn-primary" data-next="${NEXT[o.status]}">${STATUS[NEXT[o.status]]} করুন</button>` : ''}</div></div>
<div class="cols" style="margin-top:14px"><div>
<div class="card"><h2>পণ্য</h2><div class="tw" style="border:0"><table><tbody>${o.items.map((i) => h`<tr><td style="width:56px">${imgBox(i.image)}</td><td><a href="/p/${i.slug}" target="_blank">${i.name}</a>${i.variantLabel ? h`<br><small class="muted">${i.variantLabel}</small>` : ''}</td><td>${money(i.unitPrice)} × ${i.qty}</td><td class="r"><b>${money(i.unitPrice * i.qty)}</b></td></tr>`)}</tbody></table></div>
<dl class="kv" style="margin-top:10px"><dt>পণ্যের দাম</dt><dd>${money(o.subtotal)}</dd>${o.discount ? h`<dt>ডিসকাউন্ট ${o.couponCode ? '(' + o.couponCode + ')' : ''}</dt><dd>-${money(o.discount)}</dd>` : ''}<dt>ডেলিভারি</dt><dd>${money(o.shipping)}</dd><dt><b>মোট</b></dt><dd><b>${money(o.total)}</b></dd></dl></div>
<div class="card"><h2>স্ট্যাটাস বদলান</h2><form data-status><div class="g2"><label class="f">নতুন স্ট্যাটাস<select name="status">${Object.entries(STATUS).map(([k, v]) => h`<option value="${k}" ${k === o.status ? raw('selected') : ''}>${v}</option>`)}</select></label><label class="f">নোট (কাস্টমার দেখবে)<input name="note" maxlength="300"></label></div><label class="chk"><input type="checkbox" name="notify" checked> কাস্টমারকে নোটিফিকেশন পাঠান (অর্ডারে নোটিফিকেশন চালু থাকলে)</label><button class="btn btn-dark">আপডেট করুন</button></form>
<p class="hint">বাতিল বা ফেরত করলে স্টক নিজে থেকে ফিরে আসবে।</p></div>
<div class="card"><h2>কুরিয়ার</h2><form data-courier><div class="g3"><label class="f">কুরিয়ারের নাম<input name="name" value="${o.courier.name || ''}" placeholder="Pathao / Steadfast"></label><label class="f">ট্র্যাকিং আইডি<input name="trackingId" value="${o.courier.trackingId || ''}"></label><label class="f">ট্র্যাকিং লিংক<input name="url" value="${o.courier.url || ''}" placeholder="https://..."></label></div><button class="btn">সেভ করুন</button></form></div>
<div class="card"><h2>টাইমলাইন</h2><ul class="tl2">${[...o.timeline].reverse().map((t) => h`<li><b>${STATUS[t.status] || t.status}</b> <small>${fmtDate(t.at)}</small>${t.note ? h`<small>${t.note}</small>` : ''}</li>`)}</ul></div>
</div><div>
<div class="card"><h2>কাস্টমার</h2><p><b>${c.name}</b><br>${c.phone}<br>${c.address}${c.area ? ', ' + c.area : ''}<br>${c.district}, ${c.division}${c.note ? h`<br><i>নোট: ${c.note}</i>` : ''}</p>
<div class="row"><a class="btn sm" href="tel:${c.phone}">কল</a><a class="btn sm" target="_blank" href="${waLink(c.phone, msgWa)}">WhatsApp</a><button class="btn sm" data-copy="${c.name}\n${c.phone}\n${c.address}${c.area ? ', ' + c.area : ''}, ${c.district}">ঠিকানা কপি</button></div></div>
<div class="card"><h2>পেমেন্ট</h2><p>${PAYM[o.payment.method]} ${pill(o.payment.status, PAYST[o.payment.status])}${o.payment.trxId ? h`<br>TrxID: <b>${o.payment.trxId}</b>` : ''}${o.payment.senderNumber ? h`<br>প্রেরক: ${o.payment.senderNumber}` : ''}</p>
<form data-pay class="row"><select name="status" class="grow">${Object.entries(PAYST).map(([k, v]) => h`<option value="${k}" ${k === o.payment.status ? raw('selected') : ''}>${v}</option>`)}</select><button class="btn sm">সেভ</button></form></div>
<div class="card"><h2>সোর্স</h2><p>${SRC[o.source && o.source.label] || (o.source && o.source.label) || 'সরাসরি'}${o.source && o.source.utm_campaign ? h`<br><small class="muted">ক্যাম্পেইন: ${o.source.utm_campaign}</small>` : ''}${o.source && o.source.referrer ? h`<br><small class="muted">রেফারার: ${o.source.referrer}</small>` : ''}</p></div>
<div class="card"><h2>আপনার নোট (গোপন)</h2><form data-note><textarea name="adminNote" rows="3">${o.adminNote || ''}</textarea><button class="btn sm" style="margin-top:8px">সেভ</button></form></div>
${['cancelled', 'returned'].includes(o.status) || o.demo ? h`<button class="btn btn-danger" data-del>অর্ডার মুছুন</button>` : ''}
</div></div>`.s;
  const save = async (body, msg = 'সেভ হয়েছে') => {
    try { await api('/orders/' + o.id, { method: 'PATCH', body }); toast(msg); render(el, ctx); ctx.refresh(); } catch (e) { fail(e); }
  };
  el.onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.matches('[data-status]')) { const d = formData(f); if (d.status === 'cancelled' || d.status === 'returned') confirmBox('অর্ডারটি "' + STATUS[d.status] + '" করা হবে এবং স্টক ফিরে যাবে।').then((y) => y && save(d, 'স্ট্যাটাস বদলেছে')); else save(d, 'স্ট্যাটাস বদলেছে'); }
    else if (f.matches('[data-courier]')) save({ courier: formData(f) });
    else if (f.matches('[data-pay]')) save({ payment: { status: f.status.value } });
    else if (f.matches('[data-note]')) save({ adminNote: f.adminNote.value });
  };
  el.onclick = async (e) => {
    const n = e.target.closest('[data-next]');
    if (n) save({ status: n.dataset.next }, 'স্ট্যাটাস বদলেছে');
    const cp = e.target.closest('[data-copy]');
    if (cp) copy(cp.dataset.copy);
    if (e.target.closest('[data-del]') && (await confirmBox('অর্ডারটি চিরতরে মুছে যাবে।'))) {
      try { await api('/orders/' + o.id, { method: 'DELETE' }); location.hash = '#/orders'; } catch (err) { fail(err); }
    }
  };
}

/* ---------------- manual order ---------------- */
async function renderNew(el, ctx) {
  const [{ items: prods }, set] = await Promise.all([api('/products?status=active&limit=100'), api('/settings')]);
  const geo = set.districts;
  addDict(Object.fromEntries(geo.flatMap((d) => [[d.bn, d.en], ...d.districts.map((x) => [x.bn, x.en])])));
  const lines = [];
  const draw = () => {
    $('[data-lines]', el).innerHTML = lines.length ? lines.map((l, i) => h`<li><span class="grow">${l.name}${l.vlabel ? ' (' + l.vlabel + ')' : ''}</span><input type="number" min="1" value="${l.qty}" data-q="${i}" style="width:70px"><b>${money(l.price * l.qty)}</b><button type="button" class="btn sm" data-rm="${i}">×</button></li>`).map(String).join('') : '<li class="muted">কোনো পণ্য যোগ করা হয়নি</li>';
    const sub = lines.reduce((a, l) => a + l.price * l.qty, 0);
    $('[data-sub]', el).textContent = money(sub);
  };
  el.innerHTML = h`<a href="#/orders">← অর্ডার</a><h1>নতুন অর্ডার (ফোন বা মেসেজ থেকে)</h1>
<form data-new><div class="card"><h2>কাস্টমার</h2><div class="g2"><label class="f">নাম<input name="name" required></label><label class="f">মোবাইল<input name="phone" type="tel" required></label>
<label class="f">জেলা<select name="district" required><option value="">বেছে নিন</option>${geo.map((d) => h`<optgroup label="${d.bn}">${d.districts.map((x) => h`<option value="${x.en}">${x.bn}</option>`)}</optgroup>`)}</select></label><label class="f">এলাকা<input name="area"></label></div><label class="f">ঠিকানা<textarea name="address" required rows="2"></textarea></label><label class="f">নোট<input name="note"></label></div>
<div class="card"><h2>পণ্য</h2><label class="f">পণ্য খুঁজে যোগ করুন<select data-prod><option value="">বেছে নিন</option>${prods.map((p) => h`<option value="${p.id}">${p.name} (${money(p.price)}, স্টক ${p.totalStock})</option>`)}</select></label><div data-var></div><ul class="list" data-lines></ul><p class="row between"><span>পণ্যের দাম</span><b data-sub></b></p></div>
<div class="card"><h2>অন্যান্য</h2><div class="g3"><label class="f">কোথা থেকে এলো<select name="channel">${['facebook', 'instagram', 'tiktok', 'whatsapp', 'messenger', 'phone', 'manual'].map((k) => h`<option value="${k}">${SRC[k] || (k === 'phone' ? 'ফোন' : k)}</option>`)}</select></label><label class="f">পেমেন্ট<select name="paymentMethod">${Object.entries(PAYM).map(([k, v]) => h`<option value="${k}">${v}</option>`)}</select></label><label class="f">স্ট্যাটাস<select name="status">${Object.entries(STATUS).map(([k, v]) => h`<option value="${k}" ${k === 'confirmed' ? raw('selected') : ''}>${v}</option>`)}</select></label></div><label class="f">কুপন কোড (ঐচ্ছিক)<input name="coupon"></label><label class="f">TrxID (bKash/Nagad হলে)<input name="trxId"></label></div>
<div class="sticky-save"><button class="btn btn-primary">অর্ডার তৈরি করুন</button></div></form>`.s;
  draw();
  const varBox = $('[data-var]', el);
  let cur = null;
  $('[data-prod]', el).addEventListener('change', (e) => {
    cur = prods.find((p) => p.id === e.target.value);
    varBox.innerHTML = '';
    if (!cur) return;
    if (cur.variants && cur.variants.length) varBox.innerHTML = h`<label class="f">অপশন<select data-vsel>${cur.variants.map((v) => h`<option value="${v.key}">${v.label} (স্টক ${v.stock})</option>`)}</select></label><button type="button" class="btn sm" data-add>যোগ করুন</button>`.s;
    else { lines.push({ pid: cur.id, vk: '', name: cur.name, vlabel: '', price: cur.price, qty: 1 }); draw(); e.target.value = ''; }
  });
  el.onclick = (e) => {
    if (e.target.closest('[data-add]') && cur) {
      const v = cur.variants.find((x) => x.key === $('[data-vsel]', el).value);
      lines.push({ pid: cur.id, vk: v.key, name: cur.name, vlabel: v.label, price: v.price == null ? cur.price : v.price, qty: 1 });
      varBox.innerHTML = ''; $('[data-prod]', el).value = ''; cur = null; draw();
    }
    const r = e.target.closest('[data-rm]');
    if (r) { lines.splice(Number(r.dataset.rm), 1); draw(); }
  };
  el.onchange = (e) => {
    if (e.target.matches('[data-q]')) { lines[Number(e.target.dataset.q)].qty = Math.max(1, Number(e.target.value) || 1); draw(); }
  };
  $('[data-new]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!lines.length) return toast('অন্তত একটি পণ্য যোগ করুন', 'bad');
    const d = formData(e.target);
    try {
      const r = await api('/orders', { method: 'POST', body: { customer: { name: d.name, phone: d.phone, district: d.district, area: d.area, address: d.address, note: d.note }, items: lines.map((l) => ({ productId: l.pid, variantKey: l.vk, qty: l.qty })), channel: d.channel, paymentMethod: d.paymentMethod, trxId: d.trxId, coupon: d.coupon, status: d.status } });
      toast('অর্ডার তৈরি হয়েছে');
      location.hash = '#/orders/' + r.order.number;
    } catch (err) { fail(err); }
  });
}
