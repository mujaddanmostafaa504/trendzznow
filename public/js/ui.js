// Reusable UI pieces: icons, toast, modal, photo viewer, product card, gallery, slider.
import { h, raw, esc, Safe } from './h.js';
import { t } from './i18n.js';
import { wish, compare, money, clamp, $, $$ } from './core.js';

/* ---------------- icons ---------------- */
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.4-9.8C1.4 7.4 3.6 4.2 7 4.2c2 0 3.5 1 5 2.9 1.5-1.9 3-2.9 5-2.9 3.4 0 5.6 3.2 4.4 6.5-1.9 5.2-9.4 9.8-9.4 9.8z"/>',
  bag: '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
  home: '<path d="M3.5 11 12 3.8l8.5 7.2"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  down: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  up: '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  compare: '<path d="M8 4v16M4.5 7.5 8 4l3.5 3.5M16 20V4M12.5 16.5 16 20l3.5-3.5"/>',
  filter: '<path d="M4 6h16M7 12h10M10.5 18h3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5.5h16v11H9.5L4 20.5z"/>',
  truck: '<path d="M2.5 6.5h11v9.5h-11zM13.5 9.5h4l3 3V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.1 8 7.5 9.5 4.4-1.5 7.500-4.800 7.500-9.500V6z"/><path d="m9 12 2.200 2.200L15.500 10"/>',
  refresh: '<path d="M3.5 12a8.500 8.500 0 0 1 14.500-6L20.500 8M20.500 3.500V8H16M20.500 12a8.500 8.500 0 0 1-14.500 6L3.500 16M3.500 20.500V16H8"/>',
  bell: '<path d="M6 17v-6a6 6 0 1 1 12 0v6l1.500 1.500h-15zM10 21h4"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  camera: '<path d="M4 8h3l1.800-2.500h6.400L17 8h3v11H4z"/><circle cx="12" cy="13.500" r="3.500"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.500 8.500V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.500a2 2 0 0 0 2 2h2.500"/>',
  star: '<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.800-5.200-2.800-5.200 2.800 1-5.800-4.300-4.100 5.900-.8z" fill="currentColor"/>',
  pin: '<path d="M12 21s6.500-5.800 6.500-11a6.500 6.500 0 0 0-13 0c0 5.200 6.500 11 6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
  lock: '<rect x="5" y="10.500" width="14" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  info: '<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5M12 8v.1"/>',
  zoomin: '<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.500-4.500M11 8.500v5M8.500 11h5"/>',
  zoomout: '<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.500-4.500M8.500 11h5"/>',
  mail: '<rect x="3.500" y="5.500" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  box: '<path d="m3.500 7.500 8.500-4 8.500 4v9l-8.500 4-8.500-4z"/><path d="m3.500 7.500 8.500 4 8.500-4M12 11.500v9"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  tag: '<path d="M3.500 12.500 12 4h7.500v7.500L11 20z"/><circle cx="15.500" cy="8.500" r="1.200"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bolt: '<path d="m13 3-8 11h6l-1 7 8-11h-6z"/>',
};
export const icon = (name, cls = '') =>
  raw(`<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

export const stars = (r) => raw(`<span class="stars" style="--p:${clamp(((Number(r) || 0) / 5) * 100, 0, 100).toFixed(0)}%" role="img" aria-label="${esc(Number(r) || 0)} / 5"></span>`);

/* ---------------- scroll lock (nested overlays) ---------------- */
let locks = 0;
export function lockScroll() {
  if (locks++ === 0) document.documentElement.classList.add('noscroll');
}
export function unlockScroll() {
  if (--locks <= 0) {
    locks = 0;
    document.documentElement.classList.remove('noscroll');
  }
}

/* ---------------- toast ---------------- */
export function toast(msg, { action, ms = 3400, kind = '' } = {}) {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);
  if (action) {
    const a = document.createElement(action.href ? 'a' : 'button');
    a.className = 'toast-act';
    a.textContent = action.label;
    if (action.href) a.href = action.href;
    else a.type = 'button';
    a.addEventListener('click', () => {
      if (action.fn) action.fn();
      el.remove();
    });
    el.appendChild(a);
  }
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

/* ---------------- modal / bottom sheet ---------------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function openModal(content, { cls = '', label = '', onClose } = {}) {
  const prevFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal ' + cls;
  el.innerHTML = `<div class="modal-bg" data-close></div><div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><button class="modal-x ib" type="button" data-close aria-label="${esc(t('close'))}">${icon('x').s}</button><div class="modal-body"></div></div>`;
  const body = el.querySelector('.modal-body');
  if (content instanceof Safe) body.innerHTML = content.s;
  else if (content instanceof Node) body.appendChild(content);
  document.body.appendChild(el);
  lockScroll();
  requestAnimationFrame(() => el.classList.add('open'));
  const card = el.querySelector('.modal-card');
  card.focus({ preventScroll: true });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', key, true);
    el.classList.remove('open');
    setTimeout(() => el.remove(), 200);
    unlockScroll();
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    if (onClose) onClose();
  };
  const key = (e) => {
    if (!el.isConnected) return;
    // only the top-most modal reacts
    const all = $$('.modal');
    if (all[all.length - 1] !== el) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const f = $$(FOCUSABLE, card).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', key, true);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  return { el, body, close };
}

/* ---------------- photo viewer with zoom, pinch and swipe ---------------- */
export function openLightbox(images, start = 0) {
  if (!images || !images.length) return;
  const prevFocus = document.activeElement;
  let i = clamp(start, 0, images.length - 1);
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const el = document.createElement('div');
  el.className = 'lb';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('photo_viewer'));
  el.innerHTML = `<div class="lb-top"><span class="lb-count"></span><div class="lb-tools">
<button type="button" data-lb="out" class="ib" aria-label="${esc(t('zoom_out'))}">${icon('zoomout').s}</button>
<button type="button" data-lb="in" class="ib" aria-label="${esc(t('zoom_in'))}">${icon('zoomin').s}</button>
<button type="button" data-lb="close" class="ib" aria-label="${esc(t('close'))}">${icon('x').s}</button></div></div>
<div class="lb-stage"><img alt="" draggable="false"></div>
${images.length > 1 ? `<button type="button" data-lb="prev" class="lb-nav prev ib" aria-label="${esc(t('prev'))}">${icon('left').s}</button><button type="button" data-lb="next" class="lb-nav next ib" aria-label="${esc(t('next'))}">${icon('right').s}</button>` : ''}
${images.length > 1 ? `<div class="lb-thumbs">${images.map((u, k) => `<button type="button" data-lb-thumb="${k}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`;
  document.body.appendChild(el);
  lockScroll();
  const stage = el.querySelector('.lb-stage');
  const img = stage.querySelector('img');
  const count = el.querySelector('.lb-count');

  const apply = (anim) => {
    img.style.transition = anim ? 'transform .22s ease' : 'none';
    img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  };
  const bounds = () => ({ x: Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2), y: Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2) });
  const fit = () => {
    const b = bounds();
    tx = clamp(tx, -b.x, b.x);
    ty = clamp(ty, -b.y, b.y);
  };
  const zoomAt = (cx, cy, ns, anim = true) => {
    ns = clamp(ns, 1, 5);
    const r = stage.getBoundingClientRect();
    const px = cx - (r.left + r.width / 2);
    const py = cy - (r.top + r.height / 2);
    tx = px - (px - tx) * (ns / scale);
    ty = py - (py - ty) * (ns / scale);
    scale = ns;
    if (scale <= 1.001) {
      scale = 1;
      tx = 0;
      ty = 0;
    }
    fit();
    apply(anim);
  };
  const show = () => {
    scale = 1;
    tx = 0;
    ty = 0;
    img.style.opacity = '0.4';
    img.onload = () => (img.style.opacity = '1');
    img.src = images[i];
    apply(false);
    count.textContent = images.length > 1 ? `${i + 1} / ${images.length}` : '';
    el.querySelectorAll('[data-lb-thumb]').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const go = (d) => {
    i = (i + d + images.length) % images.length;
    show();
  };
  const closeIt = () => {
    document.removeEventListener('keydown', key, true);
    el.remove();
    unlockScroll();
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeIt();
    } else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === '+' || e.key === '=') zoomAt(stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top, scale * 1.4);
    else if (e.key === '-') zoomAt(stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top, scale / 1.4);
  };
  document.addEventListener('keydown', key, true);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb]');
    const th = e.target.closest('[data-lb-thumb]');
    if (th) {
      i = Number(th.dataset.lbThumb);
      show();
      return;
    }
    if (!b) return;
    const act = b.dataset.lb;
    const r = stage.getBoundingClientRect();
    if (act === 'close') closeIt();
    else if (act === 'next') go(1);
    else if (act === 'prev') go(-1);
    else if (act === 'in') zoomAt(r.left + r.width / 2, r.top + r.height / 2, scale * 1.5);
    else if (act === 'out') zoomAt(r.left + r.width / 2, r.top + r.height / 2, scale / 1.5);
  });

  // gestures: one finger pans (zoomed) or swipes (not zoomed), two fingers pinch, double tap zooms
  const ptrs = new Map();
  let st = null;
  let pinch = null;
  let moved = false;
  let lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: scale };
      st = null;
    } else if (ptrs.size === 1) {
      st = { x: e.clientX, y: e.clientY, tx, ty };
      moved = false;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      moved = true;
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d, false);
    } else if (st) {
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (scale > 1) {
        tx = st.tx + dx;
        ty = st.ty + dy;
        fit();
        apply(false);
      } else if (moved) {
        img.style.transition = 'none';
        img.style.transform = `translate(${dx}px,0)`;
      }
    }
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const wasTwo = ptrs.size === 2;
    ptrs.delete(e.pointerId);
    if (wasTwo) {
      pinch = null;
      st = null;
      return;
    }
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (scale === 1 && moved) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && images.length > 1) go(dx < 0 ? 1 : -1);
      else apply(true);
    } else if (!moved) {
      const now = Date.now();
      if (now - lastTap < 320) {
        zoomAt(e.clientX, e.clientY, scale > 1 ? 1 : 2.6);
        lastTap = 0;
      } else lastTap = now;
    }
    st = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, scale * Math.exp(-e.deltaY * 0.0018));
  }, { passive: false });
  window.addEventListener('resize', () => {
    fit();
    apply(false);
  }, { passive: true });

  show();
  el.querySelector('[data-lb="close"]').focus({ preventScroll: true });
  return { close: closeIt };
}

