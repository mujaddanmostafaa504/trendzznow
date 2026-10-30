// Single product page: gallery, buy box, sticky mobile bar, live viewers, reviews with photos, related items.
import { h, md } from './h.js';
import { t } from './i18n.js';
import { S, api, qs, money, num, tr, catName, recent, wish, compare, customer, track, sessionId, fmtDate, fileToDataUrl, $, $$ } from './core.js';
import { icon, stars, toast, galleryHtml, bindGallery, emptyState } from './ui.js';
import { buyBoxHtml, bindBuyBox } from './buybox.js';
import { sectionHead, railHtml, bindRails, recentSection } from './home.js';

function reviewHtml(r) {
  return h`<article class="rv">
<header><span class="rv-av" aria-hidden="true">${(r.name || '?').trim().slice(0, 1).toUpperCase()}</span><div><b>${r.name}</b>${r.verified ? h`<span class="rv-ver">${icon('check')}${t('verified_buyer')}</span>` : ''}<div class="rv-sub">${stars(r.rating)}<time>${fmtDate(r.createdAt)}</time></div></div></header>
<p>${r.text}</p>
${r.photos && r.photos.length ? h`<div class="rv-photos">${r.photos.map((u, i) => h`<button type="button" data-act="lightbox" data-images="${JSON.stringify(r.photos)}" data-i="${i}" aria-label="${t('photo_n', { n: i + 1 })}"><img src="${u}" alt="" loading="lazy"></button>`)}</div>` : ''}
</article>`;
}

function reviewSummary(rv) {
  const total = rv.count || 0;
  return h`<div class="rv-sum">
<div class="rv-big"><b>${total ? rv.avg.toFixed(1) : '-'}</b>${stars(rv.avg)}<span>${t('n_reviews', { n: num(total) })}</span></div>
<div class="rv-bars">${rv.dist.map((c, i) => h`<div class="rv-bar"><span>${5 - i}</span>${icon('star')}<i><u style="width:${total ? Math.round((c / total) * 100) : 0}%"></u></i><em>${num(c)}</em></div>`)}</div>
</div>`;
}

function reviewFormHtml(p) {
  const c = customer.get();
  return h`<form class="rv-form" data-rv-form novalidate>
<h3>${t('write_review')}</h3>
<div class="rv-rate" role="radiogroup" aria-label="${t('your_rating')}"><span>${t('your_rating')}</span>${[1, 2, 3, 4, 5].map((n) => h`<button type="button" class="star-btn" role="radio" aria-checked="false" data-star="${n}" aria-label="${n}">${icon('star')}</button>`)}</div>
<div class="fld"><label for="rv-name">${t('your_name')}</label><input id="rv-name" name="name" autocomplete="name" maxlength="60" value="${c.name || ''}" required></div>
<div class="fld"><label for="rv-text">${t('your_review')}</label><textarea id="rv-text" name="text" rows="4" maxlength="1500" required placeholder="${t('review_ph')}"></textarea></div>
<div class="fld"><label for="rv-phone">${t('phone_optional')}</label><input id="rv-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${c.phone || ''}"><small>${t('verified_hint')}</small></div>
<div class="fld"><span class="lbl">${t('add_photos')}</span><div class="rv-up" data-rv-up><label class="rv-add"><input type="file" accept="image/*" multiple hidden data-rv-file>${icon('camera')}<span>${t('add_photo')}</span></label></div><small>${t('photos_hint')}</small></div>
<input type="text" name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<p class="form-err" data-rv-err role="alert" hidden></p>
<div class="rv-actions"><button type="button" class="btn btn-ghost" data-rv="cancel">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('submit_review')}</button></div>
</form>`;
}

