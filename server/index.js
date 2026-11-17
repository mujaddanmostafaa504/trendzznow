require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const compression = require('compression');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { sendOrderSMS, sendOrderEmail } = require('./notifications');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = process.env.SESSION_SECRET || '';

const missingConfig = [];
if (!supabaseUrl) missingConfig.push('SUPABASE_URL');
if (!supabaseKey) missingConfig.push('SUPABASE_KEY (server-side Supabase service role key)');
if (adminPassword.length < 16 || adminPassword === 'CHANGE_ME_USE_A_LONG_RANDOM_PASSWORD') missingConfig.push('ADMIN_PASSWORD (at least 16 characters; change the placeholder)');
if (sessionSecret.length < 32 || sessionSecret === 'CHANGE_ME_GENERATE_A_64_CHAR_RANDOM_SECRET') missingConfig.push('SESSION_SECRET (at least 32 characters; change the placeholder)');
if (missingConfig.length) {
  console.error('TrendzzNow cannot start. Configure these environment variables:', missingConfig.join(', '));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(cookieSession({
  name: 'trendzznow_admin_sess',
  keys: [sessionSecret],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax'
}));


const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' }
});
const orderPlaceLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many order attempts. Please try again later.' }
});
const orderTrackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many tracking requests. Please try again later.' }
});

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const defaultSettings = {
  site_title: 'TrendzzNow - Stay on trend. Stay in style.',
  brand_name_first: 'Trendzz',
  brand_name_second: 'Now',
  logo_light: '',
  logo_dark: '',
  hero_image: '',
  hero_badge_text: '🔥 Trending Spotlight',
  hero_featured_title: 'Dynamic Leaf Table Lamp',
  hero_featured_price: '৳ 950',
  hero_featured_link: '#products',
  tagline_en: 'Stay on trend. Stay in style.',
  tagline_bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন',
  banner_text: '⚡ Only Viral & Trending Products | 100% Cash on Delivery Across Bangladesh',
  banner_text_bn: '⚡ শুধুমাত্র সেরা ট্রেন্ডিং প্রোডাক্ট | সারা বাংলাদেশে ক্যাশ অন ডেলিভারি!',
  hero_title_en: 'Just Trending Products — Curated for You',
  hero_title_bn: 'শুধুমাত্র সেরা ট্রেন্ডিং প্রোডাক্ট কালেকশন',
  hero_subtitle_en: 'Stay on trend. Stay in style. Handpicked viral gadgets & modern essentials delivered straight to your doorstep.',
  hero_subtitle_bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন। বাছাইকৃত সেরা ভাইরাল গ্যাজেট ও আধুনিক পণ্য পান ক্যাশ অন ডেলিভারিতে।',
  whatsapp_number: '01731763504',
  bkash_number: '01731763504',
  nagad_number: '01731763504',
  delivery_inside_dhaka: '70',
  delivery_outside_dhaka: '130',
  courier_partners: 'SteadFast,Pathao,RedX',
  facebook_pixel: '',
  promo_code: 'TREND50',
  promo_discount: '50',
  faq_1_q: 'How long does delivery take across Bangladesh?',
  faq_1_a: 'Inside Dhaka delivery takes 24–48 hours, and outside Dhaka takes 2–4 business days via SteadFast, Pathao, or RedX.',
  faq_2_q: 'Can I check the product before paying?',
  faq_2_a: 'Yes! We offer 100% Cash on Delivery (COD). You can inspect the parcel in front of the delivery rider before paying.',
  faq_3_q: 'What is your return & replacement policy?',
  faq_3_a: 'If you receive a damaged or wrong item, notify us immediately via WhatsApp (01731763504) for a free instant replacement.',
  faq_4_q: 'How can I track my order?',
  faq_4_a: 'Click the "Track Order" button in the top menu and enter your mobile number to see live order status.',
  privacy_policy: 'At TrendzzNow (trendzznow.com), we value your privacy. Customer names, phone numbers, and delivery addresses are strictly used only to process and ship your orders via our trusted courier partners.',
  return_policy: 'We offer a 7-Day Easy Replacement Policy for any manufacturing defect, transit damage, or wrong item delivered. Contact us on WhatsApp at 01731763504 within 24 hours.',
  terms_conditions: 'By placing an order on TrendzzNow, you agree to provide accurate contact and delivery details. Orders confirmed via website or WhatsApp are dispatched within 24 hours.'
};

