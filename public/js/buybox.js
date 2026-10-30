// The "choose options, quantity, add to cart" block used on the product page and in quick view.
import { h } from './h.js';
import { t } from './i18n.js';
import { S, cart, money, track, waLink, messengerLink, copyText, clamp, api, $, $$ } from './core.js';
import { icon, toast, openModal, galleryHtml, bindGallery, stars } from './ui.js';
import { navigate } from './router.js';

export function buyBoxHtml(p) {
  const hasV = p.variants && p.variants.length;
  const wa = !!(S.contact && (S.contact.whatsapp || S.contact.phone));
  const ms = !!messengerLink();
  return h`<div class="bb" data-bb-root>
<div class="bb-priceRow"><div class="price big" data-bb-price></div></div>
<p class="bb-stock" data-bb-stock></p>
${hasV ? p.options.map((o) => h`<div class="opt" data-opt="${o.name}"><div class="opt-h"><span>${o.name}</span><b data-opt-val></b></div><div class="chips" role="radiogroup" aria-label="${o.name}">${o.values.map((v) => h`<button type="button" class="chip" role="radio" aria-checked="false" data-opt-name="${o.name}" data-val="${v}">${v}</button>`)}</div></div>`) : ''}
<div class="bb-row">
<div class="qty"><button type="button" data-bb="dec" aria-label="${t('less')}">${icon('minus')}</button><input data-bb-qty inputmode="numeric" value="1" aria-label="${t('quantity')}"><button type="button" data-bb="inc" aria-label="${t('more')}">${icon('plus')}</button></div>
<div class="bb-btns"><button type="button" class="btn btn-primary" data-bb="add">${icon('bag')}<span>${t('add_to_cart')}</span></button><button type="button" class="btn btn-ink" data-bb="buy">${t('buy_now')}</button></div>
</div>
${wa || ms ? h`<div class="bb-chat"><span>${t('order_by_chat')}</span>${wa ? h`<button type="button" class="btn btn-wa" data-bb="wa">${icon('chat')}<span>WhatsApp</span></button>` : ''}${ms ? h`<button type="button" class="btn btn-ms" data-bb="ms">${icon('chat')}<span>Messenger</span></button>` : ''}</div>` : ''}
</div>`;
}

export function stockLine(stock) {
  const th = (S.marketing && S.marketing.lowStockThreshold) || 0;
  if (stock <= 0) return { cls: 'out', text: t('stock_out') };
  if (th > 0 && stock <= th) return { cls: 'low', text: t('only_left', { n: stock }) };
  return { cls: 'ok', text: t('in_stock') };
}