export async function renderProduct(ctx, m) {
  const slug = decodeURIComponent(m[1]);
  ctx.el.innerHTML = h`<div class="wrap pdp"><div class="pdp-grid"><div class="sk sk-img"></div><div><div class="sk sk-line w60"></div><div class="sk sk-line"></div><div class="sk sk-line w40"></div><div class="sk sk-block"></div></div></div></div>`.s;
  let d;
  try {
    d = await api('/products/' + encodeURIComponent(slug));
  } catch (e) {
    if (!ctx.alive()) return;
    ctx.setTitle(`${t('not_found')} | ${S.siteName}`);
    ctx.el.innerHTML = h`<section class="wrap sec">${emptyState(e.status === 404 ? t('product_not_found') : t('err_load'), e.status === 404 ? t('product_not_found_sub') : e.message, h`<a class="btn btn-primary" href="/shop">${t('all_products')}</a>`)}</section>`.s;
    return;
  }
  if (!ctx.alive()) return;
  const p = d.product;
  const rv = d.reviews;
  ctx.setTitle(`${p.name} | ${S.siteName}`);
  const rel = d.related || [];
  const hasChat = !!(S.contact && (S.contact.whatsapp || S.contact.phone));
  const eta = tr(S.shipping && S.shipping.etaInside);
  const etaOut = tr(S.shipping && S.shipping.etaOutside);
  const freeAbove = S.shipping && S.shipping.freeAbove;
  const pageUrl = `${location.origin}/p/${p.slug}`;
  const wished = wish.has(p.id);
  const cmp = compare.has(p.id);
  const cat = p.category;
  const desc = p.description ? md(p.description) : null;

  ctx.el.innerHTML = h`<div class="wrap pdp">
<nav class="crumbs" aria-label="${t('breadcrumb')}"><a href="/">${t('nav_home')}</a>${icon('right')}${cat ? h`<a href="/c/${cat.slug}">${catName(cat)}</a>${icon('right')}` : ''}<span>${p.name}</span></nav>
<div class="pdp-grid">
<div class="pdp-gal">${galleryHtml(p.images, p.name)}${p.discount ? h`<span class="sticker lg">-${p.discount}%</span>` : ''}</div>
<div class="pdp-info">
${p.brand ? h`<a class="pdp-brand" href="/shop?brand=${encodeURIComponent(p.brand)}">${p.brand}</a>` : ''}
<h1 class="pdp-title">${p.name}</h1>
<div class="pdp-meta">${p.ratingCount ? h`<a href="#reviews" class="pdp-rate" data-jump="reviews">${stars(p.rating)}<span>${p.rating} (${num(p.ratingCount)})</span></a>` : h`<a href="#reviews" class="pdp-rate muted" data-jump="reviews">${t('no_reviews_yet')}</a>`}${p.sold >= 3 ? h`<span class="pdp-sold">${icon('tag')}${t('sold_n', { n: num(p.sold) })}</span>` : ''}<span class="pdp-viewers" data-viewers hidden></span></div>
${buyBoxHtml(p)}
<ul class="pdp-perks">
<li>${icon('truck')}<span><b>${t('trust_cod')}</b>${eta ? h` <em>${eta}${etaOut ? ' | ' + etaOut : ''}</em>` : ''}${freeAbove > 0 ? h` <em>${t('free_delivery_over', { n: money(freeAbove) })}</em>` : ''}</span></li>
<li>${icon('refresh')}<span><a href="/page/return-policy">${t('trust_return_sub')}</a></span></li>
<li>${icon('shield')}<span>${t('trust_pay_sub')}</span></li>
</ul>
<div class="pdp-tools">
<button type="button" class="btn btn-ghost btn-sm${wished ? ' on' : ''}" data-act="wish" data-id="${p.id}" data-name="${p.name}" aria-pressed="${wished}">${icon('heart')}<span>${t('wishlist')}</span></button>
<button type="button" class="btn btn-ghost btn-sm${cmp ? ' on' : ''}" data-act="compare" data-id="${p.id}" data-name="${p.name}" data-image="${p.image}" data-slug="${p.slug}" aria-pressed="${cmp}">${icon('compare')}<span>${t('compare')}</span></button>
<button type="button" class="btn btn-ghost btn-sm" data-act="share" data-url="${pageUrl}" data-title="${p.name}">${icon('share')}<span>${t('share')}</span></button>
<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}">Facebook</a>
<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(p.name + ' ' + pageUrl)}">WhatsApp</a>
</div>
${p.sku ? h`<p class="pdp-sku">${t('sku')}: ${p.sku}</p>` : ''}
</div>
</div>
${desc ? h`<section class="pdp-sec" id="desc"><h2>${t('description')}</h2><div class="prose">${desc}</div>${p.tags && p.tags.length ? h`<div class="pdp-tags">${p.tags.map((x) => h`<a class="pill" href="/shop?q=${encodeURIComponent(x)}">${x}</a>`)}</div>` : ''}</section>` : ''}
<section class="pdp-sec" id="reviews" tabindex="-1"><div class="sec-head"><h2>${t('reviews')}</h2><button type="button" class="btn btn-primary btn-sm" data-rv="open">${icon('plus')}${t('write_review')}</button></div>
${rv.count ? reviewSummary(rv) : h`<p class="muted">${t('no_reviews_yet_sub')}</p>`}
<div data-rv-formhost></div>
${rv.photoCount ? h`<div class="rv-filter"><button type="button" class="pill on" data-rv="all">${t('all_reviews')}</button><button type="button" class="pill" data-rv="photos">${icon('camera')}${t('with_photos', { n: rv.photoCount })}</button></div>` : ''}
<div class="rv-list" data-rv-list>${rv.items.map(reviewHtml)}</div>
<div class="more" data-rv-more>${rv.count > rv.items.length ? h`<button type="button" class="btn btn-ghost" data-rv="more">${t('load_more')}</button>` : ''}</div>
</section>
${rel.length ? h`<section class="pdp-sec">${sectionHead(t('related_products'))}${railHtml(rel)}</section>` : ''}
<div data-recent></div>
</div>
<div class="sticky-buy" data-sticky aria-hidden="true"><div class="sb-info"><span class="sb-name">${p.name}</span><span class="sb-price" data-bb-price-s></span></div>${hasChat ? h`<button type="button" class="btn btn-wa ib" data-bb="wa" aria-label="WhatsApp">${icon('chat')}</button>` : ''}<button type="button" class="btn btn-primary" data-bb="add">${icon('bag')}<span>${t('add_to_cart')}</span></button></div>`.s;

  const root = ctx.el;
  const stickyEl = $('[data-sticky]', root);
  bindGallery(root, p.images);
  bindRails(ctx);
  recent.push(p.id);
  track('ViewContent', { ids: [p.id], group: p.hasVariants, name: p.name, value: p.price });

  const bb = bindBuyBox(root.querySelector('.pdp-info'), p, { extra: [stickyEl] });
  void bb;

  // sticky add to cart bar while the real button is out of view
  const row = $('.bb-row', root);
  if (row && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => {
      const show = !en.isIntersecting;
      stickyEl.classList.toggle('show', show);
      stickyEl.setAttribute('aria-hidden', show ? 'false' : 'true');
      document.body.classList.toggle('has-sticky', show);
    }, { rootMargin: '0px 0px -8px 0px' });
    io.observe(row);
    ctx.cleanup(() => {
      io.disconnect();
      document.body.classList.remove('has-sticky');
    });
  }

  // "N people are looking at this" (real visitors only, shown from 2 up)
  const viewersEl = $('[data-viewers]', root);
  const ping = async () => {
    if (document.hidden) return;
    try {
      const r = await api('/presence', { method: 'POST', body: { pid: p.id, sid: sessionId() } });
      if (!ctx.alive()) return;
      if (r.viewers >= 2) {
        viewersEl.innerHTML = h`${icon('eye')}${t('viewing_now', { n: r.viewers })}`.s;
        viewersEl.hidden = false;
      } else viewersEl.hidden = true;
    } catch (e) {
      /* social proof is optional */
    }
  };
  ping();
  const iv = setInterval(ping, 25000);
  ctx.cleanup(() => clearInterval(iv));

  // jump to reviews
  ctx.listen(root, 'click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) {
      e.preventDefault();
      const tgt = $('#' + j.dataset.jump, root);
      if (tgt) {
        tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tgt.focus({ preventScroll: true });
      }
    }
  });

  // reviews: filter, load more, write
  const list = $('[data-rv-list]', root);
  const moreEl = $('[data-rv-more]', root);
  const formHost = $('[data-rv-formhost]', root);
  let rvPage = 1;
  let onlyPhotos = false;
  let rvTotal = rv.count;
  async function loadReviews(reset) {
    if (reset) {
      rvPage = 1;
      list.innerHTML = h`<div class="sk sk-line"></div><div class="sk sk-line w60"></div>`.s;
    } else rvPage++;
    try {
      const r = await api(`/products/${p.id}/reviews?` + qs({ page: rvPage > 1 ? rvPage : '', photos: onlyPhotos ? '1' : '' }));
      if (!ctx.alive()) return;
      rvTotal = r.total;
      if (reset) list.innerHTML = '';
      list.insertAdjacentHTML('beforeend', r.items.map((x) => reviewHtml(x).s).join(''));
      moreEl.innerHTML = r.page < r.pages ? h`<button type="button" class="btn btn-ghost" data-rv="more">${t('load_more')}</button>`.s : '';
    } catch (e) {
      toast(e.message, { kind: 'warn' });
    }
  }
  let formState = null;
  function openForm() {
    if (formHost.firstElementChild) {
      formHost.firstElementChild.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    formHost.innerHTML = reviewFormHtml(p).s;
    formState = { rating: 0, photos: [] };
    $('#rv-name', formHost).focus({ preventScroll: false });
  }
  function paintStars() {
    $$('.star-btn', formHost).forEach((b) => {
      const on = Number(b.dataset.star) <= formState.rating;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', Number(b.dataset.star) === formState.rating ? 'true' : 'false');
    });
  }
  function paintPhotos() {
    const up = $('[data-rv-up]', formHost);
    $$('.rv-th', up).forEach((x) => x.remove());
    const add = $('.rv-add', up);
    formState.photos.forEach((u, i) => add.insertAdjacentHTML('beforebegin', h`<div class="rv-th"><img src="${u}" alt=""><button type="button" data-rv="rmphoto" data-i="${i}" aria-label="${t('remove')}">${icon('x')}</button></div>`.s));
    add.hidden = formState.photos.length >= 3;
  }
  ctx.listen(root, 'click', async (e) => {
    const b = e.target.closest('[data-rv],[data-star]');
    if (!b || !root.contains(b)) return;
    if (b.dataset.star) {
      formState.rating = Number(b.dataset.star);
      paintStars();
      return;
    }
    const a = b.dataset.rv;
    if (a === 'open') openForm();
    else if (a === 'cancel') {
      formHost.innerHTML = '';
      formState = null;
    } else if (a === 'more') {
      b.disabled = true;
      await loadReviews(false);
    } else if (a === 'all' || a === 'photos') {
      onlyPhotos = a === 'photos';
      $$('.rv-filter .pill', root).forEach((x) => x.classList.toggle('on', x === b));
      await loadReviews(true);
    } else if (a === 'rmphoto') {
      formState.photos.splice(Number(b.dataset.i), 1);
      paintPhotos();
    }
  });
  ctx.listen(root, 'change', async (e) => {
    if (!e.target.matches('[data-rv-file]') || !formState) return;
    const files = [...e.target.files].slice(0, 3 - formState.photos.length);
    e.target.value = '';
    for (const f of files) {
      try {
        formState.photos.push(await fileToDataUrl(f, { max: 1100, quality: 0.8 }));
      } catch (err) {
        toast(t('bad_image'), { kind: 'warn' });
      }
    }
    paintPhotos();
  });
  ctx.listen(root, 'submit', async (e) => {
    const f = e.target.closest('[data-rv-form]');
    if (!f) return;
    e.preventDefault();
    const err = $('[data-rv-err]', f);
    const name = f.name.value.trim();
    const text = f.text.value.trim();
    const fail = (msg) => {
      err.textContent = msg;
      err.hidden = false;
    };
    err.hidden = true;
    if (!formState.rating) return fail(t('rating_required'));
    if (name.length < 2) return fail(t('name_required'));
    if (text.length < 3) return fail(t('review_required'));
    const btn = f.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const r = await api(`/products/${p.id}/reviews`, { method: 'POST', body: { name, text, rating: formState.rating, phone: f.phone.value.trim(), photos: formState.photos, hp: f.hp.value } });
      formHost.innerHTML = h`<div class="rv-thanks">${icon('check')}<b>${r.status === 'approved' ? t('review_published') : t('review_pending')}</b></div>`.s;
      formState = null;
      if (r.status === 'approved' && r.review) {
        list.insertAdjacentHTML('afterbegin', reviewHtml(r.review).s);
        rvTotal++;
      }
    } catch (e2) {
      btn.disabled = false;
      fail(e2.message);
    }
  });

  // recently viewed (without the current product)
  const rec = await recentSection(p.id, t('recently_viewed'));
  if (ctx.alive() && rec && rec.s) {
    const host = $('[data-recent]', root);
    if (host) host.innerHTML = rec.s.replace('class="sec wrap"', 'class="pdp-sec"');
  }
}

