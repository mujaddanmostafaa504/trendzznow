// Policy and info pages (with the contact form), account hub, wishlist and product comparison.
import { h, md } from './h.js';
import { t, getLang } from './i18n.js';
import { S, api, money, num, tr, catName, wish, compare, customer, myOrders, waLink, messengerLink, getTheme, setTheme, setLang, pushSupported, pushStatus, enablePush, disablePush, isStandalone, isIOS, pwa, $ } from './core.js';
import { icon, stars, toast, cardsHtml, skeletonCards, emptyState } from './ui.js';
import { doInstall, renderCompareTray } from './chrome.js';

/* ---------------- policy / info pages ---------------- */
function contactForm() {
  const c = customer.get();
  return h`<form class="contact-form" data-contact novalidate>
<h2>${t('send_message')}</h2>
<div class="fld-row"><div class="fld"><label for="ct-name">${t('your_name')}</label><input id="ct-name" name="name" required maxlength="80" autocomplete="name" value="${c.name || ''}"></div>
<div class="fld"><label for="ct-phone">${t('mobile_number')}</label><input id="ct-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" value="${c.phone || ''}"></div></div>
<div class="fld"><label for="ct-email">${t('email_optional')}</label><input id="ct-email" name="email" type="email" autocomplete="email"></div>
<div class="fld"><label for="ct-msg">${t('your_message')}</label><textarea id="ct-msg" name="message" rows="5" required maxlength="2000"></textarea></div>
<input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
<p class="form-err" data-cerr role="alert" hidden></p>
<button class="btn btn-primary" type="submit">${t('send')}</button></form>`;
}

function quickContact() {
  const c = S.contact || {};
  const ms = messengerLink();
  return h`<div class="quick-contact">${c.whatsapp || c.phone ? h`<a class="btn btn-wa" target="_blank" rel="noopener noreferrer" href="${waLink('')}">${icon('chat')}WhatsApp</a>` : ''}${ms ? h`<a class="btn btn-ms" target="_blank" rel="noopener noreferrer" href="${ms}">${icon('chat')}Messenger</a>` : ''}${c.phone ? h`<a class="btn btn-ghost" href="tel:${c.phone}">${icon('phone')}${t('call_us')}</a>` : ''}</div>`;
}

