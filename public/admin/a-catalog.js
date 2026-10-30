import { h, raw, $, $$, api, qs, money, num, debounce, pill, toast, fail, confirmBox, pager, pickImages, imgBox, formData, openModal } from './a-core.js';

/* ---------------- shared: image list editor ---------------- */
function imgList(list, { max = 12, label = 'ছবি যোগ' } = {}) {
  return h`<div class="imgs">${list.map((u, i) => h`<div class="im${i === 0 ? ' first' : ''}"><img src="${u}" alt=""><div class="tools"><button type="button" data-il="left" data-i="${i}" title="বামে">‹</button><button type="button" data-il="del" data-i="${i}" title="মুছুন">×</button><button type="button" data-il="right" data-i="${i}" title="ডানে">›</button></div></div>`)}${list.length < max ? h`<button type="button" class="add" data-il="add">+ ${label}</button>` : ''}</div>`;
}
function bindImgList(host, list, redraw, opts = {}) {
  host.onclick = async (e) => {
    const b = e.target.closest('[data-il]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.il === 'add') {
      const urls = await pickImages({ multiple: opts.max !== 1, max: opts.px || 1600 });
      list.push(...urls);
      if (opts.max) list.splice(opts.max);
    } else if (b.dataset.il === 'del') list.splice(i, 1);
    else if (b.dataset.il === 'left' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (b.dataset.il === 'right' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    redraw();
  };
}

/* ---------------- products ---------------- */
export async function renderProducts(el, ctx) {
  if (ctx.param) return editProduct(el, ctx);
  const st = { q: '', category: 'all', status: 'all', stock: '', sort: 'new', page: 1 };
  const sel = new Set();
  const cats = (await api('/categories')).items;
  el.innerHTML = h`<div class="row between"><h1>প্রোডাক্ট</h1><a class="btn btn-primary" href="#/products/new">+ নতুন প্রোডাক্ট</a></div>
<div class="filters"><input type="search" placeholder="নাম, SKU, ব্র্যান্ড..." data-f="q"><select data-f="category"><option value="all">সব ক্যাটাগরি</option>${cats.map((c) => h`<option value="${c.id}">${c.name}</option>`)}<option value="none">ক্যাটাগরি ছাড়া</option></select><select data-f="status"><option value="all">সব স্ট্যাটাস</option><option value="active">চালু</option><option value="draft">ড্রাফট</option></select><select data-f="stock"><option value="">সব স্টক</option><option value="low">কম স্টক</option></select><select data-f="sort"><option value="new">নতুন আগে</option><option value="sold">বেশি বিক্রি</option><option value="stock">কম স্টক আগে</option><option value="name">নাম</option></select></div>
<div class="row" data-bulk hidden style="margin-bottom:10px"><b data-bn></b><select data-ba><option value="">অ্যাকশন বেছে নিন</option><option value="activate">চালু করুন</option><option value="draft">ড্রাফটে রাখুন</option><option value="feature">ফিচার্ড করুন</option><option value="unfeature">ফিচার্ড বাদ দিন</option><option value="category">ক্যাটাগরি বদলান</option><option value="delete">মুছে ফেলুন</option></select><select data-bc hidden>${cats.map((c) => h`<option value="${c.id}">${c.name}</option>`)}</select><button class="btn btn-dark sm" data-bgo>প্রয়োগ</button></div>
<div class="tw"><table><thead><tr><th><input type="checkbox" data-all></th><th></th><th>প্রোডাক্ট</th><th class="r">দাম</th><th class="r">স্টক</th><th class="r">বিক্রি</th><th>স্ট্যাটাস</th><th></th></tr></thead><tbody data-rows></tbody></table></div><div data-pg></div>`.s;
  async function load() {
    const d = await api('/products?' + qs({ ...st, limit: 30 }));
    if (!ctx.alive()) return;
    const low = 5;
    $('[data-rows]', el).innerHTML = d.items.length
      ? d.items.map((p) => h`<tr><td><input type="checkbox" data-sel="${p.id}" ${sel.has(p.id) ? raw('checked') : ''}></td><td>${imgBox(p.images[0])}</td><td><a href="#/products/${p.id}"><b>${p.name}</b></a>${p.featured ? ' ★' : ''}${p.demo ? h` <small class="muted">(ডেমো)</small>` : ''}<br><small class="muted">${p.categoryName || 'ক্যাটাগরি নেই'}${p.sku ? ' · ' + p.sku : ''}</small></td><td class="r">${money(p.price)}${p.comparePrice ? h`<br><small class="muted"><s>${money(p.comparePrice)}</s> -${p.discount}%</small>` : ''}</td><td class="r">${p.totalStock <= low ? h`<b style="color:var(--bad)">${num(p.totalStock)}</b>` : num(p.totalStock)}</td><td class="r">${num(p.sold || 0)}</td><td>${pill(p.status === 'active' ? 'delivered' : 'pending', p.status === 'active' ? 'চালু' : 'ড্রাফট')}</td><td class="r"><a class="btn sm" href="/p/${p.slug}" target="_blank">দেখুন</a> <button class="btn sm" data-dup="${p.id}">কপি</button></td></tr>`).map(String).join('')
      : '<tr><td colspan="8" class="muted" style="padding:30px;text-align:center">কোনো প্রোডাক্ট নেই। "+ নতুন প্রোডাক্ট" চাপুন।</td></tr>';
    $('[data-pg]', el).innerHTML = pager(d.page, d.pages).s;
    bulkUi();
  }
  const bulkUi = () => { $('[data-bulk]', el).hidden = !sel.size; $('[data-bn]', el).textContent = `${sel.size}টি বেছেছেন`; };
  const reload = debounce(() => { st.page = 1; load().catch(fail); }, 300);
  el.oninput = (e) => { if (e.target.dataset.f) { st[e.target.dataset.f] = e.target.value; reload(); } };
  el.onchange = (e) => {
    const t = e.target;
    if (t.matches('[data-sel]')) { t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel); bulkUi(); }
    else if (t.matches('[data-all]')) { $$('[data-sel]', el).forEach((c) => { c.checked = t.checked; t.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); }); bulkUi(); }
    else if (t.matches('[data-ba]')) $('[data-bc]', el).hidden = t.value !== 'category';
    else if (t.matches('select[data-f]')) { st[t.dataset.f] = t.value; reload(); }
  };
  el.onclick = async (e) => {
    const p = e.target.closest('[data-page]');
    if (p) { st.page = Number(p.dataset.page); load().catch(fail); window.scrollTo(0, 0); }
    const d = e.target.closest('[data-dup]');
    if (d) { try { const r = await api(`/products/${d.dataset.dup}/duplicate`, { method: 'POST' }); toast('কপি হয়েছে (ড্রাফট)'); location.hash = '#/products/' + r.product.id; } catch (er) { fail(er); } }
    if (e.target.closest('[data-bgo]')) {
      const action = $('[data-ba]', el).value;
      if (!action) return toast('অ্যাকশন বেছে নিন', 'bad');
      if (action === 'delete' && !(await confirmBox(`${sel.size}টি প্রোডাক্ট ও তাদের রিভিউ চিরতরে মুছে যাবে।`))) return;
      try { await api('/products/bulk', { method: 'POST', body: { ids: [...sel], action, categoryId: $('[data-bc]', el).value } }); toast('সম্পন্ন'); sel.clear(); load(); ctx.refresh(); } catch (er) { fail(er); }
    }
  };
  await load();
}

