const express = require('express');
const cookieSession = require('cookie-session');
const compression = require('compression');
const multer = require('multer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(compression());

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup (Memory storage so we can upload to Supabase Storage OR convert/save cleanly without losing on Render restart)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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
  tagline_en: 'Stay on trend. Stay in style.',
  tagline_bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন',
  banner_text: '🚚 Free Home Delivery on Featured Items | Cash on Delivery Available across Bangladesh',
  banner_text_bn: '🚚 সারা বাংলাদেশে ক্যাশ অন ডেলিভারি ও দ্রুত হোম ডেলিভারি!',
  hero_title_en: 'Premium Lifestyle & Home Decor Collection',
  hero_title_bn: 'প্রিমিয়াম হোম ডেকোর ও লাইফস্টাইল কালেকশন ২০২৬',
  hero_subtitle_en: 'Discover trending gadgets, lamps, and everyday essentials with cash on delivery.',
  hero_subtitle_bn: 'আধুনিক গ্যাজেট, ল্যাম্প এবং লাইফস্টাইল পণ্য — ক্যাশ অন ডেলিভারিতে অর্ডার করুন।',
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
  privacy_policy: 'At TrendzzNow (trendzznow.com), we value your privacy. Customer names, phone numbers, and delivery addresses are strictly used only to process and ship your orders via our trusted courier partners. We never sell or share your personal data with third parties.',
  return_policy: 'We offer a 7-Day Easy Replacement Policy for any manufacturing defect, transit damage, or wrong item delivered. Please inspect the parcel upon delivery or record an unboxing video and contact us on WhatsApp at 01731763504 within 24 hours.',
  terms_conditions: 'By placing an order on TrendzzNow, you agree to provide accurate contact and delivery details. Orders confirmed via website or WhatsApp are dispatched within 24 hours. Refusing genuine parcels without valid reason may restrict future COD eligibility.'
};

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

// Helper: Upload image file to Supabase Storage (with automatic Base64 fallback so images NEVER disappear on Render!)
async function handleImageUpload(file) {
  if (!file) return null;
  try {
    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    
    // Try uploading to Supabase Storage bucket 'product-images'
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      if (publicUrlData && publicUrlData.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (e) {
    console.warn('Supabase storage upload skipped, using persistent Data URI fallback.');
  }

  // Persistent Data URI fallback (Stored directly in Supabase DB row so Render container restart NEVER deletes the image!)
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
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
    const settings = await getSettings();
    res.render('index', { products: products || [], settings });
  } catch (err) {
    res.render('index', { products: [], settings: defaultSettings });
  }
});

// Specific Product Page
app.get('/product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const { data: product, error } = await supabase.from('products').select('*').eq('id', productId).single();
    if (error || !product) return res.redirect('/');
    const settings = await getSettings();
    const { data: relatedProducts } = await supabase.from('products').select('*').neq('id', productId).limit(4);
    res.render('product-detail', { product, relatedProducts: relatedProducts || [], settings });
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
    res.json({ success: true, orders: orders || [] });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Place Order Route
app.post('/order/place', async (req, res) => {
  const { 
    customer_name, phone, address, product_title, price, quantity,
    delivery_area, delivery_charge, payment_method, trx_id, courier_choice, variant, discount_applied
  } = req.body;

  const basePrice = parseFloat(price) || 0;
  const qty = parseInt(quantity) || 1;
  const dCharge = parseFloat(delivery_charge) || 0;
  const discountVal = parseFloat(discount_applied) || 0;
  const totalAmount = Math.max(0, (basePrice * qty) + dCharge - discountVal);

  const variantText = variant ? ` [Variant: ${variant}]` : '';
  const discountText = discountVal > 0 ? ` | Discount: -৳${discountVal}` : '';
  const detailedAddress = `${address} | Area: ${delivery_area || 'N/A'} | Payment: ${payment_method || 'COD'}${trx_id ? ' (TrxID: ' + trx_id + ')' : ''} | Courier: ${courier_choice || 'SteadFast'}${discountText}`;

  try {
    let { error } = await supabase.from('orders').insert([{
      customer_name: (customer_name || 'Guest').trim(),
      phone: (phone || '').trim(),
      address: detailedAddress,
      product_title: `${product_title}${variantText} (x${qty})`,
      price: totalAmount,
      quantity: qty,
      status: 'Pending',
      created_at: new Date().toISOString()
    }]);

    if (error) {
      const fallback = await supabase.from('orders').insert([{
        customer_name: (customer_name || 'Guest').trim(),
        phone: (phone || '').trim(),
        address: detailedAddress,
        product_title: `${product_title}${variantText} (x${qty})`,
        price: totalAmount,
        quantity: qty
      }]);
      error = fallback.error;
    }

    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Order placed successfully!' });
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
    res.render('admin-dashboard', { products: products || [], orders: orders || [], settings, msg: req.query.msg || null });
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

// Add Product (Supports BOTH Direct File Upload AND Image URL!)
app.post('/admin/products/add', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { title, price, regular_price, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  try {
    let { error } = await supabase.from('products').insert([{
      title,
      price: parseFloat(price) || 0,
      regular_price: parseFloat(regular_price) || parseFloat(price) || 0,
      description,
      image: finalImage,
      variant_options: variant_options || '',
      created_at: new Date().toISOString()
    }]);

    if (error) {
      const fallback = await supabase.from('products').insert([{
        title,
        price: parseFloat(price) || 0,
        description,
        image: finalImage
      }]);
      error = fallback.error;
    }

    if (error) return res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Error: ' + error.message));
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Product added successfully!'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

// Edit Product (Supports Direct File Upload OR URL)
app.post('/admin/products/edit/:id', upload.single('image_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { id } = req.params;
  const { title, price, regular_price, description, image, variant_options } = req.body;

  let finalImage = (image || '').trim();
  if (req.file) {
    const uploadedUrl = await handleImageUpload(req.file);
    if (uploadedUrl) finalImage = uploadedUrl;
  }

  try {
    let { error } = await supabase.from('products').update({
      title,
      price: parseFloat(price) || 0,
      regular_price: parseFloat(regular_price) || parseFloat(price) || 0,
      description,
      image: finalImage,
      variant_options: variant_options || ''
    }).eq('id', id);

    if (error) {
      await supabase.from('products').update({
        title,
        price: parseFloat(price) || 0,
        description,
        image: finalImage
      }).eq('id', id);
    }

    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Product updated successfully!'));
  } catch (err) {
    res.redirect('/admin/dashboard');
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
  try {
    await supabase.from('orders').update({ status: req.body.status }).eq('id', req.params.id);
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Order status updated!'));
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

// Update Settings (Supports Direct Logo File Upload + Brand Name + FAQs + Policies!)
app.post('/admin/settings/update', upload.single('logo_file'), async (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.status(401).send('Unauthorized');
  const settingsData = { ...req.body };

  if (req.file) {
    const uploadedLogoUrl = await handleImageUpload(req.file);
    if (uploadedLogoUrl) {
      settingsData.logo_light = uploadedLogoUrl;
    }
  }

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    }
    res.redirect('/admin/dashboard?msg=' + encodeURIComponent('Brand, Logo, FAQ, Policies & Store Settings updated!'));
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

app.listen(PORT, () => {
  console.log(`TrendzzNow Master Server v13 running on port ${PORT}`);
});
