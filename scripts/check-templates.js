'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A small EJS smoke renderer for this project's supported EJS tags. It keeps
// `npm test` dependency-light while still compiling and rendering real templates.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function renderEjs(source, locals, filename) {
  const tokens = source.split(/(<%[\s\S]*?%>)/g);
  let code = "let __out = ''; with (locals) {\n";
  for (const token of tokens) {
    if (token.startsWith('<%') && token.endsWith('%>')) {
      const body = token.slice(2, -2).trim();
      if (body.startsWith('=')) code += `__out += escapeHtml(${body.slice(1)});\n`;
      else if (body.startsWith('-')) code += `__out += String(${body.slice(1)} ?? '');\n`;
      else if (body.startsWith('#')) continue;
      else code += `${body}\n`;
    } else if (token) {
      code += `__out += ${JSON.stringify(token)};\n`;
    }
  }
  code += '} return __out;';
  try {
    return new Function('locals', 'escapeHtml', code)(locals, escapeHtml);
  } catch (error) {
    error.message = `${filename}: ${error.message}`;
    throw error;
  }
}

const root = path.join(__dirname, '..');
const viewsDir = path.join(root, 'views');
const settings = {
  brand_name_first: 'Trendzz', brand_name_second: 'Now', site_title: 'TrendzzNow',
  tagline_en: 'Stay on trend', whatsapp_number: '01700000000', facebook_url: '',
  instagram_url: '', tiktok_url: '', youtube_url: '', delivery_inside_dhaka: '70',
  delivery_outside_dhaka: '130', promo_code: '', promo_discount: '0',
  faq_1_q: 'Q1', faq_1_a: 'A1', faq_2_q: 'Q2', faq_2_a: 'A2',
  faq_3_q: 'Q3', faq_3_a: 'A3', faq_4_q: 'Q4', faq_4_a: 'A4',
  privacy_policy: 'privacy', return_policy: 'returns', terms_conditions: 'terms',
  hero_title_en: 'Title', hero_subtitle_en: 'Subtitle', hero_badge_text: 'Badge',
  hero_featured_title: 'Featured', hero_featured_price: '৳500', hero_featured_link: '#products',
  hero_image: '', logo_light: '', banner_text: 'banner', low_stock_threshold: '5',
  courier_partners: 'SteadFast,Pathao,RedX', ai_enabled: 'false',
  ai_welcome_message: 'Welcome', ai_handoff_message: 'Handoff'
};
const products = [{
  id: 1, title: 'Test lamp', name: 'Test lamp', category: 'Home', price: 950,
  regular_price: 1250, cost_price: 600, stock_quantity: 10, stock_known: true,
  image: '', variant_options: 'Black', description: 'Demo', sku: 'TEST-1',
  low_stock_threshold: 5, is_active: true, created_at: new Date().toISOString()
}];
const orders = [{
  id: 1, customer_name: 'Demo Customer', phone: '01700000000', address: 'Dhaka',
  product_title: 'Test lamp', price: 1020, status: 'Pending', consignment_id: '',
  admin_notes: '', created_at: new Date().toISOString()
}];
const analytics = {
  totalRevenue: 1020, deliveredRevenue: 0, pendingCount: 1, confirmedCount: 0,
  deliveredCount: 0, returnCount: 0, totalOrders: 1, totalCustomers: 1,
  totalProducts: 1, totalInventoryCost: 600, lowStockCount: 0, outOfStockCount: 0,
  last7Orders: 1, last30Orders: 1,
  dailySales: [{ date: '2026-11-18', amount: 0, count: 0 }], statusCounts: { Pending: 1 }
};
const locals = {
  settings, products, orders, analytics, categories: ['Home'],
  customers: [{ phone: '01700000000', name: 'Demo Customer', email: '', orderCount: 1, totalSpend: 1020, lastOrderAt: new Date().toISOString() }],
  inventoryMovements: [], auditLogs: [], lowStockProducts: [], msg: null,
  csrfToken: 'csrf-test', assistantConfigured: false, assistantEnabled: false,
  error: null, product: products[0], relatedProducts: []
};

const templateFiles = fs.readdirSync(viewsDir).filter(file => file.endsWith('.ejs')).sort();
if (!templateFiles.length) throw new Error('No EJS templates found.');
const rendered = {};
for (const file of templateFiles) {
  const source = fs.readFileSync(path.join(viewsDir, file), 'utf8');
  rendered[file] = renderEjs(source, locals, file);
  process.stdout.write(`Template smoke test OK: ${file}\n`);
}

// Also smoke-render optional AI widget branches, then syntax-check inline scripts.
for (const [file, extra] of [
  ['index.ejs', { assistantEnabled: true }],
  ['product-detail.ejs', { assistantEnabled: true }]
]) {
  const source = fs.readFileSync(path.join(viewsDir, file), 'utf8');
  const output = renderEjs(source, { ...locals, ...extra }, file + ' (AI enabled)');
  if (!output.includes('tnAssistant')) throw new Error(`AI assistant markup missing from ${file} when enabled.`);
  rendered[file + '.ai'] = output;
  process.stdout.write(`Optional AI template branch OK: ${file}\n`);
}

for (const [file, html] of Object.entries(rendered)) {
  if (!['index.ejs', 'product-detail.ejs', 'admin-dashboard.ejs', 'index.ejs.ai', 'product-detail.ejs.ai'].includes(file)) continue;
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match; let scriptIndex = 0;
  while ((match = scriptPattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    try { new vm.Script(source, { filename: `${file}.inline-${++scriptIndex}.js` }); }
    catch (error) { throw new Error(`Inline script syntax error in ${file}: ${error.message}`); }
  }
}

const storefrontSource = fs.readFileSync(path.join(viewsDir, 'index.ejs'), 'utf8');
const faqMarkers = (storefrontSource.match(/FAQ Section/gi) || []).length;
if (faqMarkers !== 1) throw new Error(`Expected exactly one FAQ section marker; found ${faqMarkers}.`);
if (/secret-admin-panel-2026/.test(rendered['index.ejs'] || '')) {
  throw new Error('Customer storefront output must not expose the admin route.');
}

const sql = fs.readFileSync(path.join(root, 'database', 'supabase-setup.sql'), 'utf8');
if (/\b(drop|truncate)\s+(table|schema|database)\b/i.test(sql)) {
  throw new Error('Database migration contains a destructive DROP/TRUNCATE statement.');
}
for (const functionName of [
  'trendzznow_reserve_order_stock',
  'trendzznow_update_order_status',
  'trendzznow_delete_order_restore_stock'
]) {
  if (!sql.includes(`function public.${functionName}`)) throw new Error(`Missing database function: ${functionName}`);
}
process.stdout.write('Project safety checks OK: one FAQ, hidden admin route, additive SQL and stock RPC functions.\n');