async function editProduct(el, ctx) {
  const isNew = ctx.param === 'new';
  const [cats, cur] = await Promise.all([api('/categories').then((r) => r.items), isNew ? null : api('/products/' + ctx.param).then((r) => r.product)]);
  if (!ctx.alive()) return;
  const p = cur ? JSON.parse(JSON.stringify(cur)) : { name: '', description: '', categoryId: '', brand: '', price: '', comparePrice: '', cost: '', sku: '', stock: 10, images: [], options: [], variants: [], tags: [], featured: false, status: 'active', seoTitle: '', seoDesc: '' };
  const vmap = new Map((p.variants || []).map((v) => [v.key, v]));
  el.innerHTML = h`<a href="#/products">← প্রোডাক্ট</a><h1>${isNew ? 'নতুন প্রোডাক্ট' : 'প্রোডাক্ট সম্পাদনা'}</h1>
<form data-pf>
<div class="card"><h2>ছবি</h2><p class="hint">প্রথম ছবিটাই প্রধান ছবি। একাধিক ছবি দিন, ‹ › দিয়ে সাজান। ছবি নিজে থেকে ছোট করে আপলোড হবে।</p><div data-imgs></div></div>
<div class="card"><h2>মূল তথ্য</h2><label class="f">নাম<input name="name" required maxlength="200" value="${p.name}"></label>
<label class="f">বিবরণ<small>**মোটা** লিখতে দুই তারকা, লাইনের শুরুতে - দিয়ে তালিকা বানানো যায়</small><textarea name="description" rows="6">${p.description}</textarea></label>
<div class="g2"><label class="f">ক্যাটাগরি<select name="categoryId"><option value="">নেই</option>${cats.map((c) => h`<option value="${c.id}" ${c.id === p.categoryId ? raw('selected') : ''}>${c.name}</option>`)}</select></label><label class="f">ব্র্যান্ড<input name="brand" value="${p.brand}"></label></div>
<label class="f">ট্যাগ (কমা দিয়ে)<input name="tags" value="${(p.tags || []).join(', ')}" placeholder="eid, gift, new"></label></div>
<div class="card"><h2>দাম ও স্টক</h2><div class="g3"><label class="f">বিক্রয় মূল্য (৳)<input name="price" type="number" min="1" step="any" required value="${p.price}"></label><label class="f">আগের দাম (৳)<small>ডিসকাউন্ট ব্যাজের জন্য, ঐচ্ছিক</small><input name="comparePrice" type="number" min="0" step="any" value="${p.comparePrice || ''}"></label><label class="f">কেনা দাম (৳)<small>শুধু আপনি দেখবেন, লাভ হিসাবের জন্য</small><input name="cost" type="number" min="0" step="any" value="${p.cost || ''}"></label></div>
<div class="g2"><label class="f">SKU<input name="sku" value="${p.sku}"></label><label class="f" data-stock>স্টক (পিস)<input name="stock" type="number" min="0" value="${p.stock}"></label></div></div>
<div class="card"><h2>অপশন (সাইজ, রঙ ইত্যাদি)</h2><p class="hint">যেমন "সাইজ" = S, M, L আর "রঙ" = Black, Red। অপশন দিলে প্রতিটি কম্বিনেশনের আলাদা স্টক ও দাম দিতে পারবেন।</p><div data-opts></div><button type="button" class="btn sm" data-addopt>+ অপশন যোগ</button><div data-vars class="tw" style="margin-top:12px"></div></div>
<div class="card"><h2>প্রকাশ</h2><div class="g2"><label class="f">স্ট্যাটাস<select name="status"><option value="active" ${p.status === 'active' ? raw('selected') : ''}>চালু (দোকানে দেখাবে)</option><option value="draft" ${p.status === 'draft' ? raw('selected') : ''}>ড্রাফট (লুকানো)</option></select></label><label class="chk" style="align-self:end"><input type="checkbox" name="featured" ${p.featured ? raw('checked') : ''}> হোমপেজে ফিচার্ড করুন</label></div></div>
<div class="card"><h2>সার্চ ও সোশ্যাল প্রিভিউ (SEO)</h2><label class="f">স্ল্যাগ (লিংকের নাম)<small>খালি রাখলে নাম থেকে হবে</small><input name="slug" value="${p.slug || ''}"></label><label class="f">টাইটেল<input name="seoTitle" maxlength="120" value="${p.seoTitle || ''}"></label><label class="f">বর্ণনা<textarea name="seoDesc" rows="2" maxlength="300">${p.seoDesc || ''}</textarea></label></div>
<div class="sticky-save">${!isNew ? h`<button type="button" class="btn btn-danger" data-del>মুছুন</button><a class="btn" href="/p/${p.slug}" target="_blank">দেখুন</a>` : ''}<button class="btn btn-primary">সেভ করুন</button></div></form>`.s;

  const imgHost = $('[data-imgs]', el);
  const drawImgs = () => { imgHost.innerHTML = imgList(p.images).s; };
  drawImgs();
  bindImgList(imgHost, p.images, drawImgs);

  const optHost = $('[data-opts]', el), varHost = $('[data-vars]', el), stockLbl = $('[data-stock]', el);
  const opts = (p.options || []).map((o) => ({ name: o.name, values: o.values.join(', ') }));
  const combos = () => {
    const os = opts.map((o) => ({ name: o.name.trim(), values: [...new Set(o.values.split(',').map((x) => x.trim()).filter(Boolean))] })).filter((o) => o.name && o.values.length);
    let c = [[]];
    os.forEach((o) => (c = c.flatMap((a) => o.values.map((v) => [...a, v]))));
    return os.length ? c.map((x) => x.join('|')) : [];
  };
  const drawOpts = () => {
    optHost.innerHTML = opts.map((o, i) => h`<div class="row" style="margin-bottom:8px"><input data-on="${i}" value="${o.name}" placeholder="অপশনের নাম (সাইজ)" style="width:150px"><input data-ov="${i}" value="${o.values}" placeholder="মান, কমা দিয়ে (S, M, L)" class="grow"><button type="button" class="btn sm" data-rmopt="${i}">×</button></div>`).map(String).join('');
    drawVars();
  };
  const drawVars = () => {
    $$('[data-vk]', varHost).forEach((r) => vmap.set(r.dataset.vk, { ...(vmap.get(r.dataset.vk) || {}), key: r.dataset.vk, stock: $('[data-vs]', r).value, price: $('[data-vp]', r).value, sku: $('[data-vsku]', r).value }));
    const keys = combos();
    const sig = keys.join('~');
    if (sig === varHost._sig && varHost.innerHTML) return;
    varHost._sig = sig;
    stockLbl.hidden = keys.length > 0;
    if (!keys.length) { varHost.innerHTML = ''; return; }
    varHost.innerHTML = h`<table><thead><tr><th>কম্বিনেশন</th><th>স্টক</th><th>আলাদা দাম (৳)</th><th>SKU</th></tr></thead><tbody>${keys.map((k) => { const v = vmap.get(k) || {}; return h`<tr data-vk="${k}"><td>${k.split('|').join(' / ')}</td><td><input data-vs type="number" min="0" value="${v.stock == null ? 0 : v.stock}" style="width:90px"></td><td><input data-vp type="number" min="0" step="any" value="${v.price || ''}" placeholder="একই" style="width:100px"></td><td><input data-vsku value="${v.sku || ''}" style="width:120px"></td></tr>`; })}</tbody></table>`.s;
  };
  drawOpts();
  $('[data-addopt]', el).onclick = () => { if (opts.length >= 3) return toast('সর্বোচ্চ ৩টি অপশন', 'bad'); opts.push({ name: '', values: '' }); drawOpts(); };
  optHost.onclick = (e) => { const b = e.target.closest('[data-rmopt]'); if (b) { opts.splice(Number(b.dataset.rmopt), 1); drawOpts(); } };
  const redrawVars = debounce(drawVars, 250);
  optHost.oninput = (e) => { const t = e.target; if (t.dataset.on != null) opts[t.dataset.on].name = t.value; if (t.dataset.ov != null) opts[t.dataset.ov].values = t.value; redrawVars(); };

  $('[data-pf]', el).onsubmit = async (e) => {
    e.preventDefault();
    drawVars();
    const d = formData(e.target);
    const body = { ...d, images: p.images, tags: d.tags, options: opts.map((o) => ({ name: o.name, values: o.values })), variants: [...vmap.values()] };
    try {
      const r = isNew ? await api('/products', { method: 'POST', body }) : await api('/products/' + p.id, { method: 'PUT', body });
      toast('সেভ হয়েছে');
      ctx.refresh();
      if (isNew) location.hash = '#/products/' + r.product.id; else renderProducts(el, ctx);
    } catch (er) { fail(er); }
  };
  const del = $('[data-del]', el);
  if (del) del.onclick = async () => {
    if (!(await confirmBox('প্রোডাক্ট ও এর রিভিউ চিরতরে মুছে যাবে।'))) return;
    try { await api('/products/' + p.id, { method: 'DELETE' }); toast('মুছে গেছে'); location.hash = '#/products'; } catch (er) { fail(er); }
  };
}

