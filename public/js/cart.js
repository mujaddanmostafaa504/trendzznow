// Cart page and one-page checkout.
import { h, raw } from './h.js';
import { t, getLang } from './i18n.js';
import { S, cart, ss, api, ApiError, money, num, tr, track, customer, myOrders, normPhone, getSource, debounce, $, $$ } from './core.js';
import { icon, toast, emptyState } from './ui.js';
import { navigate } from './router.js';
import { bindRails, recentSection } from './home.js';

const COUPON_KEY = 'tn_coupon';
const toLines = () => cart.items.map((i) => ({ productId: i.pid, variantKey: i.vk || '', qty: i.qty }));
const keyOf = (pid, vk) => `${pid}|${vk || ''}`;

export const couponMsg = (c) => {
  if (!c || !c.error) return '';
  const map = { coupon_invalid: 'coupon_invalid', coupon_not_started: 'coupon_not_started', coupon_expired: 'coupon_expired', coupon_used_up: 'coupon_used_up', coupon_min_order: 'coupon_min_order' };
  return t(map[c.error] || 'coupon_invalid', { n: money(c.min || 0) });
};

// bring the saved cart in line with what the server says (price, stock, deleted products)
function syncCart(priced) {
  let changed = false;
  const notes = [];
  const byKey = new Map(priced.lines.map((l) => [keyOf(l.productId, l.variantKey), l]));
  cart.items.forEach((it) => {
    const l = byKey.get(keyOf(it.pid, it.vk));
    if (!l || l.issue === 'unavailable' || l.issue === 'variant_required') return;
    if (l.issue === 'limited' && l.qty > 0 && it.qty !== l.qty) {
      it.qty = l.qty;
      changed = true;
      notes.push(t('qty_reduced', { name: l.name, n: l.qty }));
    }
    if (l.unitPrice && it.price !== l.unitPrice) {
      it.price = l.unitPrice;
      changed = true;
    }
    if (l.name && (it.name !== l.name || it.image !== l.image)) {
      it.name = l.name;
      it.image = l.image;
      changed = true;
    }
  });
  if (changed) cart.save();
  return notes;
}

const lineIssue = (l) => (l ? (l.issue === 'unavailable' || l.issue === 'variant_required' ? 'gone' : l.issue === 'out_of_stock' ? 'out' : '') : '');

function freeShipBar(priced) {
  const fa = priced.freeAbove;
  if (!fa) return '';
  const after = priced.subtotal - priced.discount;
  const left = Math.max(0, fa - after);
  return h`<div class="fs-bar${left ? '' : ' done'}"><p>${left ? t('free_ship_left', { n: money(left) }) : t('free_ship_got')}</p><i><u style="width:${Math.min(100, Math.round((after / fa) * 100))}%"></u></i></div>`;
}

