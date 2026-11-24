// Extra storefront features: info/policy pages, customer reviews + ratings, PWA manifest, 404 and error pages.
module.exports = function registerFeatures(app, ctx) {
  const { supabase, getSettings, sanitizeStr, rateLimited, requireAdmin, csrfProtect, normalizeProduct, appendAuditLog, BD_PHONE_RE } = ctx;

  const brandOf = (s) => (s.brand_name_first || 'Trendzz') + (s.brand_name_second || 'Now');

  // ---------------- Info and policy pages ----------------
  const PAGES = {
    'privacy-policy': { title: 'Privacy Policy', text: (s) => s.privacy_policy },
    'return-policy': { title: 'Return & Replacement Policy', text: (s) => s.return_policy },
    'terms': { title: 'Terms & Conditions', text: (s) => s.terms_conditions },
    'shipping-policy': {
      title: 'Shipping & Delivery',
      text: (s) => [
        `Inside Dhaka: ৳${s.delivery_inside_dhaka || 70}, delivered in 24 to 48 hours.`,
        `Outside Dhaka: ৳${s.delivery_outside_dhaka || 130}, delivered in 2 to 4 days.`,
        s.free_shipping_threshold ? `Free delivery on orders of ৳${s.free_shipping_threshold} or more.` : '',
        'Cash on Delivery is available. You can open and inspect the parcel in front of the rider before you pay.',
        'We ship with trusted courier partners such as SteadFast, Pathao and REDX. After your order is confirmed you can follow it on our Order Tracking page using your mobile number.'
      ].filter(Boolean).join('\n')
    },
    'about': { title: 'About Us', text: (s) => `${brandOf(s)}\n${s.footer_about_en || 'Official e-commerce destination for viral gadgets, home decor, and lifestyle essentials across Bangladesh.'}` },
    'contact': {
      title: 'Contact Us',
      text: (s) => [
        `WhatsApp / Hotline: ${s.whatsapp_number || '01731763504'}`,
        `bKash / Nagad: ${s.bkash_number || s.whatsapp_number || '01731763504'}`,
        s.social_facebook ? `Facebook: ${s.social_facebook}` : '',
        s.social_instagram ? `Instagram: ${s.social_instagram}` : '',
        'Message us on WhatsApp any time for order help, delivery updates or product questions.'
      ].filter(Boolean).join('\n')
    }
  };
  app.locals.PAGE_LINKS = Object.entries(PAGES).map(([slug, p]) => ({ slug, title: p.title }));

  Object.entries(PAGES).forEach(([slug, page]) => {
    app.get('/' + slug, async (req, res) => {
      const settings = await getSettings();
      const raw = String(page.text(settings) || '').trim();
      const paragraphs = raw ? raw.split(/\n+/).map(x => x.trim()).filter(Boolean) : ['This page has not been filled in yet.'];
      res.render('page', { settings, title: page.title, slug, paragraphs });
    });
  });

  // ---------------- PWA manifest and favicon ----------------
  app.get('/manifest.webmanifest', async (req, res) => {
    const s = await getSettings();
    const icons = s.logo_light && /^https?:\/\//i.test(s.logo_light) ? [{ src: s.logo_light, sizes: '512x512', type: 'image/png', purpose: 'any' }] : [];
    res.type('application/manifest+json').send(JSON.stringify({
      name: brandOf(s), short_name: brandOf(s), start_url: '/', display: 'standalone',
      background_color: '#ffffff', theme_color: '#1F1B5C', icons
    }));
  });
  app.get('/favicon.ico', async (req, res) => {
    const s = await getSettings();
    if (s.logo_light && /^https?:\/\//i.test(s.logo_light)) return res.redirect(302, s.logo_light);
    res.status(204).end();
  });

  // ---------------- Reviews ----------------
  async function getRatingStats() {
    const { data, error } = await supabase.from('reviews').select('product_id, rating').eq('status', 'approved').limit(5000);
    const stats = {};
    if (error || !data) return stats;
    data.forEach(r => {
      const k = String(r.product_id);
      stats[k] = stats[k] || { sum: 0, count: 0 };
      stats[k].sum += Number(r.rating) || 0;
      stats[k].count += 1;
    });
    Object.values(stats).forEach(s => { s.avg = Math.round((s.sum / s.count) * 10) / 10; });
    return stats;
  }

  async function getProductReviews(productId) {
    const { data, error } = await supabase.from('reviews').select('*').eq('product_id', productId).eq('status', 'approved').order('id', { ascending: false }).limit(30);
    return error || !data ? [] : data;
  }

  app.post('/product/:id/review', async (req, res) => {
    const productId = String(req.params.id || '');
    if (!/^\d{1,12}$/.test(productId)) return res.status(400).json({ success: false, message: 'Invalid product.' });
    if (req.body.website) return res.json({ success: true, message: 'Thank you!' }); // honeypot: bots fill this
    const name = sanitizeStr(String(req.body.name || '')).slice(0, 40);
    const comment = sanitizeStr(String(req.body.comment || '')).slice(0, 500);
    const rating = parseInt(req.body.rating, 10);
    if (name.length < 2) return res.status(400).json({ success: false, message: 'Please enter your name.' });
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ success: false, message: 'Please choose a star rating from 1 to 5.' });
    if (comment.length < 5) return res.status(400).json({ success: false, message: 'Please write at least a few words about the product.' });

    // Only well-formed reviews count against the limit.
    if (rateLimited('review:' + req.ip + ':' + productId, 3, 60 * 60 * 1000) || rateLimited('reviewip:' + req.ip, 10, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'You have sent too many reviews. Please try again later.' });
    }

    try {
      const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
      if (!prod || normalizeProduct(prod).is_archived) return res.status(404).json({ success: false, message: 'Product not found.' });

      // Verified buyer: the mobile number matches a Delivered order that contains this product. The number itself is never stored.
      let verified = false;
      const phone = String(req.body.phone || '').replace(/[\s-]/g, '');
      if (phone && BD_PHONE_RE.test(phone)) {
        const { data: ords } = await supabase.from('orders').select('product_title, status').ilike('phone', `%${phone.replace(/\D/g, '').slice(-10)}`).eq('status', 'Delivered').limit(50);
        const t = String(prod.title || '').toLowerCase();
        verified = !!(ords || []).some(o => String(o.product_title || '').toLowerCase().includes(t));
      }

      const { error } = await supabase.from('reviews').insert({ product_id: Number(productId), name, rating, comment, verified, status: 'pending' });
      if (error) {
        console.error('[review]', error.message);
        return res.status(500).json({ success: false, message: 'Reviews are not available right now. Please try again later.' });
      }
      res.json({ success: true, verified, message: 'Thank you! Your review will appear after our team approves it.' });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Could not save your review.' });
    }
  });

  app.post('/secret-admin-panel-2026/reviews/:id/status', requireAdmin, csrfProtect, async (req, res) => {
    const status = req.body.status === 'approved' ? 'approved' : 'pending';
    const { error } = await supabase.from('reviews').update({ status }).eq('id', req.params.id);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Review update failed: ' + error.message));
    await appendAuditLog(req.session.adminName, 'Review ' + status, `Review #${req.params.id}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(status === 'approved' ? 'Review approved and published.' : 'Review hidden.'));
  });

  app.post('/secret-admin-panel-2026/reviews/:id/delete', requireAdmin, csrfProtect, async (req, res) => {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Review delete failed: ' + error.message));
    await appendAuditLog(req.session.adminName, 'Review Deleted', `Review #${req.params.id}`);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Review deleted.'));
  });

  return { getRatingStats, getProductReviews, pageSlugs: Object.keys(PAGES) };
};

// 404 and error pages. Call this after every other route is registered.
module.exports.registerErrorHandlers = function (app, ctx) {
  const { getSettings } = ctx;
  app.use(async (req, res) => {
    const settings = await getSettings().catch(() => ({}));
    if ((req.get('accept') || '').includes('application/json') && !(req.get('accept') || '').includes('text/html')) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(404).render('404', { settings });
  });
  // eslint-disable-next-line no-unused-vars
  app.use(async (err, req, res, next) => {
    console.error('[error]', req.method, req.originalUrl, err && err.message);
    const status = err && (err.status || err.statusCode) >= 400 && (err.status || err.statusCode) < 600 ? (err.status || err.statusCode) : 500;
    if (res.headersSent) return;
    if ((req.get('accept') || '').includes('application/json') || req.originalUrl.startsWith('/order/') || req.originalUrl.startsWith('/api/')) {
      return res.status(status).json({ success: false, message: status === 413 ? 'The upload is too large.' : 'Something went wrong. Please try again.' });
    }
    const settings = await getSettings().catch(() => ({}));
    res.status(status).render('404', { settings, serverError: true });
  });
};
