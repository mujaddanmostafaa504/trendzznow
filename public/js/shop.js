// Product listing: shop, search results and category pages with filters, plus the categories index.
import { h, raw } from './h.js';
import { t } from './i18n.js';
import { S, CATS, api, qs, money, num, catName, track, debounce, $, $$ } from './core.js';
import { icon, stars, cardsHtml, skeletonCards, emptyState, lockScroll, unlockScroll } from './ui.js';
import { replaceQuery, query } from './router.js';

const SORT_KEYS = ['new', 'popular', 'price_asc', 'price_desc', 'discount', 'rating'];
const PAGE_SIZE = 24;

const niceRound = (n) => {
  const step = n < 500 ? 50 : n < 2000 ? 100 : n < 10000 ? 500 : 1000;
  return Math.max(step, Math.round(n / step) * step);
};

function pricePresets(f) {
  if (!f || f.priceMax <= f.priceMin || f.priceMax - f.priceMin < 100) return [];
  const span = f.priceMax - f.priceMin;
  const edges = [...new Set([0.25, 0.5, 0.75].map((x) => niceRound(f.priceMin + span * x)))].filter((e) => e > f.priceMin && e < f.priceMax).sort((a, b) => a - b);
  if (!edges.length) return [];
  const out = [{ min: '', max: edges[0], label: t('price_under', { n: money(edges[0]) }) }];
  for (let i = 0; i < edges.length - 1; i++) out.push({ min: edges[i], max: edges[i + 1], label: `${money(edges[i])} - ${money(edges[i + 1])}` });
  out.push({ min: edges[edges.length - 1], max: '', label: t('price_over', { n: money(edges[edges.length - 1]) }) });
  return out;
}

function sortOptions(hasQuery, cur) {
  const keys = hasQuery ? ['relevance', ...SORT_KEYS.filter((k) => k !== 'new'), 'new'] : SORT_KEYS;
  return keys.map((k) => h`<option value="${k}" ${k === cur ? raw('selected') : ''}>${t('sort_' + k)}</option>`);
}

function filtersHtml(f, st) {
  const brands = f && f.brands ? f.brands : [];
  const presets = pricePresets(f);
  const brandSel = new Set(String(st.brand || '').split(',').filter(Boolean));
  const ratingOpts = [['', t('any')], ['4', '4+'], ['3', '3+']];
  const discOpts = [['', t('any')], ['10', '10%+'], ['20', '20%+'], ['30', '30%+'], ['50', '50%+']];
  return h`<div class="f-head"><h2>${t('filters')}</h2><button type="button" class="ib f-x" data-sh="fclose" aria-label="${t('close')}">${icon('x')}</button></div>
<div class="f-body">
<fieldset class="f-grp"><legend>${t('price')}</legend>
<div class="f-price"><label><span>${t('min')}</span><input type="number" inputmode="numeric" min="0" data-f="min" value="${st.min || ''}" placeholder="${f ? f.priceMin : 0}"></label><i>-</i><label><span>${t('max')}</span><input type="number" inputmode="numeric" min="0" data-f="max" value="${st.max || ''}" placeholder="${f ? f.priceMax : ''}"></label></div>
${presets.length ? h`<div class="f-presets">${presets.map((p) => h`<button type="button" class="pill" data-sh="preset" data-min="${p.min}" data-max="${p.max}">${p.label}</button>`)}</div>` : ''}
</fieldset>
<fieldset class="f-grp"><legend>${t('rating')}</legend>
<div class="f-radio">${ratingOpts.map(([v, l]) => h`<label><input type="radio" name="f-rating" data-f="rating" value="${v}" ${String(st.rating || '') === v ? raw('checked') : ''}><span>${v ? h`${stars(Number(v))}<em>${l}</em>` : l}</span></label>`)}</div>
</fieldset>
<fieldset class="f-grp"><legend>${t('discount')}</legend>
<div class="f-radio">${discOpts.map(([v, l]) => h`<label><input type="radio" name="f-discount" data-f="discount" value="${v}" ${String(st.discount || '') === v ? raw('checked') : ''}><span>${l}</span></label>`)}</div>
</fieldset>
${brands.length ? h`<fieldset class="f-grp"><legend>${t('brand')}</legend>
<div class="f-checks">${brands.map((b, i) => h`<label class="${i >= 8 ? 'more' : ''}" ${i >= 8 ? raw('hidden') : ''}><input type="checkbox" data-f="brand" value="${b.name}" ${brandSel.has(b.name) ? raw('checked') : ''}><span>${b.name}</span><em>${num(b.count)}</em></label>`)}</div>
${brands.length > 8 ? h`<button type="button" class="btn-link" data-sh="morebrands">${t('show_more')}</button>` : ''}
</fieldset>` : ''}
<fieldset class="f-grp"><legend>${t('availability')}</legend>
<div class="f-checks"><label><input type="checkbox" data-f="inStock" ${st.inStock ? raw('checked') : ''}><span>${t('in_stock_only')}</span></label></div>
</fieldset>
</div>
<div class="f-foot"><button type="button" class="btn btn-ghost" data-sh="reset">${t('reset_filters')}</button><button type="button" class="btn btn-primary f-apply" data-sh="fclose"><span data-apply-label>${t('show_results')}</span></button></div>`;
}