/* ---------------- product card ---------------- */
export function card(p) {
  const wished = wish.has(p.id);
  const cmp = compare.has(p.id);
  const out = !p.inStock;
  const nm = p.name;
  return h`<article class="pc${out ? ' is-out' : ''}" data-id="${p.id}">
<div class="pc-media">
<a href="/p/${p.slug}" class="pc-img" tabindex="-1" aria-hidden="true"><img src="${p.image || '/img/placeholder.svg'}" alt="" loading="lazy" decoding="async" width="600" height="600">${p.image2 ? h`<img class="alt" src="${p.image2}" alt="" loading="lazy" decoding="async">` : ''}</a>
${p.discount ? h`<span class="sticker">-${p.discount}%</span>` : ''}
${out ? h`<span class="tag tag-out">${t('sold_out')}</span>` : p.isNew ? h`<span class="tag tag-new">${t('new_tag')}</span>` : ''}
<div class="pc-tools">
<button type="button" class="ib${wished ? ' on' : ''}" data-act="wish" data-id="${p.id}" aria-pressed="${wished ? 'true' : 'false'}" aria-label="${t('wishlist')}">${icon('heart')}</button>
<button type="button" class="ib${cmp ? ' on' : ''}" data-act="compare" data-id="${p.id}" aria-pressed="${cmp ? 'true' : 'false'}" aria-label="${t('compare')}">${icon('compare')}</button>
<button type="button" class="ib pc-qv" data-act="quick" data-slug="${p.slug}" aria-label="${t('quick_view')}">${icon('eye')}</button>
</div>
</div>
<div class="pc-body">
${p.brand ? h`<div class="pc-brand">${p.brand}</div>` : ''}
<h3 class="pc-title"><a href="/p/${p.slug}">${nm}</a></h3>
<div class="pc-meta">${p.ratingCount ? h`${stars(p.rating)}<span class="pc-rc">${p.rating} (${p.ratingCount})</span>` : ''}${p.lowStock ? h`<span class="pc-low">${t('only_left', { n: p.lowStock })}</span>` : ''}</div>
<div class="pc-foot">
<div class="price"><b>${money(p.price)}</b>${p.comparePrice ? h`<s>${money(p.comparePrice)}</s>` : ''}</div>
<button type="button" class="pc-add" data-act="${p.hasVariants ? 'quick' : 'addcard'}" data-id="${p.id}" data-slug="${p.slug}" data-name="${nm}" data-price="${p.price}" data-image="${p.image}" ${out ? 'disabled' : ''} aria-label="${out ? t('sold_out') : p.hasVariants ? t('choose_options') : t('add_to_cart')}">${icon(p.hasVariants ? 'plus' : 'bag')}</button>
</div>
</div>
</article>`;
}