function normalizeProduct(p) {
  if (!p) return p;
  return {
    ...p,
    title: p.title || p.name || 'Product',
    name: p.name || p.title || 'Product',
    category: p.category || p.cat || 'All Categories',
    image: p.image || p.image_url || p.img || '',
    price: p.price !== undefined && p.price !== null ? p.price : (p.sale_price || 0),
    regular_price: p.regular_price || p.old_price || '',
    cost_price: p.cost_price !== undefined && p.cost_price !== null ? p.cost_price : 0,
    stock_quantity: p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : 50,
    description: p.description || p.desc || p.details || '',
    variant_options: p.variant_options || p.variants || ''
  };
}

function normalizeOrder(o) {
  if (!o) return o;
  return {
    ...o,
    customer_name: o.customer_name || o.name || 'Customer',
    phone: o.phone || o.mobile || '',
    address: o.address || o.delivery_address || '',
    product_title: o.product_title || o.product_name || o.product || 'Order Item',
    price: o.price !== undefined && o.price !== null ? o.price : (o.total || o.total_amount || o.amount || 0),
    status: o.status || 'Pending',
    consignment_id: o.consignment_id || '',
    admin_notes: o.admin_notes || ''
  };
}

async function getSettings() {
  try {
    if (!supabaseUrl || !supabaseKey) return { ...defaultSettings };
    const { data, error } = await supabase.from('settings').select('*');
    const settings = { ...defaultSettings };
    if (!error && data) {
      data.forEach(item => {
        if (item.value !== null && item.value !== '') {
          settings[item.key] = item.value;
        }
      });
    }
    return settings;
  } catch (err) {
    return { ...defaultSettings };
  }
}

async function handleImageUpload(file) {
  if (!file) return null;
  try {
    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (publicUrlData && publicUrlData.publicUrl) return publicUrlData.publicUrl;
    }
  } catch (e) {}
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
}

async function getNextSequentialId(table) {
  try {
    const { data } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (data && data.length > 0 && !isNaN(Number(data[0].id))) {
      return Number(data[0].id) + 1;
    }
  } catch (e) {}
  return Math.floor(Date.now() / 1000);
}

async function universalInsert(table, payload, fallbackValues = {}) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await supabase.from(table).insert([currentPayload]).select();
    if (!error) return { data, error: null };

    const msg = error.message || '';
    const colMatch = msg.match(/Could not find the '([^']+)' column/);
    if (colMatch && colMatch[1] && Object.prototype.hasOwnProperty.call(currentPayload, colMatch[1])) {
      delete currentPayload[colMatch[1]];
      continue;
    }

    const nullMatch = msg.match(/null value in column "([^"]+)"/);
    if (nullMatch && nullMatch[1]) {
      const col = nullMatch[1];
      if (col === 'id') {
        currentPayload.id = await getNextSequentialId(table);
      } else if (fallbackValues[col] !== undefined) {
        currentPayload[col] = fallbackValues[col];
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|cost|stock|num|number)/i.test(col)) {
        currentPayload[col] = 0;
      } else {
        currentPayload[col] = '';
      }
      continue;
    }

    if (msg.includes('invalid input syntax for type')) {
      for (const k of Object.keys(currentPayload)) {
        if (currentPayload[k] === '') currentPayload[k] = 0;
      }
      continue;
    }

    if (msg.includes('duplicate key') && currentPayload.id) {
      currentPayload.id = Number(currentPayload.id) + 1;
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Insert failed after universal schema adaptation.' } };
}