export async function renderShop(ctx, opts = {}) {
  const q0 = query();
  const catSlug = opts.cat || q0.cat || '';
  const cat = catSlug ? CATS.find((c) => c.slug === catSlug) : null;
  if (catSlug && !cat) {
    ctx.setTitle(`${t('not_found')} | ${S.siteName}`);
    ctx.el.innerHTML = h`<section class="wrap sec">${emptyState(t('cat_not_found'), '', h`<a class="btn btn-primary" href="/shop">${t('all_products')}</a>`)}</section>`.s;
    return;
  }
  const st = { q: (q0.q || '').trim(), brand: q0.brand || '', min: q0.min || '', max: q0.max || '', rating: q0.rating || '', discount: q0.discount || '', inStock: q0.inStock || '', sort: q0.sort || '' };
  const title = st.q ? t('results_for', { q: st.q }) : cat ? catName(cat) : t('all_products');
  ctx.setTitle(`${title} | ${S.siteName}`);

  ctx.el.innerHTML = h`<div class="wrap shop">
<nav class="crumbs" aria-label="${t('breadcrumb')}"><a href="/">${t('nav_home')}</a>${icon('right')}${cat ? h`<a href="/shop">${t('shop')}</a>${icon('right')}<span>${catName(cat)}</span>` : h`<span>${st.q ? t('search') : t('shop')}</span>`}</nav>
<div class="shop-head"><h1>${title}</h1><p class="shop-count" data-count aria-live="polite"></p></div>
${!cat ? h`<div class="chips-row" aria-label="${t('categories')}"><a class="pill${!st.q ? ' on' : ''}" href="/shop">${t('all_products')}</a>${CATS.map((c) => h`<a class="pill" href="/c/${c.slug}">${catName(c)}</a>`)}</div>` : h`<div class="chips-row"><a class="pill" href="/shop">${t('all_products')}</a>${CATS.map((c) => h`<a class="pill${c.slug === catSlug ? ' on' : ''}" href="/c/${c.slug}">${catName(c)}</a>`)}</div>`}
<div class="shop-bar">
<button type="button" class="btn btn-ghost f-open" data-sh="fopen">${icon('filter')}<span>${t('filters')}</span><b class="fcount" data-fcount hidden></b></button>
<label class="sort"><span>${t('sort_by')}</span><select data-sort aria-label="${t('sort_by')}">${sortOptions(!!st.q, st.sort || (st.q ? 'relevance' : 'new'))}</select></label>
</div>
<div class="chips-active" data-chips></div>
<div class="shop-body">
<aside class="filters" id="filters" aria-label="${t('filters')}"></aside>
<div class="f-bg" data-sh="fclose"></div>
<div class="shop-main"><div class="grid" data-grid>${skeletonCards(8)}</div><div class="more" data-more></div></div>
</div></div>`.s;

  const el = ctx.el;
  const grid = $('[data-grid]', el);
  const more = $('[data-more]', el);
  const countEl = $('[data-count]', el);
  const aside = $('#filters', el);
  const chipsEl = $('[data-chips]', el);
  const fcount = $('[data-fcount]', el);
  let facets = null;
  let page = 1;
  let pages = 1;
  let total = 0;
  let seq = 0;
  let drawerOpen = false;

  const filterCount = () => ['min', 'max', 'rating', 'discount', 'inStock'].filter((k) => st[k]).length + String(st.brand).split(',').filter(Boolean).length;

  const params = (pg) => ({ cat: catSlug, q: st.q, brand: st.brand, min: st.min, max: st.max, rating: st.rating, discount: st.discount, inStock: st.inStock ? '1' : '', sort: st.sort, page: pg > 1 ? pg : '', limit: PAGE_SIZE });

  function syncUrl() {
    replaceQuery({ q: st.q, cat: opts.cat ? '' : catSlug, brand: st.brand, min: st.min, max: st.max, rating: st.rating, discount: st.discount, inStock: st.inStock ? '1' : '', sort: st.sort });
  }

  function paintChips() {
    const chips = [];
    if (st.min || st.max) chips.push({ k: 'price', label: `${t('price')}: ${st.min ? money(st.min) : '0'} - ${st.max ? money(st.max) : '∞'}` });
    if (st.rating) chips.push({ k: 'rating', label: `${t('rating')}: ${st.rating}+` });
    if (st.discount) chips.push({ k: 'discount', label: `${t('discount')}: ${st.discount}%+` });
    String(st.brand).split(',').filter(Boolean).forEach((b) => chips.push({ k: 'brand', v: b, label: b }));
    if (st.inStock) chips.push({ k: 'inStock', label: t('in_stock_only') });
    chipsEl.innerHTML = chips.length ? h`${chips.map((c) => h`<button type="button" class="chip-x" data-sh="chip" data-k="${c.k}" data-v="${c.v || ''}">${c.label}${icon('x')}</button>`)}<button type="button" class="btn-link" data-sh="reset">${t('clear_all')}</button>`.s : '';
    const n = filterCount();
    fcount.hidden = !n;
    fcount.textContent = n;
  }

  function paintAside() {
    aside.innerHTML = filtersHtml(facets, st).s;
  }

  function paintCount() {
    countEl.textContent = total ? t('n_products', { n: num(total) }) : '';
    const lab = $('[data-apply-label]', el);
    if (lab) lab.textContent = total ? t('show_n', { n: num(total) }) : t('show_results');
  }

  function emptyHtml() {
    const hasF = filterCount() > 0;
    return h`${emptyState(st.q ? t('no_match', { q: st.q }) : t('no_products_here'), hasF ? t('try_fewer_filters') : t('try_other_words'), hasF ? h`<button type="button" class="btn btn-primary" data-sh="reset">${t('reset_filters')}</button>` : h`<a class="btn btn-primary" href="/shop">${t('all_products')}</a>`)}`;
  }

  async function load(reset) {
    const my = ++seq;
    if (reset) {
      page = 1;
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = skeletonCards(8).s;
      more.innerHTML = '';
    }
    let d;
    try {
      d = await api('/products?' + qs(params(page)));
    } catch (e) {
      if (my !== seq || !ctx.alive()) return;
      grid.innerHTML = '';
      more.innerHTML = h`${emptyState(t('err_load'), e.message, h`<button type="button" class="btn btn-primary" data-sh="retry">${t('retry')}</button>`)}`.s;
      return;
    }
    if (my !== seq || !ctx.alive()) return;
    grid.removeAttribute('aria-busy');
    total = d.total;
    pages = d.pages;
    if (!facets) {
      facets = d.facets;
      paintAside();
    }
    paintChips();
    paintCount();
    if (reset) {
      grid.innerHTML = d.items.length ? cardsHtml(d.items).s : '';
      if (st.q && page === 1) track('Search', { query: st.q });
    } else {
      grid.insertAdjacentHTML('beforeend', cardsHtml(d.items).s);
    }
    if (!d.items.length && reset) more.innerHTML = emptyHtml().s;
    else if (page < pages) more.innerHTML = h`<p class="more-note">${t('showing_n_of', { n: num($$('.pc', grid).length), total: num(total) })}</p><button type="button" class="btn btn-ghost btn-lg" data-sh="more">${t('load_more')}</button>`.s;
    else more.innerHTML = total > PAGE_SIZE ? h`<p class="more-note">${t('all_shown')}</p>`.s : '';
  }

  // read the sidebar controls back into the state
  function readControls() {
    st.min = ($('[data-f="min"]', aside).value || '').trim();
    st.max = ($('[data-f="max"]', aside).value || '').trim();
    const r = $('[data-f="rating"]:checked', aside);
    st.rating = r ? r.value : '';
    const dsc = $('[data-f="discount"]:checked', aside);
    st.discount = dsc ? dsc.value : '';
    st.brand = $$('[data-f="brand"]:checked', aside).map((x) => x.value).join(',');
    const s = $('[data-f="inStock"]', aside);
    st.inStock = s && s.checked ? '1' : '';
  }

  const apply = debounce(() => {
    syncUrl();
    load(true);
  }, 260);

  function setDrawer(open) {
    if (open === drawerOpen) return;
    drawerOpen = open;
    el.querySelector('.shop').classList.toggle('f-open-on', open);
    if (open) lockScroll();
    else unlockScroll();
  }
  ctx.cleanup(() => {
    if (drawerOpen) unlockScroll();
    drawerOpen = false;
  });

  ctx.listen(el, 'change', (e) => {
    if (e.target.matches('[data-sort]')) {
      st.sort = e.target.value === (st.q ? 'relevance' : 'new') ? '' : e.target.value;
      apply();
    } else if (e.target.closest('#filters') && e.target.matches('[data-f]')) {
      readControls();
      apply();
    }
  });
  ctx.listen(el, 'input', (e) => {
    if (e.target.matches('[data-f="min"],[data-f="max"]')) {
      readControls();
      apply();
    }
  });
  ctx.listen(el, 'click', (e) => {
    const b = e.target.closest('[data-sh]');
    if (!b) return;
    const a = b.dataset.sh;
    if (a === 'fopen') setDrawer(true);
    else if (a === 'fclose') setDrawer(false);
    else if (a === 'more') {
      page++;
      b.disabled = true;
      load(false);
    } else if (a === 'retry') load(true);
    else if (a === 'morebrands') {
      $$('.f-checks .more', aside).forEach((x) => (x.hidden = false));
      b.remove();
    } else if (a === 'preset') {
      $('[data-f="min"]', aside).value = b.dataset.min;
      $('[data-f="max"]', aside).value = b.dataset.max;
      readControls();
      apply();
    } else if (a === 'reset') {
      Object.assign(st, { brand: '', min: '', max: '', rating: '', discount: '', inStock: '' });
      paintAside();
      syncUrl();
      load(true);
    } else if (a === 'chip') {
      const k = b.dataset.k;
      if (k === 'price') Object.assign(st, { min: '', max: '' });
      else if (k === 'brand') st.brand = String(st.brand).split(',').filter((x) => x && x !== b.dataset.v).join(',');
      else st[k] = '';
      paintAside();
      syncUrl();
      load(true);
    }
  });
  ctx.listen(document, 'keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) setDrawer(false);
  });

  paintChips();
  await load(true);
}

export function renderCategories(ctx) {
  ctx.setTitle(`${t('categories')} | ${S.siteName}`);
  ctx.el.innerHTML = h`<section class="wrap sec"><div class="sec-head"><h1>${t('categories')}</h1></div>
${CATS.length ? h`<div class="cat-grid">${CATS.map((c) => h`<a class="cat-tile" href="/c/${c.slug}"><span class="cat-tile-pic">${c.image ? h`<img src="${c.image}" alt="" loading="lazy">` : h`<b>${catName(c).slice(0, 1)}</b>`}</span><span class="cat-tile-name">${catName(c)}</span><em>${t('n_products', { n: num(c.count || 0) })}</em></a>`)}</div>` : emptyState(t('no_categories'), '')}
<p class="cat-all"><a class="btn btn-ghost" href="/shop">${t('all_products')}</a></p></section>`.s;
}

