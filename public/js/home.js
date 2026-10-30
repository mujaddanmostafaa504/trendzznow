import { h, raw, safeUrl } from './h.js';
import { t } from './i18n.js';
import { S, CATS, BANNERS, api, recent, qs, tr, catName } from './core.js';
import { icon, card, cardsHtml, skeletonCards, initSlider, emptyState } from './ui.js';

function heroHtml() {
  if (!BANNERS.length) {
    return h`<section class="hero-plain wrap"><div><h1>${tr(S.tagline)}</h1><p>${t('hero_plain_sub')}</p><div class="hero-cta"><a class="btn btn-primary btn-lg" href="/shop">${t('shop_now')}</a>${CATS.slice(0, 3).map((c) => h`<a class="btn btn-ghost btn-lg" href="/c/${c.slug}">${catName(c)}</a>`)}</div></div></section>`;
  }
  const n = BANNERS.length;
  const slides = BANNERS.map((b, i) => {
    const hasText = b.showText && (b.title || b.subtitle || b.buttonText);
    const inner = h`<picture><source media="(max-width: 699px)" srcset="${b.mobileImage || b.image}"><img src="${b.image}" alt="${b.title || ''}" ${raw(i === 0 ? 'fetchpriority="high"' : 'loading="lazy"')} decoding="async"></picture>${hasText ? h`<div class="slide-text">${b.title ? h`<h2>${b.title}</h2>` : ''}${b.subtitle ? h`<p>${b.subtitle}</p>` : ''}${b.buttonText ? h`<span class="btn btn-accent">${b.buttonText}</span>` : ''}</div>` : ''}`;
    const cls = `slide ${b.align || 'left'} ${b.textTheme || 'light'}`;
    return b.link ? h`<a class="${cls}" href="${safeUrl(b.link)}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}">${inner}</a>` : h`<div class="${cls}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}">${inner}</div>`;
  });
  return h`<section class="hero wrap" aria-roledescription="carousel" aria-label="${t('offers')}"><div class="sl">
<div class="sl-track">${slides}</div>
${n > 1 ? h`<button type="button" class="sl-arrow prev ib" data-sl="prev" aria-label="${t('prev')}">${icon('left')}</button><button type="button" class="sl-arrow next ib" data-sl="next" aria-label="${t('next')}">${icon('right')}</button>
<div class="sl-dots">${BANNERS.map((b, i) => h`<button type="button" class="sl-dot" data-sl="${i}" aria-label="${t('slide_n', { n: i + 1 })}"></button>`)}</div>` : ''}
</div></section>`;
}

const trustHtml = () => h`<section class="trust wrap" aria-label="${t('why_us')}">
<div>${icon('truck')}<span><b>${t('trust_cod')}</b><em>${t('trust_cod_sub')}</em></span></div>
<div>${icon('refresh')}<span><b>${t('trust_return')}</b><em><a href="/page/return-policy">${t('trust_return_sub')}</a></em></span></div>
<div>${icon('shield')}<span><b>${t('trust_pay')}</b><em>${t('trust_pay_sub')}</em></span></div>
<div>${icon('chat')}<span><b>${t('trust_help')}</b><em>${t('trust_help_sub')}</em></span></div>
</section>`;

function catRail() {
  if (!CATS.length) return '';
  return h`<section class="cat-rail wrap" aria-label="${t('categories')}"><div class="cat-track">${CATS.map((c) => h`<a class="cat-it" href="/c/${c.slug}"><span class="cat-pic">${c.image ? h`<img src="${c.image}" alt="" loading="lazy" width="120" height="120">` : h`<b>${catName(c).slice(0, 1)}</b>`}</span><span class="cat-nm">${catName(c)}</span></a>`)}</div></section>`;
}

export const sectionHead = (title, link) => h`<div class="sec-head"><h2>${title}</h2>${link ? h`<a class="sec-more" href="${link}">${t('see_all')}</a>` : ''}</div>`;