export const cardsHtml = (list) => h`${list.map(card)}`;

export function skeletonCards(n = 8) {
  return h`${Array.from({ length: n }, () => h`<div class="pc sk-card" aria-hidden="true"><div class="sk sk-img"></div><div class="pc-body"><div class="sk sk-line w60"></div><div class="sk sk-line"></div><div class="sk sk-line w40"></div></div></div>`)}`;
}

/* ---------------- photo gallery (swipe, thumbs, hover zoom, full screen) ---------------- */
export function galleryHtml(images, name) {
  const imgs = images && images.length ? images : ['/img/placeholder.svg'];
  return h`<div class="gal" data-gal>
<div class="gal-main" tabindex="0" aria-label="${t('photos')}">${imgs.map((u, k) => h`<div class="gal-slide"><img src="${u}" alt="${name} ${k + 1}" data-i="${k}" ${raw(k === 0 ? 'fetchpriority="high"' : 'loading="lazy"')} decoding="async"></div>`)}</div>
<button type="button" class="gal-full ib" data-gal-full aria-label="${t('full_screen')}">${icon('zoomin')}</button>
${imgs.length > 1 ? h`<div class="gal-count" data-gal-count>1 / ${imgs.length}</div><div class="gal-dots">${imgs.map((u, k) => h`<i class="${k === 0 ? 'on' : ''}"></i>`)}</div>
<div class="gal-thumbs">${imgs.map((u, k) => h`<button type="button" data-thumb="${k}" class="${k === 0 ? 'on' : ''}" aria-label="${t('photo_n', { n: k + 1 })}"><img src="${u}" alt="" loading="lazy"></button>`)}</div>` : ''}
</div>`;
}