/* ---------------- categories ---------------- */
export async function renderCategories(el, ctx) {
  const { items } = await api('/categories');
  if (!ctx.alive()) return;
  el.innerHTML = h`<div class="row between"><h1>ক্যাটাগরি</h1><button class="btn btn-primary" data-new>+ নতুন ক্যাটাগরি</button></div>
<div class="tw"><table><thead><tr><th></th><th>নাম</th><th>লিংক</th><th class="r">প্রোডাক্ট</th><th>স্ট্যাটাস</th><th></th></tr></thead><tbody>${items.length ? items.map((c) => h`<tr><td>${imgBox(c.image)}</td><td><b>${c.name}</b>${c.nameEn ? h`<br><small class="muted">${c.nameEn}</small>` : ''}</td><td><small>/c/${c.slug}</small></td><td class="r">${c.productCount}</td><td>${pill(c.active ? 'delivered' : 'pending', c.active ? 'চালু' : 'লুকানো')}</td><td class="r"><button class="btn sm" data-edit="${c.id}">এডিট</button></td></tr>`) : h`<tr><td colspan="6" class="muted" style="padding:24px;text-align:center">কোনো ক্যাটাগরি নেই</td></tr>`}</tbody></table></div>`.s;
  const open = (c) => {
    const x = c || { name: '', nameEn: '', slug: '', image: '', active: true, sort: items.length + 1 };
    const img = x.image ? [x.image] : [];
    const m = openModal(h`<form><label class="f">নাম (বাংলা)<input name="name" required value="${x.name}"></label><label class="f">নাম (ইংরেজি)<input name="nameEn" value="${x.nameEn || ''}"></label><label class="f">লিংক নাম (slug)<input name="slug" value="${x.slug || ''}"></label><label class="f">ক্রম<input name="sort" type="number" value="${x.sort}"></label><div class="f"><b>ছবি</b><div data-img></div></div><label class="chk"><input type="checkbox" name="active" ${x.active !== false ? raw('checked') : ''}> চালু</label><div class="row end">${c ? h`<button type="button" class="btn btn-danger" data-del>মুছুন</button>` : ''}<button class="btn btn-primary">সেভ</button></div></form>`, { title: c ? 'ক্যাটাগরি এডিট' : 'নতুন ক্যাটাগরি' });
    const host = $('[data-img]', m.body);
    const draw = () => { host.innerHTML = imgList(img, { max: 1, label: 'ছবি' }).s; };
    draw(); bindImgList(host, img, draw, { max: 1, px: 800 });
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      const body = { ...formData(e.target), image: img[0] || '' };
      try { c ? await api('/categories/' + c.id, { method: 'PUT', body }) : await api('/categories', { method: 'POST', body }); toast('সেভ হয়েছে'); m.close(); renderCategories(el, ctx); } catch (er) { fail(er); }
    };
    const dl = $('[data-del]', m.body);
    if (dl) dl.onclick = async () => { if (!(await confirmBox('ক্যাটাগরি মুছবে। এর প্রোডাক্টগুলো ক্যাটাগরি ছাড়া হয়ে যাবে।'))) return; try { await api('/categories/' + c.id, { method: 'DELETE' }); m.close(); toast('মুছে গেছে'); renderCategories(el, ctx); } catch (er) { fail(er); } };
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-new]')) open(null);
    const b = e.target.closest('[data-edit]');
    if (b) open(items.find((c) => c.id === b.dataset.edit));
  };
}