export const railHtml = (list) => h`<div class="rail"><div class="rail-track">${list.map(card)}</div><button type="button" class="rail-btn prev ib" data-rail="-1" aria-label="${t('prev')}">${icon('left')}</button><button type="button" class="rail-btn next ib" data-rail="1" aria-label="${t('next')}">${icon('right')}</button></div>`;

export function bindRails(ctx) {
  ctx.listen(ctx.el, 'click', (e) => {
    const b = e.target.closest('[data-rail]');
    if (!b) return;
    const tr_ = b.parentElement.querySelector('.rail-track');
    tr_.scrollBy({ left: Number(b.dataset.rail) * tr_.clientWidth * 0.85, behavior: 'smooth' });
  });
}

export async function recentSection(excludeId, title) {
  const ids = recent.list.filter((x) => x !== excludeId).slice(0, 10);
  if (!ids.length) return '';
  try {
    const d = await api('/products?' + qs({ ids: ids.join(',') }));
    if (!d.items.length) return '';
    return h`<section class="sec wrap">${sectionHead(title || t('recently_viewed'))}${railHtml(d.items)}</section>`;
  } catch (e) {
    return '';
  }
}

export async function renderHome(ctx) {
  ctx.setTitle(`${S.siteName} | ${tr(S.tagline)}`);
  ctx.el.innerHTML = h`${heroHtml()}${trustHtml()}${catRail()}<section class="sec wrap"><div class="grid">${skeletonCards(8)}</div></section>`.s;
  const stop = initSlider(ctx.el.querySelector('.hero') || document.createElement('div'));
  ctx.cleanup(stop);
  bindRails(ctx);
  let d;
  try {
    d = await api('/home');
  } catch (e) {
    if (!ctx.alive()) return;
    ctx.el.querySelector('.sec').outerHTML = h`<section class="sec wrap">${emptyState(t('err_load'), e.message, h`<button class="btn btn-primary" onclick="location.reload()">${t('retry')}</button>`)}</section>`.s;
    return;
  }
  if (!ctx.alive()) return;
  const rec = await recentSection('', t('recently_viewed'));
  if (!ctx.alive()) return;
  const sec = ctx.el.querySelector('.sec');
  const any = d.featured.length || d.newArrivals.length || d.bestSellers.length || d.onSale.length;
  if (!any) {
    sec.outerHTML = h`<section class="sec wrap">${emptyState(t('no_products_yet'), t('no_products_sub'))}</section>`.s;
    return;
  }
  const social = ['facebook', 'instagram', 'tiktok', 'youtube'].filter((k) => S.social && S.social[k]);
  const html = h`
${d.featured.length ? h`<section class="sec wrap">${sectionHead(t('picked_for_you'), '/shop?sort=popular')}<div class="grid">${cardsHtml(d.featured)}</div></section>` : ''}
${d.onSale.length ? h`<section class="sec sale-band"><div class="wrap">${sectionHead(t('on_sale'), '/shop?discount=10&sort=discount')}${railHtml(d.onSale)}</div></section>` : ''}
${d.newArrivals.length ? h`<section class="sec wrap">${sectionHead(t('new_arrivals'), '/shop?sort=new')}<div class="grid">${cardsHtml(d.newArrivals)}</div></section>` : ''}
${d.bestSellers.length ? h`<section class="sec wrap">${sectionHead(t('best_sellers'), '/shop?sort=popular')}${railHtml(d.bestSellers)}</section>` : ''}
${rec}
${social.length ? h`<section class="sec wrap follow"><div><h2>${t('follow_us')}</h2><p>${t('follow_sub')}</p></div><div class="follow-links">${social.map((k) => h`<a class="btn btn-ghost" href="${safeUrl(S.social[k])}" target="_blank" rel="noopener noreferrer">${{ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }[k]}</a>`)}</div></section>` : ''}`;
  const holder = document.createElement('div');
  holder.innerHTML = html.s;
  sec.replaceWith(...holder.childNodes);
}
