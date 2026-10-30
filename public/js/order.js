// Order confirmation page and order tracking.
import { h, safeUrl } from './h.js';
import { t } from './i18n.js';
import { S, ss, api, money, num, fmtDate, myOrders, normPhone, waLink, pushSupported, pushStatus, enablePush, track, $ } from './core.js';
import { icon, toast, emptyState } from './ui.js';
import { query } from './router.js';
import { payLabel, payInstructions } from './cart.js';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export const statusLabel = (s) => t('st_' + s);

function timeline(o) {
  const dead = o.status === 'cancelled' || o.status === 'returned';
  const at = {};
  (o.timeline || []).forEach((x) => (at[x.status] = x));
  const idx = FLOW.indexOf(o.status);
  if (dead) {
    return h`<div class="tl-dead">${icon('info')}<div><b>${statusLabel(o.status)}</b>${at[o.status] ? h`<span>${fmtDate(at[o.status].at, true)}</span>` : ''}${at[o.status] && at[o.status].note ? h`<p>${at[o.status].note}</p>` : ''}</div></div>`;
  }
  return h`<ol class="tl">${FLOW.map((s, i) => h`<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"><i>${i <= idx ? icon('check') : ''}</i><div><b>${statusLabel(s)}</b>${at[s] ? h`<span>${fmtDate(at[s].at, true)}</span>` : ''}${at[s] && at[s].note ? h`<p>${at[s].note}</p>` : ''}</div></li>`)}</ol>`;
}

export function orderView(o, { placed = false } = {}) {
  const pay = o.payment || {};
  const needsPay = pay.method !== 'cod' && pay.status === 'pending_verification';
  return h`<div class="ord">
${placed ? h`<div class="ord-ok"><i>${icon('check')}</i><h1>${t('order_placed')}</h1><p>${t('order_placed_sub')}</p></div>` : h`<h1>${t('order_n', { n: o.number })}</h1>`}
<div class="ord-top"><div><span>${t('order_number')}</span><b>${o.number}</b><button type="button" class="ib" data-act="copy" data-text="${o.number}" aria-label="${t('copy')}">${icon('copy')}</button></div><div><span>${t('placed_on')}</span><b>${fmtDate(o.createdAt, true)}</b></div><div><span>${t('status')}</span><b class="st st-${o.status}">${statusLabel(o.status)}</b></div></div>
<section class="ord-card"><h2>${t('order_progress')}</h2>${timeline(o)}
${o.courier && (o.courier.name || o.courier.trackingId) ? h`<div class="courier">${icon('truck')}<div><b>${o.courier.name || t('courier')}</b>${o.courier.trackingId ? h`<span>${t('tracking_id')}: ${o.courier.trackingId}</span>` : ''}</div>${o.courier.url ? h`<a class="btn btn-ghost btn-sm" href="${safeUrl(o.courier.url)}" target="_blank" rel="noopener noreferrer">${t('track_with_courier')}</a>` : ''}</div>` : ''}
</section>
${needsPay ? h`<section class="ord-card"><h2>${t('payment_pending')}</h2><p>${t('payment_pending_sub', { app: payLabel(pay.method) })}</p>${payInstructions(pay.method, o.total)}</section>` : ''}
<div class="ord-cols">
<section class="ord-card"><h2>${t('items')}</h2><ul class="ord-items">${o.items.map((i) => h`<li><a href="/p/${i.slug}"><img src="${i.image || '/img/placeholder.svg'}" alt="" loading="lazy"></a><span><a href="/p/${i.slug}">${i.name}</a>${i.variantLabel ? h`<em>${i.variantLabel}</em>` : ''}<small>${money(i.unitPrice)} × ${i.qty}</small></span><b>${money(i.unitPrice * i.qty)}</b></li>`)}</ul>
<dl class="sum"><div><dt>${t('subtotal')}</dt><dd>${money(o.subtotal)}</dd></div>${o.discount ? h`<div class="disc"><dt>${t('discount')}${o.couponCode ? h` <em>${o.couponCode}</em>` : ''}</dt><dd>-${money(o.discount)}</dd></div>` : ''}<div><dt>${t('shipping')}</dt><dd>${o.shipping ? money(o.shipping) : t('free')}</dd></div><div class="grand"><dt>${t('total')}</dt><dd>${money(o.total)}</dd></div></dl></section>
<section class="ord-card"><h2>${t('delivery_to')}</h2><p class="ord-addr"><b>${o.customer.name}</b><br>${o.customer.phone}<br>${o.customer.address}${o.customer.area ? ', ' + o.customer.area : ''}<br>${o.customer.district}</p>
<h2 class="mt">${t('payment')}</h2><p>${payLabel(pay.method)} <span class="pay-st pay-${pay.status}">${t('ps_' + pay.status)}</span></p></section>
</div>
</div>`;
}

async function loadOrder(number, phone) {
  const r = await api('/orders/track?' + new URLSearchParams({ number, phone }).toString());
  return r.order;
}

