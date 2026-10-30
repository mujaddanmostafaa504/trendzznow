// Tiny safe-HTML helpers shared by the shop and the admin panel.
// h`...` escapes every interpolated value unless it is itself h`...` output,
// so product names, reviews, addresses etc. can never inject markup.

export class Safe {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export const raw = (s) => new Safe(String(s == null ? '' : s));

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => MAP[c]);

function val(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(val).join('');
  return esc(v);
}

export function h(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += val(vals[i]) + strings[i + 1];
  return new Safe(out);
}

export function setHtml(el, content) {
  el.innerHTML = content instanceof Safe ? content.s : esc(content);
}

export function safeUrl(u) {
  const s = String(u || '').trim();
  return /^(https?:\/\/|\/(?!\/)|tel:|mailto:|#)/i.test(s) ? s : '#';
}

// very small markdown: ## headings, - lists, **bold**, [text](url), paragraphs
export function md(src) {
  const inline = (t) =>
    esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => `<a href="${esc(safeUrl(u.replace(/&amp;/g, '&')))}">${a}</a>`);
  const out = [];
  let para = [];
  let list = [];
  const flushP = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushL = () => {
    if (list.length) out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of String(src || '').replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    let m;
    if (!t) {
      flushP();
      flushL();
    } else if ((m = /^(#{2,3})\s+(.*)$/.exec(t))) {
      flushP();
      flushL();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = /^[-•]\s+(.*)$/.exec(t))) {
      flushP();
      list.push(m[1]);
    } else {
      flushL();
      para.push(t);
    }
  }
  flushP();
  flushL();
  return new Safe(out.join(''));
}
