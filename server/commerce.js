// Commerce extras: coupons, blocked phone numbers, customer risk, product duplicate / bulk actions / CSV export, top sellers.
module.exports = function registerCommerce(app, ctx) {
  const { supabase, getSettings, sanitizeStr, rateLimited, requireAdmin, csrfProtect, appendAuditLog, universalInsert } = ctx;
  const ADMIN = '/secret-admin-panel-2026';
  const back = (res, msg) => res.redirect(ADMIN + '/dashboard?msg=' + encodeURIComponent(msg));
  const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);
  const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  // ---------------- Coupons ----------------
  const calcDiscount = (c, subtotal) => {
    const raw = c.type === 'percent' ? Math.round((subtotal * Number(c.value || 0)) / 100) : Number(c.value || 0);
    return Math.min(Math.max(0, raw), subtotal);
  };

  // Finds a coupon by code. The coupons table first, then the single legacy promo code stored in settings.
  async function resolveCoupon(code, subtotal) {
    const clean = String(code || '').trim().toUpperCase().slice(0, 40);
    if (!clean) return { ok: false, message: 'Please enter a coupon code.' };
    const { data, error } = await supabase.from('coupons').select('*').eq('code', clean).limit(1);
    const row = !error && data && data[0];
    if (row) {
      if (row.active === false) return { ok: false, message: 'This coupon is not active.' };
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { ok: false, message: 'This coupon has expired.' };
      if (row.max_uses && Number(row.used_count || 0) >= Number(row.max_uses)) return { ok: false, message: 'This coupon has been fully used.' };
      if (Number(row.min_order || 0) > subtotal) return { ok: false, message: `This coupon needs an order of ৳${row.min_order} or more.` };
      const discount = calcDiscount(row, subtotal);
      return { ok: true, coupon: row, discount, desc: { type: row.type, value: Number(row.value), min_order: Number(row.min_order || 0) } };
    }
    const s = await getSettings();
    const legacy = String(s.promo_code || '').trim().toUpperCase();
    if (legacy && clean === legacy) {
      const value = Math.max(0, parseFloat(s.promo_discount) || 0);
      return { ok: true, coupon: null, discount: Math.min(value, subtotal), desc: { type: 'fixed', value, min_order: 0 } };
    }
    return { ok: false, message: 'Invalid coupon code.' };
  }

  // Counts a use before the order is saved, so a coupon with a use limit cannot be over-used by parallel orders.
  async function claimCoupon(coupon) {
    if (!coupon) return true;
    for (let i = 0; i < 4; i++) {
      const { data: cur } = await supabase.from('coupons').select('used_count, max_uses').eq('id', coupon.id).single();
      if (!cur) return false;
      const used = Number(cur.used_count || 0);
      if (cur.max_uses && used >= Number(cur.max_uses)) return false;
      const { data: upd, error } = await supabase.from('coupons').update({ used_count: used + 1 }).eq('id', coupon.id).eq('used_count', used).select('id');
      if (!error && upd && upd.length) return true;
    }
    return false;
  }
  async function releaseCoupon(coupon) {
    if (!coupon) return;
    const { data: cur } = await supabase.from('coupons').select('used_count').eq('id', coupon.id).single();
    if (cur && Number(cur.used_count) > 0) await supabase.from('coupons').update({ used_count: Number(cur.used_count) - 1 }).eq('id', coupon.id);
  }

  app.post('/api/coupon/validate', async (req, res) => {
    if (rateLimited('coupon:' + req.ip, 30, 10 * 60 * 1000)) return res.status(429).json({ valid: false, message: 'Too many tries. Please wait a few minutes.' });
    const subtotal = Math.max(0, parseFloat(req.body.subtotal) || 0);
    const r = await resolveCoupon(req.body.code, subtotal);
    if (!r.ok) return res.json({ valid: false, message: r.message });
    res.json({ valid: true, discount: r.discount, type: r.desc.type, value: r.desc.value, min_order: r.desc.min_order, code: String(req.body.code).trim().toUpperCase() });
  });

  app.post(ADMIN + '/coupons/create', requireAdmin, csrfProtect, async (req, res) => {
    const code = sanitizeStr(String(req.body.code || '')).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const type = req.body.type === 'percent' ? 'percent' : 'fixed';
    const value = Math.max(0, parseFloat(req.body.value) || 0);
    if (code.length < 3) return back(res, 'Coupon code needs at least 3 letters or numbers.');
    if (!value || (type === 'percent' && value > 100)) return back(res, 'Enter a valid discount value.');
    const payload = {
      code, type, value,
      min_order: Math.max(0, parseFloat(req.body.min_order) || 0),
      max_uses: parseInt(req.body.max_uses, 10) > 0 ? parseInt(req.body.max_uses, 10) : null,
      expires_at: req.body.expires_at ? new Date(req.body.expires_at + 'T23:59:59+06:00').toISOString() : null,
      active: true, used_count: 0
    };
    const { error } = await supabase.from('coupons').insert(payload);
    if (error) return back(res, /duplicate|unique/i.test(error.message) ? 'That coupon code already exists.' : 'Coupon could not be saved: ' + error.message);
    await appendAuditLog(req.session.adminName, 'Coupon Created', code);
    back(res, `Coupon ${code} created.`);
  });
  app.post(ADMIN + '/coupons/:id/toggle', requireAdmin, csrfProtect, async (req, res) => {
    const { error } = await supabase.from('coupons').update({ active: req.body.active === 'true' }).eq('id', req.params.id);
    if (error) return back(res, 'Coupon update failed: ' + error.message);
    back(res, 'Coupon updated.');
  });
  app.post(ADMIN + '/coupons/:id/delete', requireAdmin, csrfProtect, async (req, res) => {
    const { error } = await supabase.from('coupons').delete().eq('id', req.params.id);
    if (error) return back(res, 'Coupon delete failed: ' + error.message);
    await appendAuditLog(req.session.adminName, 'Coupon Deleted', `#${req.params.id}`);
    back(res, 'Coupon deleted.');
  });

  // ---------------- Blocked phone numbers ----------------
  async function isBlockedPhone(phone) {
    const key = last10(phone);
    if (key.length < 10) return false;
    const { data, error } = await supabase.from('blocked_phones').select('phone').eq('phone', key).limit(1);
    return !error && !!(data && data.length);
  }
  app.post(ADMIN + '/blocked/add', requireAdmin, csrfProtect, async (req, res) => {
    const key = last10(req.body.phone);
    if (key.length < 10) return back(res, 'Enter a valid 11 digit mobile number.');
    const { error } = await supabase.from('blocked_phones').upsert({ phone: key, reason: sanitizeStr(String(req.body.reason || '')).slice(0, 120) }, { onConflict: 'phone' });
    if (error) return back(res, 'Could not block this number: ' + error.message);
    await appendAuditLog(req.session.adminName, 'Phone Blocked', '0' + key.slice(-10));
    back(res, 'Number blocked. New orders from it will be refused.');
  });
  app.post(ADMIN + '/blocked/remove', requireAdmin, csrfProtect, async (req, res) => {
    const { error } = await supabase.from('blocked_phones').delete().eq('phone', last10(req.body.phone));
    if (error) return back(res, 'Could not unblock: ' + error.message);
    await appendAuditLog(req.session.adminName, 'Phone Unblocked', String(req.body.phone || '').slice(0, 15));
    back(res, 'Number unblocked.');
  });

  // Per phone history: how many orders ended in Cancelled or Return.
  function phoneRisk(orders) {
    const map = {};
    orders.forEach(o => {
      const k = last10(o.phone);
      if (!k) return;
      map[k] = map[k] || { total: 0, bad: 0 };
      map[k].total++;
      if (['Cancelled', 'Return', 'Returned'].includes(o.status)) map[k].bad++;
    });
    Object.values(map).forEach(m => {
      m.level = (m.bad >= 2 || (m.total >= 2 && m.bad / m.total >= 0.5)) ? 'high' : (m.bad >= 1 ? 'watch' : 'ok');
    });
    return map;
  }

  // ---------------- Top sellers ----------------
  function topSellers(products, orders) {
    const byTitle = {};
    products.forEach(p => { byTitle[String(p.title).toLowerCase()] = { id: p.id, title: p.title, units: 0, revenue: 0, price: Number(p.price) || 0 }; });
    orders.forEach(o => {
      if (['Cancelled', 'Return', 'Returned'].includes(o.status)) return;
      String(o.product_title || '').split(/\),\s*/).forEach(part => {
        const m = part.match(/^(.*?)(?:\s*\[[^\]]*\])?\s*\(x(\d+)/);
        const row = m && byTitle[m[1].trim().toLowerCase()];
        if (!row) return;
        const q = parseInt(m[2], 10) || 1;
        row.units += q;
        row.revenue += q * row.price;
      });
    });
    return Object.values(byTitle).filter(r => r.units > 0).sort((a, b) => b.units - a.units).slice(0, 5);
  }

  // ---------------- Product duplicate, bulk actions, CSV export ----------------
  app.post(ADMIN + '/products/duplicate/:id', requireAdmin, csrfProtect, async (req, res) => {
    const { data: src } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (!src) return back(res, 'Product not found.');
    const copy = { ...src };
    delete copy.id;
    const baseTitle = String(src.title || src.name || 'Product');
    copy.title = (baseTitle + ' (Copy)').slice(0, 120);
    if (copy.name !== undefined) copy.name = copy.title;
    copy.sku = String(src.sku || 'TN').slice(0, 20) + '-C' + Date.now().toString().slice(-4);
    copy.is_archived = true; // a copy starts hidden until you finish editing it
    copy.is_active = false;
    copy.created_at = new Date().toISOString();
    const { error } = await universalInsert('products', copy, copy);
    if (error) return back(res, 'Duplicate failed: ' + error.message);
    await appendAuditLog(req.session.adminName, 'Product Duplicated', `#${req.params.id} "${baseTitle}"`);
    back(res, 'Copy created as an archived draft. Edit it, then restore it to publish.');
  });

  app.post(ADMIN + '/products/bulk', requireAdmin, csrfProtect, async (req, res) => {
    const ids = asArray(req.body.selected_products).map(String).filter(x => /^\d{1,12}$/.test(x)).slice(0, 200);
    const action = req.body.bulk_action;
    if (!ids.length) return back(res, 'Select at least one product first.');
    if (!['archive', 'restore', 'delete'].includes(action)) return back(res, 'Choose a bulk action.');
    if (action === 'delete' && req.session.adminRole !== 'SuperAdmin') return back(res, 'Error: Only SuperAdmin can permanently delete products.');
    let done = 0, failed = 0;
    for (const id of ids) {
      let error;
      if (action === 'delete') ({ error } = await supabase.from('products').delete().eq('id', id));
      else ({ error } = await ctx.universalUpdate('products', id, { is_archived: action === 'archive', is_active: action === 'restore' }, { is_archived: action === 'archive' }));
      if (error) failed++; else done++;
    }
    await appendAuditLog(req.session.adminName, 'Bulk Product ' + action, `${done} done, ${failed} failed`);
    back(res, `${done} product(s) ${action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'restored'}.` + (failed ? ` ${failed} could not be changed (products with orders cannot be deleted, archive them instead).` : ''));
  });

  const csvCell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  app.get(ADMIN + '/products/export.csv', requireAdmin, async (req, res) => {
    const { data } = await supabase.from('products').select('*').order('id', { ascending: true });
    const cols = ['id', 'title', 'sku', 'category', 'subcategory', 'price', 'regular_price', 'cost_price', 'stock_quantity', 'free_delivery', 'is_archived', 'description', 'image'];
    const rows = [cols.join(',')].concat((data || []).map(r => cols.map(c => csvCell(r[c])).join(',')));
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="trendzznow-products.csv"' });
    res.send('﻿' + rows.join('\r\n'));
  });

  return { resolveCoupon, claimCoupon, releaseCoupon, isBlockedPhone, phoneRisk, topSellers, calcDiscount };
};
