import { h, raw, $, $$, api, money, num, fmtDate, pill, toast, fail, confirmBox, imgBox, formData, openModal, waLink } from './a-core.js';

/* ---------------- reviews ---------------- */
const RS = { pending: 'অপেক্ষায়', approved: 'অনুমোদিত', rejected: 'বাতিল' };
export async function renderReviews(el, ctx) {
  const status = ctx.query && ctx.query.status ? ctx.query.status : (el._rv || 'pending');
  el._rv = status;
  const d = await api('/reviews?status=' + status);
  if (!ctx.alive()) return;
  el.innerHTML = h`<h1>রিভিউ</h1><div class="tabs">${['pending', 'approved', 'rejected', 'all'].map((k) => h`<button class="tab${status === k ? ' on' : ''}" data-tab="${k}">${k === 'all' ? 'সব' : RS[k]} (${d.counts[k] || 0})</button>`)}</div>
${d.items.length ? d.items.map((r) => h`<div class="card"><div class="row between"><div><b>${r.name}</b> ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${pill(r.status === 'approved' ? 'delivered' : r.status === 'rejected' ? 'cancelled' : 'pending', RS[r.status])}${r.verified ? h` <small class="muted">(কেনা কাস্টমার)</small>` : ''}<br><small class="muted"><a href="/p/${r.productSlug}" target="_blank">${r.productName}</a> · ${fmtDate(r.createdAt)}</small></div><div class="row">${r.status !== 'approved' ? h`<button class="btn sm btn-primary" data-set="approved" data-id="${r.id}">অনুমোদন</button>` : ''}${r.status !== 'rejected' ? h`<button class="btn sm" data-set="rejected" data-id="${r.id}">বাতিল</button>` : ''}<button class="btn sm btn-danger" data-del="${r.id}">মুছুন</button></div></div>${r.title ? h`<p><b>${r.title}</b></p>` : ''}<p>${r.text || r.comment || ''}</p>${(r.photos || r.images || []).length ? h`<div class="row">${(r.photos || r.images).map((u) => h`<a href="${u}" target="_blank">${imgBox(u)}</a>`)}</div>` : ''}</div>`) : h`<p class="muted">কোনো রিভিউ নেই।</p>`}`.s;
  el.onclick = async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { el._rv = t.dataset.tab; return renderReviews(el, { ...ctx, query: {} }); }
    const s = e.target.closest('[data-set]');
    try {
      if (s) { await api('/reviews/' + s.dataset.id, { method: 'PATCH', body: { status: s.dataset.set } }); toast('হয়েছে'); renderReviews(el, { ...ctx, query: {} }); ctx.refresh(); }
      const dl = e.target.closest('[data-del]');
      if (dl && (await confirmBox('রিভিউটি মুছে যাবে।'))) { await api('/reviews/' + dl.dataset.del, { method: 'DELETE' }); renderReviews(el, { ...ctx, query: {} }); ctx.refresh(); }
    } catch (er) { fail(er); }
  };
}

/* ---------------- messages ---------------- */
export async function renderMessages(el, ctx) {
  const d = await api('/messages');
  if (!ctx.alive()) return;
  el.innerHTML = h`<h1>কন্টাক্ট মেসেজ</h1>${d.items.length ? d.items.map((m) => h`<div class="card"${m.read ? '' : raw(' style="border-left:4px solid var(--pri)"')}><div class="row between"><div><b>${m.name}</b> <small class="muted">${fmtDate(m.createdAt)}</small><br><small>${m.phone || ''} ${m.email || ''}</small></div><div class="row">${m.phone ? h`<a class="btn sm" target="_blank" href="${waLink(m.phone)}">WhatsApp</a>` : ''}<button class="btn sm" data-read="${m.id}" data-v="${m.read ? 0 : 1}">${m.read ? 'আনরিড' : 'পড়া হয়েছে'}</button><button class="btn sm btn-danger" data-del="${m.id}">মুছুন</button></div></div><p style="white-space:pre-wrap">${m.message}</p></div>`) : h`<p class="muted">কোনো মেসেজ নেই।</p>`}`.s;
  el.onclick = async (e) => {
    const r = e.target.closest('[data-read]'), dl = e.target.closest('[data-del]');
    try {
      if (r) { await api('/messages/' + r.dataset.read, { method: 'PATCH', body: { read: r.dataset.v === '1' } }); renderMessages(el, ctx); ctx.refresh(); }
      if (dl && (await confirmBox('মেসেজটি মুছে যাবে।'))) { await api('/messages/' + dl.dataset.del, { method: 'DELETE' }); renderMessages(el, ctx); ctx.refresh(); }
    } catch (er) { fail(er); }
  };
}

