const express = require('express');
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

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  keys: ['trendzznow_secret_key_1_2026', 'trendzznow_secret_key_2_2026'],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: false,
  httpOnly: true,
  sameSite: 'lax'
}));

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
    image: p.image || p.image_url || p.img || '',
    price: p.price !== undefined && p.price !== null ? p.price : (p.sale_price || 0),
    regular_price: p.regular_price || p.old_price || '',
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
    status: o.status || 'Pending'
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

// Universal Self-Healing Insert
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
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|num|number)/i.test(col)) {
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

// Universal Self-Healing Update
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
      } else if (/(id|qty|quantity|count|price|total|amount|charge|discount|num|number)/i.test(col)) {
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
  res.send("User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://trendzznow.com/sitemap.xml");
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: products } = await supabase.from('products').select('id').order('id', { ascending: false });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>https://trendzznow.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
    if (products && products.length > 0) {
      products.forEach(p => {
        xml += `  <url><loc>https://trendzznow.com/product/${p.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
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

// Customer Order Tracking API
app.get('/order/track', async (req, res) => {
  const phone = (req.query.phone || '').trim();
  if (!phone) return res.json({ success: false, message: 'Please provide a valid phone number.' });
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('phone', `%${phone}%`)
      .order('id', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, orders: (orders || []).map(normalizeOrder) });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Universal Place Order Route + Auto SMS & Email
app.post('/order/place', async (req, res) => {
  const { 
    customer_name, phone, customer_email, address, product_title, price, quantity,
    delivery_area, delivery_charge, payment_method, trx_id, courier_choice, variant, discount_applied
  } = req.body;

  if (!customer_name || !phone || !address) {
    return res.status(400).json({ success: false, message: 'Name, Phone, and Address are required.' });
  }

  const basePrice = parseFloat(price) || 0;
  const qty = parseInt(quantity) || 1;
  const dCharge = parseFloat(delivery_charge) || 0;
  const discountVal = parseFloat(discount_applied) || 0;
  const totalAmount = Math.max(0, (basePrice * qty) + dCharge - discountVal);

  const variantText = variant ? ` [Variant: ${variant}]` : '';
  const emailNote = (customer_email && customer_email.trim()) ? ` | Email: ${customer_email.trim()}` : '';
  const discountText = discountVal > 0 ? ` | Discount: -৳${discountVal}` : '';
  const detailedAddress = `${address} | Area: ${delivery_area || 'Inside Dhaka'} | Payment: ${payment_method || 'COD'}${trx_id ? ' (TrxID: ' + trx_id + ')' : ''} | Courier: ${courier_choice || 'SteadFast'}${discountText}${emailNote}`;
  const fullProdTitle = `${product_title || 'Product'}${variantText} (x${qty})`;

  const orderPayload = {
    customer_name: customer_name.trim(),
    name: customer_name.trim(),
    phone: phone.trim(),
    mobile: phone.trim(),
    customer_email: (customer_email || '').trim(),
    email: (customer_email || '').trim(),
    address: detailedAddress,
    delivery_address: detailedAddress,
    product_title: fullProdTitle,
    product_name: fullProdTitle,
    product: fullProdTitle,
    price: totalAmount,
    total: totalAmount,
    total_amount: totalAmount,
    amount: totalAmount,
    quantity: qty,
    status: 'Pending',
    created_at: new Date().toISOString()
  };

  const fallbacks = {
    customer_name: customer_name.trim(),
    name: customer_name.trim(),
    phone: phone.trim(),
    mobile: phone.trim(),
    address: detailedAddress,
    delivery_address: detailedAddress,
    product_title: fullProdTitle,
    product_name: fullProdTitle,
    product: fullProdTitle,
    price: totalAmount,
    total: totalAmount,
    total_amount: totalAmount,
    amount: totalAmount,
    quantity: qty,
    status: 'Pending'
  };

  try {
    const { data: insertedRows, error } = await universalInsert('orders', orderPayload, fallbacks);
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const savedOrder = (insertedRows && insertedRows[0]) ? insertedRows[0] : { id: Math.floor(Date.now() / 1000) };
    const settings = await getSettings();

    sendOrderSMS({
      phone: phone.trim(),
      customerName: customer_name.trim(),
      orderId: savedOrder.id,
      totalAmount,
      status: 'Pending',
      hotLine: settings.whatsapp_number
    });

    if (customer_email && customer_email.trim()) {
      sendOrderEmail({
        email: customer_email.trim(),
        customerName: customer_name.trim(),
        phone: phone.trim(),
        orderId: savedOrder.id,
        productTitle: fullProdTitle,
        totalAmount,
        address: detailedAddress,
        status: 'Pending',
        hotLine: settings.whatsapp_number
      });
    }

    res.json({ success: true, message: 'Order placed successfully!', orderId: savedOrder.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= ADMIN AUTH =================
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const entered = (req.body.password || '').trim();
  const envPass = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';
  let dbPass = '';
  try {
    const settings = await getSettings();
    if (settings && settings.admin_password) dbPass = settings.admin_password.trim();
  } catch (e) {}

  if (entered === 'admin123' || (envPass && entered === envPass) || (dbPass && entered === dbPass)) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  } else {
    return res.render('admin-login', { error: 'Wrong password! Please enter admin123' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin');
});

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/admin');
  try {
    const { data: products } = await supabase.from('products').select('*').order('id', { ascending: false });
    const { data: orders } = await supabase.from('orders').select('*').order('id', { ascending: false });
    const settings = await getSettings();
    res.render('admin-dashboard', { 
      products: (products || []).map(normalizeProduct), 
      orders: (orders || []).map(normalizeOrder), 
      settings, 
      msg: req.query.msg || null 
    });
  } catch (err) {
    res.render('admin-dashboard', { products: [], orders: [], settings: defaultSettings, msg: null });
  }
});

app.post('/admin/password/change', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/admin');
  const { new_password, confirm_password } = req.body;
  if (!new_password || new_password.trim().length < 4) {
    return res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Password must be at least 4 characters!'));
  }
  if (new_password.trim() !== confirm_password.trim()) {
    return res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Passwords do not match!'));
  }
  try {
    await supabase.from('settings').upsert({ key: 'admin_password', value: new_password.trim() }, { onConflict: 'key' });
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Admin password updated successfully!'));
  } catch (err) {
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Failed to update password.'));
  }
});

// Universal Add Product
app.post('/admin/products/add', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { title, price, regular_price, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  const cleanTitle = (title || 'Untitled Product').trim();
  const cleanPrice = parseFloat(price) || 0;
  const cleanRegPrice = parseFloat(regular_price) || cleanPrice;

  const productPayload = {
    title: cleanTitle,
    name: cleanTitle,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    description: description || '',
    image: finalImage,
    image_url: finalImage,
    variant_options: variant_options || '',
    created_at: new Date().toISOString()
  };

  const fallbacks = {
    title: cleanTitle,
    name: cleanTitle,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    description: description || '',
    image: finalImage,
    image_url: finalImage
  };

  try {
    const { error } = await universalInsert('products', productPayload, fallbacks);
    if (error) return res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Error: ' + error.message));
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Product added successfully!'));
  } catch (err) {
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Error: ' + err.message));
  }
});

// Universal Edit Product
app.post('/admin/products/edit/:id', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { id } = req.params;
  const { title, price, regular_price, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  const cleanTitle = (title || 'Untitled Product').trim();
  const cleanPrice = parseFloat(price) || 0;
  const cleanRegPrice = parseFloat(regular_price) || cleanPrice;

  const updatePayload = {
    title: cleanTitle,
    name: cleanTitle,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    description: description || '',
    image: finalImage,
    image_url: finalImage,
    variant_options: variant_options || ''
  };

  const fallbacks = {
    title: cleanTitle,
    name: cleanTitle,
    price: cleanPrice,
    regular_price: cleanRegPrice,
    description: description || '',
    image: finalImage,
    image_url: finalImage
  };

  try {
    const { error } = await universalUpdate('products', id, updatePayload, fallbacks);
    if (error) return res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Update Error: ' + error.message));
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Product updated successfully!'));
  } catch (err) {
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Update Error: ' + err.message));
  }
});

app.post('/admin/products/delete/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  try {
    await supabase.from('products').delete().eq('id', req.params.id);
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Product deleted.'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

app.post('/admin/orders/status/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const orderId = req.params.id;
  const newStatus = req.body.status;
  try {
    await universalUpdate('orders', orderId, { status: newStatus }, { status: newStatus });
    const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single();
    const settings = await getSettings();

    if (orderData && orderData.phone) {
      sendOrderSMS({
        phone: orderData.phone,
        customerName: orderData.customer_name || orderData.name || 'Customer',
        orderId: orderData.id,
        totalAmount: orderData.price || orderData.total || 0,
        status: newStatus,
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
          status: newStatus,
          hotLine: settings.whatsapp_number
        });
      }
    }

    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Order status updated & customer notified!'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

app.post('/admin/orders/delete/:id', async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  try {
    await supabase.from('orders').delete().eq('id', req.params.id);
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Order deleted.'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

// Update Settings (Supports BOTH Logo File Upload AND Hero Showcase Product Image Upload!)
app.post('/admin/settings/update', upload.fields([{ name: 'logo_file', maxCount: 1 }, { name: 'hero_file', maxCount: 1 }]), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
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
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Hero Showcase, Brand Logo, FAQ & Store Settings updated!'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

app.listen(PORT, () => {
  console.log(`TrendzzNow Modern 3D Glassmorphism Server v19 running on port ${PORT}`);
});