/* ---------------- banners ---------------- */
export async function renderBanners(el, ctx) {
  const { items } = await api('/banners');
  if (!ctx.alive()) return;
  el.innerHTML = h`<div class="row between"><h1>হিরো ব্যানার স্লাইডার</h1><button class="btn btn-primary" data-new>+ নতুন ব্যানার</button></div>
<p class="hint">ডেস্কটপের জন্য ১৬০০×৬৪০ এবং মোবাইলের জন্য ৯০০×১১০০ মাপের ছবি সবচেয়ে ভালো দেখায়। ছবিতে লেখা থাকলে "লেখা দেখান" বন্ধ রাখুন।</p>
<div class="cards-grid">${items.length ? items.map((b, i) => h`<div class="card"><img src="${b.image}" alt="" style="width:100%;aspect-ratio:5/2;object-fit:cover;border-radius:10px"><p><b>${b.title || '(শিরোনাম নেই)'}</b> ${pill(b.active ? 'delivered' : 'pending', b.active ? 'চালু' : 'বন্ধ')}<br><small class="muted">${b.link || 'লিংক নেই'}</small></p><div class="row"><button class="btn sm" data-mv="${b.id}" data-d="-1" ${i === 0 ? raw('disabled') : ''}>↑</button><button class="btn sm" data-mv="${b.id}" data-d="1" ${i === items.length - 1 ? raw('disabled') : ''}>↓</button><button class="btn sm" data-edit="${b.id}">এডিট</button></div></div>`) : h`<p class="muted">কোনো ব্যানার নেই। হোমপেজে ডিফল্ট ডিজাইন দেখাবে।</p>`}</div>`.s;
  const open = (b) => {
    const x = b || { title: '', subtitle: '', buttonText: 'এখনই কিনুন', link: '/shop', image: '', mobileImage: '', textTheme: 'light', align: 'left', showText: true, active: true };
    const im = x.image ? [x.image] : [], mi = x.mobileImage ? [x.mobileImage] : [];
    const m = openModal(h`<form><div class="f"><b>ডেস্কটপ ছবি *</b><div data-im></div></div><div class="f"><b>মোবাইল ছবি (ঐচ্ছিক)</b><div data-mi></div></div>
<label class="f">শিরোনাম<input name="title" value="${x.title}"></label><label class="f">উপশিরোনাম<input name="subtitle" value="${x.subtitle}"></label>
<div class="g2"><label class="f">বাটনের লেখা<input name="buttonText" value="${x.buttonText}"></label><label class="f">লিংক<small>যেমন /shop বা /c/saree বা /p/product-slug</small><input name="link" value="${x.link}"></label></div>
<div class="g2"><label class="f">লেখার রঙ<select name="textTheme"><option value="light" ${x.textTheme === 'light' ? raw('selected') : ''}>সাদা (গাঢ় ছবিতে)</option><option value="dark" ${x.textTheme === 'dark' ? raw('selected') : ''}>গাঢ় (হালকা ছবিতে)</option></select></label><label class="f">অবস্থান<select name="align">${[['left', 'বামে'], ['center', 'মাঝে'], ['right', 'ডানে']].map(([k, v]) => h`<option value="${k}" ${x.align === k ? raw('selected') : ''}>${v}</option>`)}</select></label></div>
<label class="chk"><input type="checkbox" name="showText" ${x.showText !== false ? raw('checked') : ''}> লেখা ও বাটন দেখান</label><label class="chk"><input type="checkbox" name="active" ${x.active !== false ? raw('checked') : ''}> চালু</label>
<div class="row end">${b ? h`<button type="button" class="btn btn-danger" data-del>মুছুন</button>` : ''}<button class="btn btn-primary">সেভ</button></div></form>`, { title: b ? 'ব্যানার এডিট' : 'নতুন ব্যানার', wide: true });
    for (const [sel, list, px] of [['[data-im]', im, 2000], ['[data-mi]', mi, 1400]]) {
      const host = $(sel, m.body);
      const draw = () => { host.innerHTML = imgList(list, { max: 1, label: 'ছবি' }).s; };
      draw(); bindImgList(host, list, draw, { max: 1, px });
    }
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      const body = { ...formData(e.target), image: im[0] || '', mobileImage: mi[0] || '' };
      try { b ? await api('/banners/' + b.id, { method: 'PUT', body }) : await api('/banners', { method: 'POST', body }); toast('সেভ হয়েছে'); m.close(); renderBanners(el, ctx); } catch (er) { fail(er); }
    };
    const dl = $('[data-del]', m.body);
    if (dl) dl.onclick = async () => { if (!(await confirmBox('ব্যানারটি মুছে যাবে।'))) return; try { await api('/banners/' + b.id, { method: 'DELETE' }); m.close(); renderBanners(el, ctx); } catch (er) { fail(er); } };
  };
  el.onclick = async (e) => {
    if (e.target.closest('[data-new]')) open(null);
    const ed = e.target.closest('[data-edit]');
    if (ed) open(items.find((b) => b.id === ed.dataset.edit));
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const ids = items.map((b) => b.id), i = ids.indexOf(mv.dataset.mv), j = i + Number(mv.dataset.d);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try { await api('/banners/reorder', { method: 'POST', body: { ids } }); renderBanners(el, ctx); } catch (er) { fail(er); }
    }
  };
}

