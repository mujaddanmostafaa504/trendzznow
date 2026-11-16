const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_KEY is missing in environment variables!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'trendzznow_super_secure_key_2026',
  resave: false,
  saveUninitialized: true
}));

// Helper function to fetch settings
async function getSettings() {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error || !data) return {};
    const settings = {};
    data.forEach(item => {
      settings[item.key] = item.value;
    });
    return settings;
  } catch (err) {
    return {};
  }
}

// Frontend Home Route
app.get('/', async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) console.error('Supabase products fetch error:', error.message);
    
    const settings = await getSettings();
    res.render('index', { products: products || [], settings });
  } catch (err) {
    console.error('Home route error:', err);
    res.render('index', { products: [], settings: {} });
  }
});

// Checkout / Order placement Route
app.post('/order/place', async (req, res) => {
  const { customer_name, phone, address, product_title, price, quantity } = req.body;
  try {
    const { error } = await supabase.from('orders').insert([{
      customer_name,
      phone,
      address,
      product_title,
      price: parseFloat(price) || 0,
      quantity: parseInt(quantity) || 1,
      status: 'Pending',
      created_at: new Date().toISOString()
    }]);

    if (error) {
      console.error('Order insert error:', error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
    res.json({ success: true, message: 'Order placed successfully!' });
  } catch (err) {
    console.error('Order exception:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Login Routes
app.get('/admin', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin-login', { error: 'ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// Admin Dashboard Route
app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin');
  }
  try {
    const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const settings = await getSettings();

    res.render('admin-dashboard', { 
      products: products || [], 
      orders: orders || [], 
      settings 
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('admin-dashboard', { products: [], orders: [], settings: {} });
  }
});

// Add Product Route
app.post('/admin/products/add', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { title, price, description, image } = req.body;
  try {
    const { error } = await supabase.from('products').insert([{
      title,
      price: parseFloat(price) || 0,
      description,
      image,
      created_at: new Date().toISOString()
    }]);
    if (error) console.error('Product add error:', error.message);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Product add exception:', err);
    res.redirect('/admin/dashboard');
  }
});

// Delete Product Route
app.post('/admin/products/delete/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  const { id } = req.params;
  try {
    await supabase.from('products').delete().eq('id', id);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Delete error:', err);
    res.redirect('/admin/dashboard');
  }
});

// Update Settings Route
app.post('/admin/settings/update', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  const settingsData = req.body;
  try {
    for (const [key, value] of Object.entries(settingsData)) {
      // Upsert into settings table
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    }
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Settings update error:', err);
    res.redirect('/admin/dashboard');
  }
});

app.listen(PORT, () => {
  console.log(`TrendzzNow server running on port ${PORT}`);
});