export function bindGallery(root, images) {
  const gal = root.querySelector('[data-gal]');
  if (!gal) return;
  const main = gal.querySelector('.gal-main');
  const imgs = images && images.length ? images : ['/img/placeholder.svg'];
  const dots = [...gal.querySelectorAll('.gal-dots i')];
  const thumbs = [...gal.querySelectorAll('[data-thumb]')];
  const countEl = gal.querySelector('[data-gal-count]');
  let idx = 0;
  let raf = 0;
  main.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const k = Math.round(main.scrollLeft / main.clientWidth);
      if (k === idx) return;
      idx = k;
      dots.forEach((d, j) => d.classList.toggle('on', j === k));
      thumbs.forEach((b, j) => b.classList.toggle('on', j === k));
      if (countEl) countEl.textContent = `${k + 1} / ${imgs.length}`;
    });
  }, { passive: true });
  gal.addEventListener('click', (e) => {
    const th = e.target.closest('[data-thumb]');
    if (th) {
      main.scrollTo({ left: Number(th.dataset.thumb) * main.clientWidth, behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-gal-full]') || e.target.closest('.gal-slide img')) openLightbox(imgs, idx);
  });
  // desktop hover zoom
  main.addEventListener('mousemove', (e) => {
    const s = e.target.closest('.gal-slide');
    if (!s || e.pointerType === 'touch') return;
    const r = s.getBoundingClientRect();
    s.style.setProperty('--ox', `${((e.clientX - r.left) / r.width) * 100}%`);
    s.style.setProperty('--oy', `${((e.clientY - r.top) / r.height) * 100}%`);
    s.classList.add('zoom');
  });
  main.addEventListener('mouseleave', () => $$('.gal-slide.zoom', main).forEach((s) => s.classList.remove('zoom')));
}

/* ---------------- slider (hero banners) ---------------- */
export function initSlider(root, { auto = 5600 } = {}) {
  const track = root.querySelector('.sl-track');
  if (!track) return () => {};
  const n = track.children.length;
  const dots = [...root.querySelectorAll('.sl-dot')];
  let idx = 0;
  let timer = null;
  let raf = 0;
  const go = (k, smooth = true) => {
    idx = (k + n) % n;
    track.scrollTo({ left: idx * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };
  const mark = () => {
    const k = Math.round(track.scrollLeft / track.clientWidth);
    idx = k;
    dots.forEach((d, j) => {
      if (j === k) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  };
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(mark);
  }, { passive: true });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sl]');
    if (!b) return;
    e.preventDefault();
    stop();
    if (b.dataset.sl === 'next') go(idx + 1);
    else if (b.dataset.sl === 'prev') go(idx - 1);
    else go(Number(b.dataset.sl));
  });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = () => {
    if (reduce || n < 2 || timer) return;
    timer = setInterval(() => {
      if (!document.hidden) go(idx + 1);
    }, auto);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => root.addEventListener(ev, stop, { passive: true }));
  ['pointerleave', 'focusout'].forEach((ev) => root.addEventListener(ev, start));
  mark();
  start();
  return stop;
}

export const emptyState = (title, text, actionHtml = '') => h`<div class="empty">${icon('box', 'big')}<h3>${title}</h3>${text ? h`<p>${text}</p>` : ''}${actionHtml}</div>`;