/* ---------------- customers ---------------- */
export async function renderCustomers(el, ctx) {
  const { items } = await api('/customers');
  if (!ctx.alive()) return;
  let q = '';
  const draw = () => {
    const list = items.filter((c) => `${c.name} ${c.phone} ${c.district}`.toLowerCase().includes(q));
    $('[data-rows]', el).innerHTML = list.length ? list.map((c) => h`<tr><td><b>${c.name}</b>${c.blocked ? ' ' + pill('cancelled', 'ব্লক').s : ''}<br><small class="muted">${c.phone} · ${c.district}</small></td><td class="r">${c.orders}</td><td class="r">${c.delivered}</td><td class="r">${c.cancelled}</td><td class="r"><b>${money(c.spent)}</b></td><td><small>${fmtDate(c.lastOrderAt, false)}</small></td><td class="r"><a class="btn sm" target="_blank" href="${waLink(c.phone)}">WhatsApp</a> <button class="btn sm" data-blk="${c.phone}" data-v="${c.blocked ? 0 : 1}">${c.blocked ? 'আনব্লক' : 'ব্লক'}</button></td></tr>`).map(String).join('') : '<tr><td colspan="7" class="muted" style="padding:24px;text-align:center">কেউ নেই</td></tr>';
  };
  el.innerHTML = h`<h1>কাস্টমার (${items.length})</h1><p class="hint">ফেক অর্ডার করলে ব্লক করুন, ওই নম্বর থেকে আর অর্ডার নেওয়া হবে না। বাতিল বেশি হলে সতর্ক থাকুন।</p><div class="filters"><input type="search" placeholder="নাম, ফোন, জেলা..." data-q></div><div class="tw"><table><thead><tr><th>কাস্টমার</th><th class="r">অর্ডার</th><th class="r">ডেলিভারড</th><th class="r">বাতিল</th><th class="r">মোট কেনা</th><th>শেষ অর্ডার</th><th></th></tr></thead><tbody data-rows></tbody></table></div>`.s;
  draw();
  el.oninput = (e) => { if (e.target.matches('[data-q]')) { q = e.target.value.toLowerCase(); draw(); } };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-blk]');
    if (!b) return;
    const block = b.dataset.v === '1';
    if (block && !(await confirmBox('এই নম্বর থেকে নতুন অর্ডার নেওয়া বন্ধ হবে।', { ok: 'ব্লক করুন' }))) return;
    try { await api('/customers/block', { method: 'POST', body: { phone: b.dataset.blk, blocked: block } }); toast(block ? 'ব্লক হয়েছে' : 'আনব্লক হয়েছে'); renderCustomers(el, ctx); } catch (er) { fail(er); }
  };
}

/* ---------------- pages ---------------- */
export async function renderPages(el, ctx) {
  const { items, core } = await api('/pages');
  if (!ctx.alive()) return;
  el.innerHTML = h`<div class="row between"><h1>পেজ (About, নীতিমালা ইত্যাদি)</h1><button class="btn btn-primary" data-new>+ নতুন পেজ</button></div>
<p class="hint">বিবরণে {siteName} {phone} {email} {address} {hours} {insideFee} {outsideFee} {freeAbove} লিখলে সেটিংস থেকে নিজে বসে যাবে। **মোটা** লেখা, লাইনের শুরুতে - দিয়ে তালিকা, ## দিয়ে হেডিং।</p>
<div class="tw"><table><tbody>${items.map((p) => h`<tr><td><b>${p.title}</b><br><small class="muted">/page/${p.slug}</small></td><td class="r"><a class="btn sm" target="_blank" href="/page/${p.slug}">দেখুন</a> <button class="btn sm" data-edit="${p.slug}">এডিট</button></td></tr>`)}</tbody></table></div>`.s;
  const open = (pg) => {
    const x = pg || { slug: '', title: '', titleEn: '', body: '', bodyEn: '' };
    const m = openModal(h`<form><div class="g2"><label class="f">শিরোনাম (বাংলা)<input name="title" required value="${x.title}"></label><label class="f">Title (English)<input name="titleEn" value="${x.titleEn || ''}"></label></div>${pg ? '' : h`<label class="f">লিংক নাম (slug)<input name="slug" placeholder="size-guide"></label>`}<label class="f">বিবরণ (বাংলা)<textarea name="body" rows="9">${x.body}</textarea></label><label class="f">Body (English)<textarea name="bodyEn" rows="9">${x.bodyEn || ''}</textarea></label><div class="row end">${pg && !core.includes(pg.slug) ? h`<button type="button" class="btn btn-danger" data-del>মুছুন</button>` : ''}<button class="btn btn-primary">সেভ</button></div></form>`, { title: pg ? 'পেজ এডিট' : 'নতুন পেজ', wide: true });
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      try { pg ? await api('/pages/' + pg.slug, { method: 'PUT', body: formData(e.target) }) : await api('/pages', { method: 'POST', body: formData(e.target) }); toast('সেভ হয়েছে'); m.close(); renderPages(el, ctx); } catch (er) { fail(er); }
    };
    const dl = $('[data-del]', m.body);
    if (dl) dl.onclick = async () => { if (!(await confirmBox('পেজটি মুছে যাবে।'))) return; try { await api('/pages/' + pg.slug, { method: 'DELETE' }); m.close(); renderPages(el, ctx); } catch (er) { fail(er); } };
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-new]')) open(null);
    const b = e.target.closest('[data-edit]');
    if (b) open(items.find((p) => p.slug === b.dataset.edit));
  };
}