async function universalUpdate(table, id, payload, fallbackValues = {}) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await supabase.from(table).update(currentPayload).eq('id', id).select();
    if (!error) return { data, error: null };

    const msg = error.message || '';
    const colMatch = msg.match(/Could not find the '([^']+)' column/);
    if (colMatch && colMatch[1] && Object.prototype.hasOwnProperty.call(currentPayload, colMatch[1])) {
      delete currentPayload[colMatch[1]];
      continue;
    }

    const nullMatch = msg.match(/null value in column "([^"]+)"/);
    if (nullMatch && nullMatch[1]) {
      const col = nullMatch[1];
      if (fallbackValues[col] !== undefined) {
        currentPayload[col] = fallbackValues[col];
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|cost|stock|num|number)/i.test(col)) {
        currentPayload[col] = 0;
      } else {
        currentPayload[col] = '';
      }
      continue;
    }

    if (msg.includes('invalid input syntax for type')) {
      for (const k of Object.keys(currentPayload)) {
        if (currentPayload[k] === '') currentPayload[k] = 0;
      }
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Update failed after universal schema adaptation.' } };
}

app.get('/healthz', (req, res) => res.status(200).send('OK'));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /secret-admin-panel-2026\nSitemap: ${(process.env.APP_BASE_URL || 'https://trendzznow.com').replace(/\/$/, '')}/sitemap.xml`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: products } = await supabase.from('products').select('id').order('id', { ascending: false });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    const baseUrl = (process.env.APP_BASE_URL || 'https://trendzznow.com').replace(/\/$/, '');
    xml += `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    if (products && products.length > 0) {
      products.forEach(p => {
        xml += `  <url><loc>${baseUrl}/product/${p.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      });
    }
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('');
  }
});

// Home Route
app.get('/', async (req, res) => {
  try {
    let { data: products, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) products = [];
    const normalizedProducts = (products || []).map(normalizeProduct);
    const settings = await getSettings();
    res.render('index', { products: normalizedProducts, settings });
  } catch (err) {
    res.render('index', { products: [], settings: defaultSettings });
  }
});

// Specific Product Page
app.get('/product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const { data: rawProduct, error } = await supabase.from('products').select('*').eq('id', productId).single();
    if (error || !rawProduct) return res.redirect('/');
    const product = normalizeProduct(rawProduct);
    const settings = await getSettings();
    const { data: relatedRaw } = await supabase.from('products').select('*').neq('id', productId).limit(4);
    const relatedProducts = (relatedRaw || []).map(normalizeProduct);
    res.render('product-detail', { product, relatedProducts, settings });
  } catch (err) {
    res.redirect('/');
  }
});

// Customer order tracking: require both exact order ID and phone number.
app.get('/order/track', orderTrackLimiter, async (req, res) => {
  const orderId = String(req.query.order_id || '').trim();
  const phoneDigits = String(req.query.phone || '').replace(/\D/g, '');
  const normalizedPhone = phoneDigits.startsWith('880') ? phoneDigits.slice(2) : phoneDigits;
  if (!/^\d+$/.test(orderId) || !/^01[3-9]\d{8}$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, message: 'Enter the exact order ID and the phone number used for that order.' });
  }
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, phone, customer_name, product_title, price, status, consignment_id, created_at')
      .eq('id', orderId)
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, message: 'Unable to check order status right now.' });
    if (!order) return res.status(404).json({ success: true, orders: [] });
    return res.json({ success: true, orders: [normalizeOrder(order)] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to check order status right now.' });
  }
});

// Server-authoritative order placement. Never trust price, delivery charge, or discount sent by the browser.
app.post('/order/place', orderPlaceLimiter, async (req, res) => {
  const {
    customer_name, phone, customer_email, address, product_id, quantity,
    delivery_area, payment_method, trx_id, courier_choice, variant, promo_code
  } = req.body;

  const cleanName = String(customer_name || '').trim();
  const cleanAddress = String(address || '').trim();
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const normalizedPhone = phoneDigits.startsWith('880') ? phoneDigits.slice(2) : phoneDigits;
  const productId = String(product_id || '').trim();
  const qty = Number.parseInt(quantity, 10);

  if (!cleanName || !cleanAddress || !/^01[3-9]\d{8}$/.test(normalizedPhone) || !/^\d+$/.test(productId)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid name, Bangladeshi phone number, address, and product.' });
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
    return res.status(400).json({ success: false, message: 'Quantity must be between 1 and 50.' });
  }

  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price, stock_quantity, variant_options')
      .eq('id', productId)
      .maybeSingle();
    if (productError || !product) return res.status(404).json({ success: false, message: 'This product is no longer available.' });

    const unitPrice = Number(product.price);
    const availableStock = Number(product.stock_quantity);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return res.status(400).json({ success: false, message: 'This product has an invalid price. Please contact the store.' });
    if (!Number.isInteger(availableStock) || availableStock < qty) return res.status(409).json({ success: false, message: 'Sorry, there is not enough stock for this quantity.' });

    const allowedVariants = String(product.variant_options || '').split(',').map(v => v.trim()).filter(Boolean);
    const selectedVariant = String(variant || '').trim();
    if (selectedVariant && !allowedVariants.includes(selectedVariant)) {
      return res.status(400).json({ success: false, message: 'Please select a valid product variant.' });
    }

    const settings = await getSettings();
    const area = delivery_area === 'Outside Dhaka' ? 'Outside Dhaka' : 'Inside Dhaka';
    const deliveryCharge = Math.max(0, Number(area === 'Outside Dhaka' ? settings.delivery_outside_dhaka : settings.delivery_inside_dhaka) || 0);
    const productTotal = unitPrice * qty;
    const submittedPromo = String(promo_code || '').trim().toUpperCase();
    const configuredPromo = String(settings.promo_code || '').trim().toUpperCase();
    const configuredDiscount = Math.max(0, Number(settings.promo_discount) || 0);
    const discountAmount = submittedPromo && submittedPromo === configuredPromo ? Math.min(configuredDiscount, productTotal) : 0;
    if (submittedPromo && discountAmount === 0) {
      return res.status(400).json({ success: false, message: 'The promo code is invalid or not available.' });
    }

    const allowedPayments = ['Cash on Delivery (COD)', 'bKash', 'Nagad'];
    const selectedPayment = allowedPayments.includes(payment_method) ? payment_method : 'Cash on Delivery (COD)';
    if (selectedPayment !== 'Cash on Delivery (COD)' && !String(trx_id || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please provide the payment transaction reference.' });
    }

    const allowedCouriers = ['SteadFast Courier', 'Pathao Courier', 'RedX Courier'];
    const selectedCourier = allowedCouriers.includes(courier_choice) ? courier_choice : 'SteadFast Courier';
    const totalAmount = Math.max(0, productTotal + deliveryCharge - discountAmount);
    const variantText = selectedVariant ? ` [Variant: ${selectedVariant}]` : '';
    const fullProdTitle = `${product.title}${variantText} (x${qty})`;
    const email = String(customer_email || '').trim();
    const detailedAddress = `${cleanAddress} | Area: ${area} | Payment: ${selectedPayment}${trx_id ? ' (TrxID: ' + String(trx_id).trim() + ')' : ''} | Courier: ${selectedCourier}${discountAmount > 0 ? ' | Discount: -৳' + discountAmount : ''}${email ? ' | Email: ' + email : ''}`;

    const orderPayload = {
      product_id: Number(product.id),
      customer_name: cleanName,
      name: cleanName,
      phone: normalizedPhone,
      mobile: normalizedPhone,
      customer_email: email,
      email,
      address: detailedAddress,
      delivery_address: detailedAddress,
      product_title: fullProdTitle,
      product_name: fullProdTitle,
      product: fullProdTitle,
      unit_price: unitPrice,
      delivery_charge: deliveryCharge,
      discount_applied: discountAmount,
      price: totalAmount,
      total: totalAmount,
      total_amount: totalAmount,
      amount: totalAmount,
      quantity: qty,
      status: 'Pending',
      consignment_id: '',
      admin_notes: '',
      created_at: new Date().toISOString()
    };
    const fallbacks = {
      product_id: Number(product.id), customer_name: cleanName, name: cleanName,
      phone: normalizedPhone, mobile: normalizedPhone, address: detailedAddress,
      product_title: fullProdTitle, price: totalAmount, quantity: qty, status: 'Pending'
    };

    const { data: insertedRows, error: insertError } = await universalInsert('orders', orderPayload, fallbacks);
    if (insertError || !insertedRows || !insertedRows[0]) {
      return res.status(500).json({ success: false, message: 'Could not save the order. Please try again.' });
    }
    const savedOrder = insertedRows[0];

    // Optimistic stock update prevents two concurrent orders from selling the same last item.
    const { data: stockUpdate, error: stockError } = await supabase
      .from('products')
      .update({ stock_quantity: availableStock - qty })
      .eq('id', product.id)
      .eq('stock_quantity', availableStock)
      .select('id');
    if (stockError || !stockUpdate || stockUpdate.length === 0) {
      await supabase.from('orders').delete().eq('id', savedOrder.id);
      return res.status(409).json({ success: false, message: 'Stock just changed. Please refresh the product and try again.' });
    }

    sendOrderSMS({
      phone: normalizedPhone, customerName: cleanName, orderId: savedOrder.id,
      totalAmount, status: 'Pending', hotLine: settings.whatsapp_number
    });
    if (email) {
      sendOrderEmail({
        email, customerName: cleanName, phone: normalizedPhone, orderId: savedOrder.id,
        productTitle: fullProdTitle, totalAmount, address: cleanAddress,
        status: 'Pending', hotLine: settings.whatsapp_number
      });
    }

    return res.json({ success: true, message: 'Order placed successfully!', orderId: savedOrder.id, totalAmount });
  } catch (err) {
    console.error('Order placement failed:', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while placing the order.' });
  }
});

// ================= SECURE HIDDEN ADMIN ROUTES =================
app.get('/admin', (req, res) => {
  res.redirect('/');
});

app.get('/secret-admin-panel-2026', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/secret-admin-panel-2026/dashboard');
  res.render('admin-login', { error: null });
});

app.post('/secret-admin-panel-2026/login', adminLoginLimiter, (req, res) => {
  const entered = String(req.body.password || '');
  if (timingSafeStringEqual(entered, adminPassword)) {
    req.session = { isAdmin: true, authenticatedAt: Date.now() };
    return res.redirect('/secret-admin-panel-2026/dashboard');
  }
  return res.status(401).render('admin-login', { error: 'Invalid credentials. Please try again.' });
});

app.get('/secret-admin-panel-2026/logout', (req, res) => {
  req.session = null;
  res.redirect('/secret-admin-panel-2026');
});

app.get('/secret-admin-panel-2026/dashboard', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/secret-admin-panel-2026');
  try {
    const { data: rawProducts } = await supabase.from('products').select('*').order('id', { ascending: false });
    const { data: rawOrders } = await supabase.from('orders').select('*').order('id', { ascending: false });
    const products = (rawProducts || []).map(normalizeProduct);
    const orders = (rawOrders || []).map(normalizeOrder);
    const settings = await getSettings();

    let totalRevenue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let deliveredCount = 0;
    let returnCount = 0;
    let totalCost = 0;

    orders.forEach(o => {
      const p = parseFloat(o.price) || 0;
      if (o.status === 'Cancelled' || o.status === 'Return') {
        if (o.status === 'Return') returnCount++;
      } else {
        totalRevenue += p;
        if (o.status === 'Pending') pendingCount++;
        if (o.status === 'Confirmed' || o.status.includes('SteadFast') || o.status.includes('Pathao')) confirmedCount++;
        if (o.status === 'Delivered') deliveredCount++;
      }
    });

    products.forEach(p => {
      totalCost += (parseFloat(p.cost_price) || 0) * (parseInt(p.stock_quantity) || 0);
    });

    const netProfit = totalRevenue - totalCost;

    res.render('admin-dashboard', { 
      products, 
      orders, 
      settings, 
      analytics: { totalRevenue, pendingCount, confirmedCount, deliveredCount, returnCount, netProfit },
      msg: req.query.msg || null 
    });
  } catch (err) {
    res.render('admin-dashboard', { products: [], orders: [], settings: defaultSettings, analytics: {}, msg: null });
  }
});

app.post('/secret-admin-panel-2026/password/change', (req, res) => {
  return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('For security, change ADMIN_PASSWORD in your hosting environment variables, then redeploy.'));
});

app.post('/secret-admin-panel-2026/subadmin/add', (req, res) => {
  return res.status(410).send('Sub-admin accounts are disabled until role-based access control is implemented.');
});

// Universal Add Product
app.post('/secret-admin-panel-2026/products/add', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { title, category, price, regular_price, cost_price, stock_quantity, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  const cleanTitle = (title || 'Untitled Product').trim();
  const cleanCat = (category || 'Trending').trim();
  const cleanPrice = parseFloat(price) || 0;
  const cleanRegPrice = parseFloat(regular_price) || cleanPrice;
  const cleanCost = parseFloat(cost_price) || 0;
  const cleanStock = parseInt(stock_quantity) || 50;

  const productPayload = {
    title: cleanTitle,
    name: cleanTitle,
    category: cleanCat,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: description || '',
    image: finalImage,
    image_url: finalImage,
    variant_options: variant_options || '',
    created_at: new Date().toISOString()
  };

  const fallbacks = {
    title: cleanTitle,
    name: cleanTitle,
    category: cleanCat,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: description || '',
    image: finalImage,
    image_url: finalImage
  };

  try {
    const { error } = await universalInsert('products', productPayload, fallbacks);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: ' + error.message));
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product added successfully!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Error: ' + err.message));
  }
});

// Universal Edit Product
app.post('/secret-admin-panel-2026/products/edit/:id', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { id } = req.params;
  const { title, category, price, regular_price, cost_price, stock_quantity, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  const cleanTitle = (title || 'Untitled Product').trim();
  const cleanCat = (category || 'Trending').trim();
  const cleanPrice = parseFloat(price) || 0;
  const cleanRegPrice = parseFloat(regular_price) || cleanPrice;
  const cleanCost = parseFloat(cost_price) || 0;
  const cleanStock = parseInt(stock_quantity) || 50;

  const updatePayload = {
    title: cleanTitle,
    name: cleanTitle,
    category: cleanCat,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: description || '',
    image: finalImage,
    image_url: finalImage,
    variant_options: variant_options || ''
  };

  const fallbacks = {
    title: cleanTitle,
    name: cleanTitle,
    category: cleanCat,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    cost_price: cleanCost,
    stock_quantity: cleanStock,
    description: description || '',
    image: finalImage,
    image_url: finalImage
  };

  try {
    const { error } = await universalUpdate('products', id, updatePayload, fallbacks);
    if (error) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Update Error: ' + error.message));
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product updated successfully!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Update Error: ' + err.message));
  }
});

app.post('/secret-admin-panel-2026/products/delete/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  try {
    await supabase.from('products').delete().eq('id', req.params.id);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Product deleted.'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

app.post('/secret-admin-panel-2026/orders/status/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const orderId = req.params.id;
  const { status, consignment_id, admin_notes } = req.body;
  try {
    const updateObj = { status: status || 'Pending' };
    if (consignment_id !== undefined) updateObj.consignment_id = consignment_id.trim();
    if (admin_notes !== undefined) updateObj.admin_notes = admin_notes.trim();

    await universalUpdate('orders', orderId, updateObj, updateObj);
    const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single();
    const settings = await getSettings();

    if (orderData && orderData.phone) {
      sendOrderSMS({
        phone: orderData.phone,
        customerName: orderData.customer_name || orderData.name || 'Customer',
        orderId: orderData.id,
        totalAmount: orderData.price || orderData.total || 0,
        status: status,
        hotLine: settings.whatsapp_number
      });

      const emailMatch = (orderData.address || '').match(/Email:\s*([^\s|]+@[^\s|]+)/i);
      const custEmail = orderData.customer_email || orderData.email || (emailMatch ? emailMatch[1] : '');
      if (custEmail) {
        sendOrderEmail({
          email: custEmail,
          customerName: orderData.customer_name || orderData.name || 'Customer',
          phone: orderData.phone,
          orderId: orderData.id,
          productTitle: orderData.product_title || orderData.product_name || 'Order Item',
          totalAmount: orderData.price || orderData.total || 0,
          address: orderData.address || '',
          status: status,
          hotLine: settings.whatsapp_number
        });
      }
    }

    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order updated & customer notified!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

app.post('/secret-admin-panel-2026/orders/bulk-action', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { selected_orders, bulk_status } = req.body;
  if (!selected_orders || !bulk_status) return res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('No orders selected for bulk action!'));
  
  const orderIds = Array.isArray(selected_orders) ? selected_orders : [selected_orders];
  try {
    for (const id of orderIds) {
      await universalUpdate('orders', id, { status: bulk_status }, { status: bulk_status });
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', id).single();
      const settings = await getSettings();
      if (orderData && orderData.phone) {
        sendOrderSMS({
          phone: orderData.phone,
          customerName: orderData.customer_name || orderData.name || 'Customer',
          orderId: orderData.id,
          totalAmount: orderData.price || orderData.total || 0,
          status: bulk_status,
          hotLine: settings.whatsapp_number
        });
      }
    }
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent(`Successfully updated ${orderIds.length} orders to "${bulk_status}"!`));
  } catch(e) {
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Bulk action failed.'));
  }
});

app.post('/secret-admin-panel-2026/orders/delete/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  try {
    await supabase.from('orders').delete().eq('id', req.params.id);
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Order deleted.'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

app.post('/secret-admin-panel-2026/settings/update', upload.fields([{ name: 'logo_file', maxCount: 1 }, { name: 'hero_file', maxCount: 1 }]), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/secret-admin-panel-2026');
  const settingsData = { ...req.body };

  if (req.files && req.files['logo_file'] && req.files['logo_file'][0]) {
    const uploadedLogoUrl = await handleImageUpload(req.files['logo_file'][0]);
    if (uploadedLogoUrl) settingsData.logo_light = uploadedLogoUrl;
  }

  if (req.files && req.files['hero_file'] && req.files['hero_file'][0]) {
    const uploadedHeroUrl = await handleImageUpload(req.files['hero_file'][0]);
    if (uploadedHeroUrl) settingsData.hero_image = uploadedHeroUrl;
  }

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    }
    res.redirect('/secret-admin-panel-2026/dashboard?msg=' + encodeURIComponent('Hero Spotlight, Brand Logo, FAQ & Store Settings updated!'));
  } catch (err) {
    res.redirect('/secret-admin-panel-2026/dashboard');
  }
});

app.listen(PORT, () => {
  console.log(`TrendzzNow server running on port ${PORT}`);
});