// extra: element(s) outside the box that hold mirrored controls (the sticky mobile bar)
export function bindBuyBox(root, p, { extra = [], onAdded } = {}) {
  const box = root.querySelector('[data-bb-root]');
  if (!box) return {};
  const variants = p.variants || [];
  const hasV = variants.length > 0;
  const sel = {};
  let qty = 1;
  const priceEl = $('[data-bb-price]', box);
  const stockEl = $('[data-bb-stock]', box);
  const qtyEl = $('[data-bb-qty]', box);
  const mirrors = extra.filter(Boolean);

  // ?variant=... (from the product feed) pre-selects a combination
  const wanted = new URLSearchParams(location.search).get('variant');
  if (wanted && hasV) {
    const v = variants.find((x) => x.key === wanted);
    if (v) p.options.forEach((o) => (sel[o.name] = v.values[o.name]));
  }

  const current = () => {
    if (!hasV || !p.options.every((o) => sel[o.name])) return null;
    const key = p.options.map((o) => sel[o.name]).join('|');
    return variants.find((v) => v.key === key) || null;
  };
  const avail = (name, val) => variants.some((v) => v.values[name] === val && v.stock > 0 && p.options.every((o) => o.name === name || !sel[o.name] || v.values[o.name] === sel[o.name]));
  const maxQty = () => {
    const v = current();
    const s = v ? v.stock : p.stock;
    return Math.max(1, Math.min(99, s));
  };

  function refresh() {
    const v = current();
    const price = v ? v.price : p.price;
    const stock = v ? v.stock : p.stock;
    const compareP = p.comparePrice > price ? p.comparePrice : 0;
    const disc = compareP ? Math.round(((compareP - price) / compareP) * 100) : 0;
    priceEl.innerHTML = h`<b>${money(price)}</b>${compareP ? h`<s>${money(compareP)}</s><span class="sticker sm">-${disc}%</span>` : ''}`.s;
    const sl = stockLine(stock);
    stockEl.className = 'bb-stock ' + sl.cls;
    stockEl.textContent = hasV && !v && stock > 0 ? t('pick_options_hint') : sl.text;
    $$('.chip', box).forEach((c) => {
      const name = c.dataset.optName;
      const val = c.dataset.val;
      const on = sel[name] === val;
      c.classList.toggle('on', on);
      c.setAttribute('aria-checked', on ? 'true' : 'false');
      const ok = avail(name, val);
      c.classList.toggle('na', !ok && !on);
      c.disabled = !ok && !on;
    });
    $$('.opt', box).forEach((g) => {
      const val = $('[data-opt-val]', g);
      if (val) val.textContent = sel[g.dataset.opt] || '';
      g.classList.remove('need');
    });
    qty = clamp(qty, 1, maxQty());
    qtyEl.value = qty;
    const out = stock <= 0;
    [box, ...mirrors].forEach((r) => {
      $$('[data-bb="add"],[data-bb="buy"]', r).forEach((b) => (b.disabled = out));
      const pr = $('[data-bb-price-s]', r);
      if (pr) pr.innerHTML = h`<b>${money(price)}</b>${compareP ? h`<s>${money(compareP)}</s>` : ''}`.s;
    });
  }

  function needOptions() {
    const g = $$('.opt', box).find((x) => !sel[x.dataset.opt]);
    if (g) {
      g.classList.add('need');
      g.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    toast(t('pick_options'), { kind: 'warn' });
  }

  function addToCart(goCheckout) {
    const v = current();
    if (hasV && !v) return needOptions();
    const price = v ? v.price : p.price;
    const stock = v ? v.stock : p.stock;
    if (stock <= 0) return toast(t('stock_out'), { kind: 'warn' });
    cart.add({ pid: p.id, vk: v ? v.key : '', price, name: p.name, image: (p.images && p.images[0]) || p.image || '', slug: p.slug, vlabel: v ? v.label : '' }, qty);
    track('AddToCart', { ids: [p.id], group: hasV, name: p.name, value: price * qty, contents: [{ id: p.id, qty, price, name: p.name }] });
    if (goCheckout) {
      navigate('/checkout');
      return;
    }
    toast(t('added_to_cart'), { action: { label: t('view_cart'), href: '/cart' } });
    if (onAdded) onAdded();
  }

  function chatMessage() {
    const v = current();
    const price = v ? v.price : p.price;
    return [t('wa_hello'), `${p.name}${v ? ' (' + v.label + ')' : ''}`, `${t('quantity')}: ${qty}`, `${t('price')}: ${money(price * qty)}`, `${location.origin}/p/${p.slug}`].join('\n');
  }

  function onClick(e) {
    const chip = e.target.closest('.chip');
    if (chip && box.contains(chip)) {
      const name = chip.dataset.optName;
      sel[name] = sel[name] === chip.dataset.val ? undefined : chip.dataset.val;
      if (!sel[name]) delete sel[name];
      refresh();
      return;
    }
    const b = e.target.closest('[data-bb]');
    if (!b) return;
    const a = b.dataset.bb;
    if (a === 'inc') {
      qty = clamp(qty + 1, 1, maxQty());
      qtyEl.value = qty;
    } else if (a === 'dec') {
      qty = clamp(qty - 1, 1, maxQty());
      qtyEl.value = qty;
    } else if (a === 'add') addToCart(false);
    else if (a === 'buy') addToCart(true);
    else if (a === 'wa') {
      track('Contact', { ids: [p.id], name: p.name });
      window.open(waLink(chatMessage()), '_blank', 'noopener');
    } else if (a === 'ms') {
      track('Contact', { ids: [p.id], name: p.name });
      copyText(chatMessage()).then((ok) => ok && toast(t('msg_copied')));
      window.open(messengerLink(), '_blank', 'noopener');
    }
  }
  [box, ...mirrors].forEach((r) => r.addEventListener('click', onClick));
  qtyEl.addEventListener('change', () => {
    qty = clamp(parseInt(String(qtyEl.value).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)), 10) || 1, 1, maxQty());
    qtyEl.value = qty;
  });
  refresh();
  return { refresh };
}

/* ---------------- quick view popup ---------------- */
export async function quickView(slug) {
  const m = openModal(h`<div class="qv-load"><div class="sk sk-img"></div><div><div class="sk sk-line"></div><div class="sk sk-line w60"></div></div></div>`, { cls: 'qv', label: t('quick_view') });
  try {
    const { product: p } = await api('/products/' + encodeURIComponent(slug));
    m.body.innerHTML = h`<div class="qv-grid">
<div class="qv-gal">${galleryHtml(p.images, p.name)}</div>
<div class="qv-info">
<h2 class="qv-title">${p.name}</h2>
<div class="pc-meta">${p.ratingCount ? h`${stars(p.rating)}<span class="pc-rc">${p.rating} (${p.ratingCount})</span>` : ''}${p.brand ? h`<span class="pc-brand">${p.brand}</span>` : ''}</div>
${buyBoxHtml(p)}
<a class="qv-more" href="/p/${p.slug}" data-close>${t('full_details')}${icon('right')}</a>
</div></div>`.s;
    bindGallery(m.body, p.images);
    bindBuyBox(m.body, p, { onAdded: () => m.close() });
    track('ViewContent', { ids: [p.id], group: p.hasVariants, name: p.name, value: p.price });
  } catch (e) {
    m.close();
    toast(e.message, { kind: 'warn' });
  }
}