/* ---------------- coupons ---------------- */
const CT = { percent: 'শতাংশ (%)', fixed: 'নির্দিষ্ট টাকা', freeship: 'ফ্রি ডেলিভারি' };
export async function renderCoupons(el, ctx) {
  const { items } = await api('/coupons');
  if (!ctx.alive()) return;
  const desc = (c) => (c.type === 'percent' ? `${c.value}% ছাড়` : c.type === 'fixed' ? `${money(c.value)} ছাড়` : 'ফ্রি ডেলিভারি');
  el.innerHTML = h`<div class="row between"><h1>কুপন</h1><button class="btn btn-primary" data-new>+ নতুন কুপন</button></div>
<div class="tw"><table><thead><tr><th>কোড</th><th>ছাড়</th><th>শর্ত</th><th class="r">ব্যবহার</th><th>মেয়াদ</th><th>স্ট্যাটাস</th><th></th></tr></thead><tbody>${items.length ? items.map((c) => h`<tr><td><b>${c.code}</b>${c.demo ? h` <small class="muted">(ডেমো)</small>` : ''}</td><td>${desc(c)}${c.maxDiscount ? h`<br><small class="muted">সর্বোচ্চ ${money(c.maxDiscount)}</small>` : ''}</td><td>${c.minOrder ? 'ন্যূনতম ' + money(c.minOrder) : '-'}</td><td class="r">${c.used || 0}${c.usageLimit ? ' / ' + c.usageLimit : ''}</td><td><small>${c.startsAt || '-'} থেকে ${c.endsAt || 'অনির্দিষ্ট'}</small></td><td>${pill(c.active ? 'delivered' : 'pending', c.active ? 'চালু' : 'বন্ধ')}</td><td class="r"><button class="btn sm" data-edit="${c.id}">এডিট</button></td></tr>`) : h`<tr><td colspan="7" class="muted" style="padding:24px;text-align:center">কোনো কুপন নেই</td></tr>`}</tbody></table></div>`.s;
  const open = (c) => {
    const x = c || { code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, startsAt: '', endsAt: '', active: true };
    const m = openModal(h`<form><label class="f">কোড (ইংরেজি অক্ষর ও সংখ্যা)<input name="code" required value="${x.code}" style="text-transform:uppercase"></label>
<div class="g2"><label class="f">ধরন<select name="type" data-type>${Object.entries(CT).map(([k, v]) => h`<option value="${k}" ${x.type === k ? raw('selected') : ''}>${v}</option>`)}</select></label><label class="f" data-val>ছাড়ের পরিমাণ<input name="value" type="number" min="0" step="any" value="${x.value}"></label></div>
<div class="g3"><label class="f">ন্যূনতম অর্ডার (৳)<input name="minOrder" type="number" min="0" value="${x.minOrder || 0}"></label><label class="f">সর্বোচ্চ ছাড় (৳)<small>শতাংশের ক্ষেত্রে, 0 = সীমাহীন</small><input name="maxDiscount" type="number" min="0" value="${x.maxDiscount || 0}"></label><label class="f">মোট ব্যবহারের সীমা<small>0 = সীমাহীন</small><input name="usageLimit" type="number" min="0" value="${x.usageLimit || 0}"></label></div>
<div class="g2"><label class="f">শুরু<input name="startsAt" type="date" value="${x.startsAt || ''}"></label><label class="f">শেষ<input name="endsAt" type="date" value="${x.endsAt || ''}"></label></div>
<label class="chk"><input type="checkbox" name="active" ${x.active !== false ? raw('checked') : ''}> চালু</label><div class="row end">${c ? h`<button type="button" class="btn btn-danger" data-del>মুছুন</button>` : ''}<button class="btn btn-primary">সেভ</button></div></form>`, { title: c ? 'কুপন এডিট' : 'নতুন কুপন' });
    const tg = () => { $('[data-val]', m.body).hidden = $('[data-type]', m.body).value === 'freeship'; };
    $('[data-type]', m.body).onchange = tg; tg();
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      const body = formData(e.target);
      try { c ? await api('/coupons/' + c.id, { method: 'PUT', body }) : await api('/coupons', { method: 'POST', body }); toast('সেভ হয়েছে'); m.close(); renderCoupons(el, ctx); } catch (er) { fail(er); }
    };
    const dl = $('[data-del]', m.body);
    if (dl) dl.onclick = async () => { if (!(await confirmBox('কুপনটি মুছে যাবে।'))) return; try { await api('/coupons/' + c.id, { method: 'DELETE' }); m.close(); renderCoupons(el, ctx); } catch (er) { fail(er); } };
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-new]')) open(null);
    const b = e.target.closest('[data-edit]');
    if (b) open(items.find((c) => c.id === b.dataset.edit));
  };
}