function wireOrderActions(ctx, o) {
  const el = ctx.el;
  const hasWa = !!(S.contact && (S.contact.whatsapp || S.contact.phone));
  const host = $('[data-ord-actions]', el);
  if (!host) return;
  const msg = [t('wa_order_hello'), `${t('order_number')}: ${o.number}`, `${t('total')}: ${money(o.total)}`, `${location.origin}/order/${o.number}`].join('\n');
  host.innerHTML = h`${hasWa ? h`<a class="btn btn-wa" target="_blank" rel="noopener noreferrer" href="${waLink(msg)}">${icon('chat')}${t('message_us_whatsapp')}</a>` : ''}<span data-push></span><a class="btn btn-ghost" href="/shop">${t('continue_shopping')}</a>`.s;
  if (!pushSupported()) return;
  pushStatus().then((st) => {
    if (!ctx.alive()) return;
    const slot = $('[data-push]', el);
    if (!slot || st === 'unsupported' || st === 'denied') return;
    slot.innerHTML = h`<button type="button" class="btn btn-ghost" data-ord="push">${icon('bell')}${st === 'on' ? t('push_on_for_order') : t('push_get_updates')}</button>`.s;
    $('[data-ord="push"]', slot).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        await enablePush(o.number);
        toast(t('push_enabled'));
        b.innerHTML = h`${icon('bell')}${t('push_on_for_order')}`.s;
      } catch (err) {
        toast(t('push_denied'), { kind: 'warn' });
        b.disabled = false;
      }
    });
  });
}

function phoneAsk(number, err = '') {
  return h`<section class="wrap sec narrow"><div class="ord-ask"><h1>${t('order_n', { n: number })}</h1><p>${t('ask_phone_sub')}</p>
<form data-ask novalidate><div class="fld"><label for="ask-phone">${t('mobile_number')}</label><input id="ask-phone" name="phone" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" required autocomplete="tel"></div>${err ? h`<p class="form-err" role="alert">${err}</p>` : ''}<button class="btn btn-primary btn-block" type="submit">${t('view_order')}</button></form></div></section>`;
}

export async function renderOrder(ctx, m) {
  const number = decodeURIComponent(m[1]).toUpperCase();
  ctx.setTitle(`${t('order_n', { n: number })} | ${S.siteName}`);
  const el = ctx.el;
  el.innerHTML = h`<section class="wrap sec narrow"><div class="sk sk-block"></div></section>`.s;
  let order = null;
  let placed = false;
  const last = ss.get('tn_last', null);
  if (last && last.number === number) {
    order = last;
    placed = !!ss.get('tn_last_fresh', true);
    ss.set('tn_last_fresh', false);
  }
  const known = myOrders.list().find((x) => x.number === number);
  if (known) {
    try {
      order = await loadOrder(number, known.phone);
    } catch (e) {
      if (!order && e.status !== 404) {
        if (!ctx.alive()) return;
        el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), e.message)}</section>`.s;
        return;
      }
    }
  }
  if (!ctx.alive()) return;
  if (!order) {
    const draw = (err = '') => {
      el.innerHTML = phoneAsk(number, err).s;
      $('[data-ask]', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = normPhone(e.target.phone.value);
        if (!phone) return draw(t('phone_invalid'));
        try {
          const o = await loadOrder(number, phone);
          myOrders.add(number, phone);
          if (!ctx.alive()) return;
          show(o, false);
        } catch (er) {
          if (ctx.alive()) draw(er.message);
        }
      });
    };
    draw();
    return;
  }
  show(order, placed);

  function show(o, fresh) {
    el.innerHTML = h`<section class="wrap sec narrow">${orderView(o, { placed: fresh })}<div class="ord-actions" data-ord-actions></div></section>`.s;
    wireOrderActions(ctx, o);
    if (fresh) window.scrollTo(0, 0);
  }
}

export async function renderTrack(ctx) {
  ctx.setTitle(`${t('track_order')} | ${S.siteName}`);
  const el = ctx.el;
  const q = query();
  const mine = myOrders.list();
  el.innerHTML = h`<section class="wrap sec narrow track"><h1>${t('track_order')}</h1><p class="lead">${t('track_sub')}</p>
<form data-track novalidate>
<div class="fld"><label for="t-num">${t('order_number')}</label><input id="t-num" name="number" autocomplete="off" autocapitalize="characters" placeholder="${S.orderPrefix || 'TN'}10001" value="${q.number || (mine[0] && mine[0].number) || ''}" required></div>
<div class="fld"><label for="t-phone">${t('mobile_number')}</label><input id="t-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01XXXXXXXXX" value="${q.phone || (mine[0] && mine[0].phone) || ''}" required></div>
<p class="form-err" data-terr role="alert" hidden></p>
<button class="btn btn-primary btn-block btn-lg" type="submit">${t('track')}</button></form>
${mine.length ? h`<div class="my-orders"><h2>${t('your_recent_orders')}</h2><div class="chips-row">${mine.slice(0, 6).map((o) => h`<a class="pill" href="/order/${o.number}">${o.number}</a>`)}</div></div>` : ''}
<div data-result></div></section>`.s;
  const form = $('[data-track]', el);
  const out = $('[data-result]', el);
  const err = $('[data-terr]', el);
  async function run() {
    const number = form.number.value.trim().toUpperCase().replace(/\s+/g, '');
    const phone = normPhone(form.phone.value);
    err.hidden = true;
    if (!number) {
      err.textContent = t('order_number_required');
      err.hidden = false;
      return;
    }
    if (!phone) {
      err.textContent = t('phone_invalid');
      err.hidden = false;
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    out.innerHTML = h`<div class="sk sk-block"></div>`.s;
    try {
      const o = await loadOrder(number, phone);
      if (!ctx.alive()) return;
      myOrders.add(number, phone);
      out.innerHTML = h`<div class="track-res">${orderView(o)}<div class="ord-actions" data-ord-actions></div></div>`.s;
      wireOrderActions(ctx, o);
    } catch (e) {
      if (!ctx.alive()) return;
      out.innerHTML = '';
      err.textContent = e.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  }
  ctx.listen(form, 'submit', (e) => {
    e.preventDefault();
    run();
  });
  if (q.number && q.phone) run();
}