export async function renderCart(ctx) {
  ctx.setTitle(`${t('cart')} | ${S.siteName}`);
  let coupon = ss.get(COUPON_KEY, '');
  let priced = null;
  let couponErr = '';
  let notes = [];
  const el = ctx.el;

  if (!cart.items.length) {
    el.innerHTML = h`<section class="wrap sec">${emptyState(t('cart_empty'), t('cart_empty_sub'), h`<a class="btn btn-primary btn-lg" href="/shop">${t('start_shopping')}</a>`)}</section><div class="wrap" data-recent></div>`.s;
    const rec = await recentSection('', t('recently_viewed'));
    if (ctx.alive() && rec && rec.s) {
      $('[data-recent]', el).innerHTML = rec.s;
      bindRails(ctx);
    }
    return;
  }

  el.innerHTML = h`<section class="wrap cart"><div class="sec-head"><h1>${t('cart')}</h1></div><div class="cart-grid"><div class="cart-lines"><div class="sk sk-block"></div><div class="sk sk-block"></div></div><aside class="cart-sum"><div class="sk sk-block"></div></aside></div></section>`.s;

  async function price(withCoupon = true) {
    const r = await api('/cart/price', { method: 'POST', body: { items: toLines(), coupon: withCoupon ? coupon : '' } });
    return r;
  }

  function draw() {
    const byKey = new Map(priced.lines.map((l) => [keyOf(l.productId, l.variantKey), l]));
    const bad = cart.items.some((it) => lineIssue(byKey.get(keyOf(it.pid, it.vk))));
    const rows = cart.items.map((it, i) => {
      const l = byKey.get(keyOf(it.pid, it.vk));
      const issue = lineIssue(l);
      const unit = l && l.unitPrice ? l.unitPrice : it.price;
      return h`<article class="cl${issue ? ' is-bad' : ''}">
<a class="cl-img" href="/p/${it.slug}"><img src="${it.image || '/img/placeholder.svg'}" alt="" loading="lazy"></a>
<div class="cl-main">
<a class="cl-name" href="/p/${it.slug}">${it.name}</a>
${it.vlabel ? h`<span class="cl-var">${it.vlabel}</span>` : ''}
<span class="cl-unit">${money(unit)}${l && l.comparePrice > unit ? h`<s>${money(l.comparePrice)}</s>` : ''}</span>
${issue === 'gone' ? h`<p class="cl-note">${t('line_gone')}</p>` : issue === 'out' ? h`<p class="cl-note">${t('stock_out')}</p>` : l && l.stock > 0 && l.stock <= ((S.marketing && S.marketing.lowStockThreshold) || 0) ? h`<p class="cl-low">${t('only_left', { n: l.stock })}</p>` : ''}
</div>
<div class="cl-side">
<div class="qty sm"><button type="button" data-ct="dec" data-i="${i}" aria-label="${t('less')}">${icon('minus')}</button><span aria-live="polite">${it.qty}</span><button type="button" data-ct="inc" data-i="${i}" aria-label="${t('more')}" ${l && l.stock && it.qty >= l.stock ? raw('disabled') : ''}>${icon('plus')}</button></div>
<b class="cl-total">${issue ? '-' : money(unit * it.qty)}</b>
<button type="button" class="btn-link cl-rm" data-ct="rm" data-i="${i}">${icon('trash')}${t('remove')}</button>
</div></article>`;
    });
    $('.cart-lines', el).innerHTML = h`${notes.length ? h`<div class="note-box">${notes.map((n) => h`<p>${n}</p>`)}</div>` : ''}${rows}<div class="cart-actions"><a class="btn btn-ghost" href="/shop">${icon('left')}${t('continue_shopping')}</a><button type="button" class="btn-link" data-ct="clear">${t('clear_cart')}</button></div>`.s;
    const co = priced.coupon && !priced.coupon.error ? priced.coupon : null;
    $('.cart-sum', el).innerHTML = h`<h2>${t('order_summary')}</h2>
${freeShipBar(priced)}
<dl class="sum">
<div><dt>${t('subtotal')}</dt><dd>${money(priced.subtotal)}</dd></div>
${priced.discount ? h`<div class="disc"><dt>${t('discount')}${co ? h` <em>${co.code}</em>` : ''}</dt><dd>-${money(priced.discount)}</dd></div>` : ''}
<div><dt>${t('shipping')}</dt><dd class="muted">${co && co.freeShipping ? t('free') : t('calc_at_checkout')}</dd></div>
<div class="grand"><dt>${t('total')}</dt><dd>${money(priced.subtotal - priced.discount)}</dd></div>
</dl>
<form class="coupon" data-coupon-form><label for="cp">${t('have_coupon')}</label><div><input id="cp" name="code" value="${co ? co.code : coupon || ''}" autocomplete="off" autocapitalize="characters" placeholder="${t('coupon_code')}" ${co ? raw('readonly') : ''}>${co ? h`<button type="button" class="btn btn-ghost" data-ct="rmcoupon">${t('remove')}</button>` : h`<button type="submit" class="btn btn-ghost">${t('apply')}</button>`}</div>${couponErr ? h`<p class="form-err" role="alert">${couponErr}</p>` : ''}</form>
${bad ? h`<p class="form-err">${t('fix_cart_first')}</p><button type="button" class="btn btn-ink btn-block" data-ct="removebad">${t('remove_unavailable')}</button>` : h`<a class="btn btn-primary btn-lg btn-block" href="/checkout" data-ct="go">${t('checkout')}</a>`}
<p class="sum-note">${icon('shield')}${t('trust_pay_sub')}</p>`.s;
  }

  async function refresh(keepNotes = false) {
    try {
      priced = await price();
    } catch (e) {
      if (!ctx.alive()) return;
      toast(e.message, { kind: 'warn' });
      if (!priced) {
        el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), e.message, h`<button type="button" class="btn btn-primary" data-act="reload">${t('retry')}</button>`)}</section>`.s;
      }
      return;
    }
    if (!ctx.alive()) return;
    const n = syncCart(priced);
    if (!keepNotes) notes = n;
    else notes = [...notes, ...n];
    if (priced.coupon && priced.coupon.error) {
      couponErr = couponMsg(priced.coupon);
      coupon = '';
      ss.del(COUPON_KEY);
      priced = await price(false);
      if (!ctx.alive()) return;
    } else if (!priced.coupon && coupon) {
      coupon = '';
      ss.del(COUPON_KEY);
    }
    if (!cart.items.length) return renderCart(ctx);
    draw();
  }

  const reprice = debounce(() => refresh(true), 220);

  ctx.listen(el, 'click', (e) => {
    const b = e.target.closest('[data-ct]');
    if (!b) return;
    const a = b.dataset.ct;
    const i = Number(b.dataset.i);
    if (a === 'inc' || a === 'dec') {
      const it = cart.items[i];
      if (!it) return;
      cart.setQty(i, it.qty + (a === 'inc' ? 1 : -1));
      if (!cart.items.length) return renderCart(ctx);
      draw();
      reprice();
    } else if (a === 'rm') {
      cart.remove(i);
      if (!cart.items.length) return renderCart(ctx);
      refresh(true);
    } else if (a === 'clear') {
      cart.clear();
      ss.del(COUPON_KEY);
      renderCart(ctx);
    } else if (a === 'removebad') {
      const byKey = new Map(priced.lines.map((l) => [keyOf(l.productId, l.variantKey), l]));
      for (let k = cart.items.length - 1; k >= 0; k--) if (lineIssue(byKey.get(keyOf(cart.items[k].pid, cart.items[k].vk)))) cart.items.splice(k, 1);
      cart.save();
      if (!cart.items.length) return renderCart(ctx);
      refresh();
    } else if (a === 'rmcoupon') {
      coupon = '';
      couponErr = '';
      ss.del(COUPON_KEY);
      refresh(true);
    } else if (a === 'go') {
      track('InitiateCheckout', { ids: cart.items.map((x) => x.pid), value: cart.total(), contents: cart.items.map((x) => ({ id: x.pid, qty: x.qty, price: x.price, name: x.name })) });
    }
  });
  ctx.listen(el, 'submit', (e) => {
    const f = e.target.closest('[data-coupon-form]');
    if (!f) return;
    e.preventDefault();
    const code = f.code.value.trim().toUpperCase();
    if (!code) return;
    coupon = code;
    couponErr = '';
    ss.set(COUPON_KEY, code);
    refresh(true);
  });

  await refresh();
}

/* ====================================================================== */
/* checkout                                                               */
/* ====================================================================== */

let geoCache = null;
async function loadGeo() {
  if (geoCache) return geoCache;
  const r = await fetch('/data/bd-geo.json');
  geoCache = await r.json();
  return geoCache;
}

export const payLabel = (m) => ({ cod: t('pay_cod'), bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket' }[m] || m);

export function payInstructions(method, amount) {
  const pm = S.payments && S.payments[method];
  if (!pm || method === 'cod') return h``;
  const how = pm.kind === 'merchant' ? t('pay_how_merchant', { app: payLabel(method) }) : t('pay_how_personal', { app: payLabel(method) });
  return h`<div class="pay-box"><p>${how}</p><div class="pay-num"><b>${pm.number}</b><button type="button" class="btn btn-ghost btn-sm" data-act="copy" data-text="${pm.number}">${icon('copy')}${t('copy')}</button></div>${amount ? h`<p>${t('pay_amount')}: <b>${money(amount)}</b></p>` : ''}</div>`;
}

export async function renderCheckout(ctx) {
  ctx.setTitle(`${t('checkout')} | ${S.siteName}`);
  const el = ctx.el;
  if (!cart.items.length) {
    el.innerHTML = h`<section class="wrap sec">${emptyState(t('cart_empty'), t('cart_empty_sub'), h`<a class="btn btn-primary btn-lg" href="/shop">${t('start_shopping')}</a>`)}</section>`.s;
    return;
  }
  el.innerHTML = h`<section class="wrap checkout"><div class="sk sk-block"></div><div class="sk sk-block"></div></section>`.s;
  let geo;
  try {
    geo = await loadGeo();
  } catch (e) {
    el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), e.message, h`<button type="button" class="btn btn-primary" data-act="reload">${t('retry')}</button>`)}</section>`.s;
    return;
  }
  if (!ctx.alive()) return;

  const saved = customer.get();
  const lang = getLang();
  const nm = (x) => (lang === 'en' ? x.en : x.bn);
  const methods = ['cod', 'bkash', 'nagad', 'rocket'].filter((m) => S.payments && S.payments[m] && S.payments[m].enabled);
  let method = methods.includes(saved.method) ? saved.method : methods[0] || 'cod';
  let coupon = ss.get(COUPON_KEY, '');
  let district = saved.district || '';
  let priced = null;
  let submitting = false;

  const divOf = (dn) => geo.find((d) => d.districts.some((x) => x.en === dn));
  let division = (divOf(district) && divOf(district).en) || saved.division || '';
  if (!divOf(district)) district = '';

  el.innerHTML = h`<section class="wrap checkout">
<nav class="crumbs"><a href="/cart">${t('cart')}</a>${icon('right')}<span>${t('checkout')}</span></nav>
<h1>${t('checkout')}</h1>
<form class="co-grid" data-co novalidate>
<div class="co-main">
<fieldset class="co-sec"><legend><i>1</i>${t('your_details')}</legend>
<div class="fld"><label for="c-name">${t('full_name')}</label><input id="c-name" name="name" autocomplete="name" required maxlength="80" value="${saved.name || ''}"><p class="fld-err" hidden></p></div>
<div class="fld"><label for="c-phone">${t('mobile_number')}</label><input id="c-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="01XXXXXXXXX" value="${saved.phone || ''}"><p class="fld-err" hidden></p></div>
<div class="fld"><label for="c-email">${t('email_optional')}</label><input id="c-email" name="email" type="email" autocomplete="email" value="${saved.email || ''}"></div>
</fieldset>
<fieldset class="co-sec"><legend><i>2</i>${t('delivery_address')}</legend>
<div class="fld-row">
<div class="fld"><label for="c-div">${t('division')}</label><select id="c-div" name="division" required><option value="">${t('select')}</option>${geo.map((d) => h`<option value="${d.en}" ${d.en === division ? raw('selected') : ''}>${nm(d)}</option>`)}</select></div>
<div class="fld"><label for="c-dist">${t('district')}</label><select id="c-dist" name="district" required><option value="">${t('select')}</option>${(geo.find((d) => d.en === division) || { districts: [] }).districts.map((d) => h`<option value="${d.en}" ${d.en === district ? raw('selected') : ''}>${nm(d)}</option>`)}</select><p class="fld-err" hidden></p></div>
</div>
<div class="fld"><label for="c-area">${t('area_thana')}</label><input id="c-area" name="area" autocomplete="address-level3" maxlength="100" value="${saved.area || ''}"></div>
<div class="fld"><label for="c-addr">${t('full_address')}</label><textarea id="c-addr" name="address" rows="3" required maxlength="300" autocomplete="street-address" placeholder="${t('address_ph')}">${saved.address || ''}</textarea><p class="fld-err" hidden></p></div>
<div class="fld"><label for="c-note">${t('order_note')}</label><input id="c-note" name="note" maxlength="400" placeholder="${t('note_ph')}"></div>
<p class="ship-eta" data-eta></p>
</fieldset>
<fieldset class="co-sec"><legend><i>3</i>${t('payment')}</legend>
<div class="pay-opts" role="radiogroup" aria-label="${t('payment')}">${methods.map((m) => h`<label class="pay-opt${m === method ? ' on' : ''}"><input type="radio" name="method" value="${m}" ${m === method ? raw('checked') : ''}><span class="pay-nm">${payLabel(m)}</span><em>${m === 'cod' ? t('pay_cod_sub') : t('pay_mobile_sub')}</em></label>`)}</div>
<div data-pay-extra></div>
</fieldset>
<label class="check"><input type="checkbox" name="remember" ${saved.name ? raw('checked') : ''}><span>${t('remember_me')}</span></label>
<label class="check"><input type="checkbox" name="showLive" checked><span>${t('show_in_live')}</span></label>
<input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
</div>
<aside class="co-sum" data-sum><div class="sk sk-block"></div></aside>
</form></section>`.s;

  const form = $('[data-co]', el);
  const sumEl = $('[data-sum]', el);
  const payExtra = $('[data-pay-extra]', el);
  const etaEl = $('[data-eta]', el);

  function paintPay() {
    if (method === 'cod') {
      payExtra.innerHTML = h`<p class="pay-hint">${t('cod_hint')}</p>`.s;
      return;
    }
    const total = priced ? priced.total : 0;
    payExtra.innerHTML = h`${payInstructions(method, total)}
<div class="fld"><label for="c-trx">${t('trx_id')}</label><input id="c-trx" name="trxId" autocomplete="off" autocapitalize="characters" maxlength="30" placeholder="${t('trx_ph')}"><p class="fld-err" hidden></p></div>
<div class="fld"><label for="c-sender">${t('sender_number')}</label><input id="c-sender" name="senderNumber" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX"></div>`.s;
  }

  function paintSummary() {
    const p = priced;
    const lines = p ? p.lines : [];
    const byKey = new Map(lines.map((l) => [keyOf(l.productId, l.variantKey), l]));
    const co = p && p.coupon && !p.coupon.error ? p.coupon : null;
    sumEl.innerHTML = h`<h2>${t('order_summary')}</h2>
<ul class="co-items">${cart.items.map((it) => {
      const l = byKey.get(keyOf(it.pid, it.vk));
      const unit = (l && l.unitPrice) || it.price;
      return h`<li><span class="co-img"><img src="${it.image || '/img/placeholder.svg'}" alt=""><b>${it.qty}</b></span><span class="co-nm">${it.name}${it.vlabel ? h`<em>${it.vlabel}</em>` : ''}</span><span>${money(unit * it.qty)}</span></li>`;
    })}</ul>
<dl class="sum">
<div><dt>${t('subtotal')}</dt><dd>${p ? money(p.subtotal) : '...'}</dd></div>
${p && p.discount ? h`<div class="disc"><dt>${t('discount')}${co ? h` <em>${co.code}</em>` : ''}</dt><dd>-${money(p.discount)}</dd></div>` : ''}
<div><dt>${t('shipping')}</dt><dd>${p && p.shipping != null ? (p.shipping === 0 ? t('free') : money(p.shipping)) : t('pick_district')}</dd></div>
<div class="grand"><dt>${t('total')}</dt><dd>${p ? money(p.total) : '...'}</dd></div>
</dl>
${p && p.freeAbove && p.shipping != null && p.shipping > 0 ? h`<p class="sum-note">${t('free_ship_left', { n: money(Math.max(0, p.freeAbove - (p.subtotal - p.discount))) })}</p>` : ''}
<div class="coupon"><label for="co-cp">${t('have_coupon')}</label><div><input id="co-cp" data-co-cp value="${co ? co.code : coupon || ''}" autocomplete="off" autocapitalize="characters" placeholder="${t('coupon_code')}" ${co ? raw('readonly') : ''}>${co ? h`<button type="button" class="btn btn-ghost" data-ct="rmcp">${t('remove')}</button>` : h`<button type="button" class="btn btn-ghost" data-ct="applycp">${t('apply')}</button>`}</div></div>
<p class="form-err" data-form-err role="alert" hidden></p>
<button type="submit" class="btn btn-primary btn-lg btn-block" data-place ${submitting ? raw('disabled') : ''}>${t('place_order')} ${p ? '· ' + money(p.total) : ''}</button>
<p class="sum-note">${icon('lock')}${t('secure_note')}</p>`.s;
    if (p && p.zone) etaEl.textContent = tr(p.zone === 'inside' ? S.shipping.etaInside : S.shipping.etaOutside);
    else etaEl.textContent = '';
  }

  async function reprice() {
    try {
      const r = await api('/cart/price', { method: 'POST', body: { items: toLines(), district, coupon } });
      if (!ctx.alive()) return;
      priced = r;
      if (r.coupon && r.coupon.error) {
        coupon = '';
        ss.del(COUPON_KEY);
        toast(couponMsg(r.coupon), { kind: 'warn' });
      }
      const notes = syncCart(r);
      notes.forEach((n) => toast(n, { kind: 'warn' }));
    } catch (e) {
      if (!ctx.alive()) return;
      toast(e.message, { kind: 'warn' });
    }
    paintSummary();
    if (method !== 'cod') {
      const box = $('.pay-box', payExtra);
      if (box) box.outerHTML = payInstructions(method, priced ? priced.total : 0).s;
    }
  }

  const setErr = (input, msg) => {
    const p = input.closest('.fld') && input.closest('.fld').querySelector('.fld-err');
    input.classList.toggle('bad', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (p) {
      p.textContent = msg || '';
      p.hidden = !msg;
    }
    return !msg;
  };

  function validate() {
    const f = form;
    const bad = [];
    const nameOk = setErr(f.name, f.name.value.trim().length < 2 ? t('name_required') : '');
    const phoneOk = setErr(f.phone, normPhone(f.phone.value) ? '' : t('phone_invalid'));
    const distOk = setErr(f.district, f.district.value ? '' : t('district_required'));
    const addrOk = setErr(f.address, f.address.value.trim().length < 5 ? t('address_required') : '');
    let trxOk = true;
    if (method !== 'cod' && f.trxId) trxOk = setErr(f.trxId, /^[A-Za-z0-9]{6,24}$/.test(f.trxId.value.replace(/\s+/g, '')) ? '' : t('trx_required'));
    if (!nameOk) bad.push(f.name);
    if (!phoneOk) bad.push(f.phone);
    if (!distOk) bad.push(f.district);
    if (!addrOk) bad.push(f.address);
    if (!trxOk) bad.push(f.trxId);
    if (bad.length) {
      bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      bad[0].focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  ctx.listen(form, 'change', (e) => {
    const x = e.target;
    if (x.name === 'division') {
      division = x.value;
      const g = geo.find((d) => d.en === division);
      form.district.innerHTML = h`<option value="">${t('select')}</option>${(g ? g.districts : []).map((d) => h`<option value="${d.en}">${nm(d)}</option>`)}`.s;
      district = '';
      reprice();
    } else if (x.name === 'district') {
      district = x.value;
      setErr(x, '');
      reprice();
    } else if (x.name === 'method') {
      method = x.value;
      $$('.pay-opt', form).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      paintPay();
    }
  });
  ctx.listen(form, 'input', (e) => {
    if (e.target.classList.contains('bad')) setErr(e.target, '');
  });
  ctx.listen(form, 'click', (e) => {
    const b = e.target.closest('[data-ct]');
    if (!b) return;
    if (b.dataset.ct === 'applycp') {
      const code = ($('[data-co-cp]', form).value || '').trim().toUpperCase();
      if (!code) return;
      coupon = code;
      ss.set(COUPON_KEY, code);
      reprice();
    } else if (b.dataset.ct === 'rmcp') {
      coupon = '';
      ss.del(COUPON_KEY);
      reprice();
    }
  });
  ctx.listen(form, 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-co-cp]')) {
      e.preventDefault();
      const b = $('[data-ct="applycp"]', form);
      if (b) b.click();
    }
  });
  ctx.listen(form, 'focusin', (e) => {
    if (e.target === form.phone || e.target === form.name) document.body.classList.add('no-live');
  });

  ctx.listen(form, 'submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    const errEl = $('[data-form-err]', el);
    errEl.hidden = true;
    submitting = true;
    const btn = $('[data-place]', el);
    btn.disabled = true;
    btn.textContent = t('placing');
    const f = form;
    const phone = normPhone(f.phone.value);
    const body = {
      customer: { name: f.name.value.trim(), phone, email: f.email.value.trim(), district, area: f.area.value.trim(), address: f.address.value.trim(), note: f.note.value.trim() },
      items: toLines(),
      coupon,
      paymentMethod: method,
      trxId: method !== 'cod' && f.trxId ? f.trxId.value.trim() : '',
      senderNumber: method !== 'cod' && f.senderNumber ? f.senderNumber.value.trim() : '',
      source: getSource(),
      showInLive: f.showLive.checked,
      hp: f.hp.value,
    };
    try {
      const r = await api('/orders', { method: 'POST', body });
      const o = r.order;
      if (f.remember.checked) customer.set({ name: body.customer.name, phone, email: body.customer.email, division, district, area: body.customer.area, address: body.customer.address, method });
      else customer.clear();
      myOrders.add(o.number, phone);
      ss.set('tn_last', o);
      ss.set('tn_last_fresh', true);
      if (!r.duplicate) {
        const bought = cart.items.map((x) => ({ id: x.pid, qty: x.qty, price: x.price, name: x.name }));
        track('Purchase', { ids: bought.map((x) => x.id), name: bought[0] && bought[0].name, value: o.total, eventId: o.number, contents: bought });
      }
      cart.clear();
      ss.del(COUPON_KEY);
      navigate('/order/' + o.number, { replace: true });
    } catch (err) {
      submitting = false;
      if (!ctx.alive()) return;
      paintSummary();
      if (err instanceof ApiError && err.code === 'cart_invalid') {
        syncCart({ lines: (err.data && err.data.lines) || [] });
        toast(t('cart_changed'), { kind: 'warn' });
        navigate('/cart');
        return;
      }
      const msg = err.code === 'min_order' ? t('min_order', { n: money(err.data.min) }) : err.message;
      const e2 = $('[data-form-err]', el);
      if (e2) {
        e2.textContent = msg;
        e2.hidden = false;
        e2.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  });

  track('InitiateCheckout', { ids: cart.items.map((x) => x.pid), value: cart.total(), contents: cart.items.map((x) => ({ id: x.pid, qty: x.qty, price: x.price, name: x.name })) });
  paintPay();
  paintSummary();
  await reprice();
}