export async function renderPage(ctx, m) {
  const slug = decodeURIComponent(m[1]);
  const el = ctx.el;
  el.innerHTML = h`<section class="wrap sec narrow"><div class="sk sk-line w40"></div><div class="sk sk-block"></div></section>`.s;
  let pg;
  try {
    pg = await api('/pages/' + encodeURIComponent(slug));
  } catch (e) {
    if (!ctx.alive()) return;
    ctx.setTitle(`${t('not_found')} | ${S.siteName}`);
    el.innerHTML = h`<section class="wrap sec">${emptyState(e.status === 404 ? t('page_not_found') : t('err_load'), '', h`<a class="btn btn-primary" href="/">${t('go_home')}</a>`)}</section>`.s;
    return;
  }
  if (!ctx.alive()) return;
  const en = getLang() === 'en';
  const title = en && pg.titleEn ? pg.titleEn : pg.title;
  const body = en && pg.bodyEn ? pg.bodyEn : pg.body;
  ctx.setTitle(`${title} | ${S.siteName}`);
  el.innerHTML = h`<section class="wrap sec narrow page"><nav class="crumbs"><a href="/">${t('nav_home')}</a>${icon('right')}<span>${title}</span></nav><h1>${title}</h1><div class="prose">${md(body)}</div>${slug === 'contact' ? h`${quickContact()}${contactForm()}` : ''}</section>`.s;
  const form = $('[data-contact]', el);
  if (form) {
    ctx.listen(form, 'submit', async (e) => {
      e.preventDefault();
      const err = $('[data-cerr]', form);
      err.hidden = true;
      const name = form.name.value.trim();
      const message = form.message.value.trim();
      if (name.length < 2 || message.length < 3) {
        err.textContent = name.length < 2 ? t('name_required') : t('message_required');
        err.hidden = false;
        return;
      }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await api('/contact', { method: 'POST', body: { name, phone: form.phone.value.trim(), email: form.email.value.trim(), message, hp: form.hp.value } });
        form.outerHTML = h`<div class="rv-thanks">${icon('check')}<b>${t('message_sent')}</b></div>`.s;
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }
}

/* ---------------- wishlist ---------------- */
export async function renderWishlist(ctx) {
  ctx.setTitle(`${t('wishlist')} | ${S.siteName}`);
  const el = ctx.el;
  const draw = async () => {
    if (!wish.list.length) {
      el.innerHTML = h`<section class="wrap sec">${emptyState(t('wishlist_empty'), t('wishlist_empty_sub'), h`<a class="btn btn-primary" href="/shop">${t('start_shopping')}</a>`)}</section>`.s;
      return;
    }
    el.innerHTML = h`<section class="wrap sec"><div class="sec-head"><h1>${t('wishlist')}</h1></div><div class="grid">${skeletonCards(Math.min(8, wish.list.length))}</div></section>`.s;
    try {
      const d = await api('/products?ids=' + encodeURIComponent(wish.list.join(',')));
      if (!ctx.alive()) return;
      // forget products that no longer exist
      const live = new Set(d.items.map((x) => x.id));
      wish.list.filter((id) => !live.has(id)).forEach((id) => wish.remove(id));
      el.innerHTML = h`<section class="wrap sec"><div class="sec-head"><h1>${t('wishlist')}</h1><span class="muted">${t('n_products', { n: num(d.items.length) })}</span></div>${d.items.length ? h`<div class="grid">${cardsHtml(d.items)}</div>` : emptyState(t('wishlist_empty'), t('wishlist_empty_sub'), h`<a class="btn btn-primary" href="/shop">${t('start_shopping')}</a>`)}</section>`.s;
    } catch (e) {
      if (ctx.alive()) el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), e.message, h`<button type="button" class="btn btn-primary" data-act="reload">${t('retry')}</button>`)}</section>`.s;
    }
  };
  // removing a heart on this page drops the card
  ctx.listen(el, 'click', (e) => {
    const b = e.target.closest('[data-act="wish"]');
    if (!b) return;
    setTimeout(() => {
      const c = b.closest('.pc');
      if (c && !wish.has(b.dataset.id)) {
        c.remove();
        if (!$('.pc', el)) draw();
      }
    }, 0);
  });
  await draw();
}

/* ---------------- compare ---------------- */
export async function renderCompare(ctx) {
  ctx.setTitle(`${t('compare')} | ${S.siteName}`);
  const el = ctx.el;
  const ids = compare.list;
  if (!ids.length) {
    el.innerHTML = h`<section class="wrap sec">${emptyState(t('compare_empty'), t('compare_empty_sub'), h`<a class="btn btn-primary" href="/shop">${t('start_shopping')}</a>`)}</section>`.s;
    return;
  }
  el.innerHTML = h`<section class="wrap sec"><div class="sec-head"><h1>${t('compare')}</h1></div><div class="sk sk-block"></div></section>`.s;
  let items;
  try {
    items = (await api('/products?ids=' + encodeURIComponent(ids.join(',')))).items;
  } catch (e) {
    if (ctx.alive()) el.innerHTML = h`<section class="wrap sec">${emptyState(t('err_load'), e.message)}</section>`.s;
    return;
  }
  if (!ctx.alive()) return;
  const bestPrice = Math.min(...items.map((x) => x.price));
  const bestRate = Math.max(...items.map((x) => x.rating));
  const rows = [
    [t('price'), (x) => h`<b class="${x.price === bestPrice && items.length > 1 ? 'best' : ''}">${money(x.price)}</b>${x.comparePrice ? h`<s>${money(x.comparePrice)}</s>` : ''}`],
    [t('discount'), (x) => (x.discount ? h`<span class="sticker sm">-${x.discount}%</span>` : '-')],
    [t('rating'), (x) => (x.ratingCount ? h`<span class="${x.rating === bestRate && items.length > 1 ? 'best' : ''}">${stars(x.rating)} ${x.rating} (${x.ratingCount})</span>` : t('no_reviews_yet'))],
    [t('brand'), (x) => x.brand || '-'],
    [t('category'), (x) => (x.category ? catName(x.category) : '-')],
    [t('availability'), (x) => (x.inStock ? (x.lowStock ? t('only_left', { n: x.lowStock }) : t('in_stock')) : t('stock_out'))],
  ];
  el.innerHTML = h`<section class="wrap sec"><div class="sec-head"><h1>${t('compare')}</h1><button type="button" class="btn-link" data-cmp="clear">${t('clear')}</button></div>
<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th></th>${items.map((x) => h`<th><div class="cmp-prod"><a href="/p/${x.slug}"><img src="${x.image || '/img/placeholder.svg'}" alt=""></a><a class="cmp-nm" href="/p/${x.slug}">${x.name}</a><button type="button" class="btn-link" data-cmp="rm" data-id="${x.id}">${t('remove')}</button></div></th>`)}</tr></thead>
<tbody>${rows.map(([label, fn]) => h`<tr><th scope="row">${label}</th>${items.map((x) => h`<td>${fn(x)}</td>`)}</tr>`)}
<tr><th scope="row"></th>${items.map((x) => h`<td><a class="btn btn-primary btn-sm" href="/p/${x.slug}">${x.hasVariants ? t('choose_options') : t('view_details')}</a></td>`)}</tr></tbody></table></div></section>`.s;
  ctx.listen(el, 'click', (e) => {
    const b = e.target.closest('[data-cmp]');
    if (!b) return;
    if (b.dataset.cmp === 'rm') compare.remove(b.dataset.id);
    else compare.clear();
    renderCompareTray();
    renderCompare(ctx);
  });
}

/* ---------------- account (no login: details live on this device) ---------------- */
export async function renderAccount(ctx) {
  ctx.setTitle(`${t('nav_account')} | ${S.siteName}`);
  const el = ctx.el;
  const c = customer.get();
  const mine = myOrders.list();
  const lang = getLang();
  el.innerHTML = h`<section class="wrap sec narrow account"><h1>${t('nav_account')}</h1>
<p class="lead">${c.name ? t('hello_name', { name: c.name.split(/\s+/)[0] }) : t('account_sub')}</p>
<div class="acc-grid">
<a class="acc-tile" href="/track">${icon('box')}<b>${t('track_order')}</b><span>${t('acc_track_sub')}</span></a>
<a class="acc-tile" href="/wishlist">${icon('heart')}<b>${t('wishlist')}</b><span>${t('n_products', { n: num(wish.list.length) })}</span></a>
<a class="acc-tile" href="/compare">${icon('compare')}<b>${t('compare')}</b><span>${t('n_products', { n: num(compare.list.length) })}</span></a>
<a class="acc-tile" href="/page/contact">${icon('chat')}<b>${t('contact_us')}</b><span>${t('acc_contact_sub')}</span></a>
</div>
<section class="ord-card"><h2>${t('your_recent_orders')}</h2>${mine.length ? h`<ul class="my-ord-list">${mine.map((o) => h`<li><a href="/order/${o.number}"><b>${o.number}</b><span>${new Date(o.at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB')}</span>${icon('right')}</a></li>`)}</ul>` : h`<p class="muted">${t('no_orders_yet')}</p>`}</section>
<section class="ord-card"><h2>${t('saved_details')}</h2>${c.name ? h`<p class="ord-addr"><b>${c.name}</b><br>${c.phone || ''}<br>${c.address || ''}${c.area ? ', ' + c.area : ''}${c.district ? '<br>' + c.district : ''}</p><button type="button" class="btn btn-ghost btn-sm" data-ac="forget">${icon('trash')}${t('forget_details')}</button>` : h`<p class="muted">${t('no_saved_details')}</p>`}</section>
<section class="ord-card"><h2>${t('settings')}</h2>
<div class="set-row"><span>${t('language')}</span><div class="seg"><button type="button" class="${lang === 'bn' ? 'on' : ''}" data-ac="lang-bn">বাংলা</button><button type="button" class="${lang === 'en' ? 'on' : ''}" data-ac="lang-en">English</button></div></div>
<div class="set-row"><span>${t('theme')}</span><div class="seg"><button type="button" class="${getTheme() === 'light' ? 'on' : ''}" data-ac="theme-light">${icon('sun')}${t('light')}</button><button type="button" class="${getTheme() === 'dark' ? 'on' : ''}" data-ac="theme-dark">${icon('moon')}${t('dark')}</button></div></div>
<div class="set-row" data-push-row hidden><span>${t('notifications')}</span><button type="button" class="btn btn-ghost btn-sm" data-ac="push"></button></div>
${!isStandalone() && (pwa.prompt || isIOS()) ? h`<div class="set-row"><span>${t('install_title', { name: S.siteName })}</span><button type="button" class="btn btn-ghost btn-sm" data-ac="install">${icon('download')}${t('install')}</button></div>` : ''}
</section></section>`.s;

  async function paintPush() {
    const row = $('[data-push-row]', el);
    if (!row || !pushSupported()) return;
    const st = await pushStatus();
    if (!ctx.alive() || st === 'unsupported') return;
    row.hidden = false;
    const b = $('[data-ac="push"]', row);
    b.textContent = st === 'on' ? t('turn_off') : st === 'denied' ? t('blocked_in_browser') : t('turn_on');
    b.disabled = st === 'denied';
    b.dataset.state = st;
  }
  paintPush();

  ctx.listen(el, 'click', async (e) => {
    const b = e.target.closest('[data-ac]');
    if (!b) return;
    const a = b.dataset.ac;
    if (a === 'forget') {
      customer.clear();
      renderAccount(ctx);
    } else if (a === 'lang-bn') setLang('bn');
    else if (a === 'lang-en') setLang('en');
    else if (a === 'theme-light' || a === 'theme-dark') {
      setTheme(a === 'theme-dark' ? 'dark' : 'light');
      renderAccount(ctx);
    } else if (a === 'install') doInstall();
    else if (a === 'push') {
      b.disabled = true;
      try {
        if (b.dataset.state === 'on') {
          await disablePush();
          toast(t('push_disabled'));
        } else {
          await enablePush();
          toast(t('push_enabled'));
        }
      } catch (err) {
        toast(t('push_denied'), { kind: 'warn' });
      }
      paintPush();
    }
  });
}

