'use strict';
// First run data: settings, policy pages and clearly marked DEMO content so the shop
// looks alive on day one. Everything with demo:true is removed by one click in Admin.
const U = require('./util');
const { defaultSettings, DEFAULT_PAGES } = require('./defaults');

const DAY = 86400000;

function cartesian(options) {
  let combos = [[]];
  for (const o of options) combos = combos.flatMap((c) => o.values.map((v) => [...c, v]));
  return combos;
}

function makeVariants(options, stockFor) {
  return cartesian(options).map((c, i) => {
    const values = {};
    options.forEach((o, k) => (values[o.name] = c[k]));
    return { key: c.join('|'), label: c.join(' / '), values, stock: stockFor(c, i), price: null, sku: '' };
  });
}

const DEMO_NOTE = '\n\n**ডেমো পণ্য:** এটি শুধু সাইট কেমন দেখায় তা বোঝানোর জন্য। নিজের পণ্য যোগ করার আগে অ্যাডমিন প্যানেল থেকে ডেমো ডেটা মুছে ফেলুন।';

function buildInitial() {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();

  /* ---------- categories ---------- */
  const cats = [
    { id: 'cat-fashion', name: 'পোশাক', nameEn: 'Fashion', slug: 'fashion', image: '/demo/hoodie-1.jpg' },
    { id: 'cat-footwear', name: 'জুতা', nameEn: 'Footwear', slug: 'footwear', image: '/demo/sneaker-1.jpg' },
    { id: 'cat-bags', name: 'ব্যাগ', nameEn: 'Bags', slug: 'bags', image: '/demo/backpack-1.jpg' },
    { id: 'cat-accessories', name: 'এক্সেসরিজ', nameEn: 'Accessories', slug: 'accessories', image: '/demo/watch-1.jpg' },
    { id: 'cat-gadgets', name: 'গ্যাজেট', nameEn: 'Gadgets', slug: 'gadgets', image: '/demo/earbuds-2.jpg' },
  ].map((c, i) => ({ ...c, active: true, sort: i + 1, demo: true }));

  /* ---------- products ---------- */
  const size3 = { name: 'সাইজ', values: ['M', 'L', 'XL'] };
  const P = [];
  const add = (p) => {
    const variants = p.options && p.options.length ? makeVariants(p.options, p.stockFor) : [];
    P.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description + DEMO_NOTE,
      categoryId: p.cat,
      brand: p.brand,
      price: p.price,
      comparePrice: p.compare || 0,
      cost: Math.round(p.price * 0.58),
      sku: p.sku,
      stock: variants.length ? 0 : p.stock,
      images: p.images,
      options: p.options || [],
      variants,
      tags: p.tags || [],
      featured: !!p.featured,
      status: 'active',
      seoTitle: '',
      seoDesc: '',
      ratingAvg: 0,
      ratingCount: 0,
      sold: p.sold || 0,
      views: p.views || 0,
      demo: true,
      createdAt: iso(p.ageDays * DAY),
      updatedAt: iso(p.ageDays * DAY),
    });
  };

  add({
    id: 'dm-tee', slug: 'oversized-graphic-tee', name: 'ওভারসাইজড গ্রাফিক টি-শার্ট', cat: 'cat-fashion', brand: 'Trendzznow', price: 650, compare: 850, sku: 'TN-TEE-01', featured: true, tags: ['trending', 'tshirt'], sold: 41, views: 620, ageDays: 3,
    images: ['/demo/tee-1.jpg', '/demo/tee-2.jpg'],
    options: [size3, { name: 'রঙ', values: ['নেভি', 'অফ হোয়াইট'] }],
    stockFor: (c) => ({ 'M|নেভি': 8, 'L|নেভি': 12, 'XL|নেভি': 3, 'M|অফ হোয়াইট': 6, 'L|অফ হোয়াইট': 0, 'XL|অফ হোয়াইট': 5 }[c.join('|')] || 0),
    description: '## বিস্তারিত\n\nঅলিভার ফিটের নরম কটন টি-শার্ট। গরমে আরাম, প্রতিদিন পরার জন্য ঠিক।\n\n- নরম কটন কাপড়, ঘাম শুষে নেয়\n- ড্রপ শোল্ডার অলিভার ফিট\n- প্রিন্ট ধোয়ার পরেও ঠিক থাকে\n\n## সাইজ গাইড\n\nM: বুক ৪০ ইঞ্চি, L: বুক ৪২ ইঞ্চি, XL: বুক ৪৪ ইঞ্চি।',
  });
  add({
    id: 'dm-hoodie', slug: 'premium-cotton-hoodie', name: 'প্রিমিয়াম কটন হুডি', cat: 'cat-fashion', brand: 'Trendzznow', price: 1450, compare: 1890, sku: 'TN-HOOD-01', featured: true, tags: ['winter', 'trending'], sold: 28, views: 410, ageDays: 6,
    images: ['/demo/hoodie-1.jpg', '/demo/hoodie-2.jpg'],
    options: [size3],
    stockFor: (c) => ({ M: 10, L: 14, XL: 2 }[c[0]] || 0),
    description: '## বিস্তারিত\n\nশীতে আরামদায়ক, ভেতরে নরম ফ্লিস। সামনে বড় পকেট আর অ্যাডজাস্টেবল হুড।\n\n- ভারী ফ্লিস কাপড়\n- হুডের ড্রস্ট্রিং\n- ক্যাঙ্গারু পকেট',
  });
  add({
    id: 'dm-sneaker', slug: 'street-sneakers', name: 'স্ট্রিট স্নিকার্স', cat: 'cat-footwear', brand: 'StepUp', price: 2250, compare: 2800, sku: 'SU-SNK-01', featured: true, tags: ['shoes', 'trending'], sold: 19, views: 380, ageDays: 9,
    images: ['/demo/sneaker-1.jpg', '/demo/sneaker-2.jpg'],
    options: [{ name: 'সাইজ', values: ['40', '41', '42', '43', '44'] }],
    stockFor: (c) => ({ 40: 3, 41: 6, 42: 8, 43: 5, 44: 1 }[c[0]] || 0),
    description: '## বিস্তারিত\n\nহালকা ওজন, নরম সোল। অফিস, ভার্সিটি বা বাইরে ঘোরা, সব জায়গায় মানানসই।\n\n- হালকা ও আরামদায়ক সোল\n- শ্বাস নেওয়া যায় এমন আপার\n- স্লিপ রেজিস্ট্যান্ট আউটসোল',
  });
  add({
    id: 'dm-backpack', slug: 'canvas-backpack', name: 'ক্যানভাস ব্যাকপ্যাক', cat: 'cat-bags', brand: 'Trendzznow', price: 1190, compare: 1490, sku: 'TN-BAG-01', tags: ['bag', 'student'], stock: 18, sold: 33, views: 290, ageDays: 14,
    images: ['/demo/backpack-1.jpg', '/demo/backpack-2.jpg'],
    description: '## বিস্তারিত\n\n১৫ ইঞ্চি ল্যাপটপ আঁটে। ক্লাস, অফিস বা ট্রিপ, সবকিছুর জন্য।\n\n- পানি প্রতিরোধী কাপড়\n- ল্যাপটপের জন্য আলাদা পকেট\n- নরম স্ট্র্যাপ',
  });
  add({
    id: 'dm-sling', slug: 'mini-crossbody-bag', name: 'মিনি ক্রসবডি ব্যাগ', cat: 'cat-bags', brand: 'Trendzznow', price: 790, sku: 'TN-BAG-02', tags: ['bag'], stock: 4, sold: 12, views: 180, ageDays: 5,
    images: ['/demo/sling-1.jpg', '/demo/sling-2.jpg'],
    description: '## বিস্তারিত\n\nমোবাইল, ওয়ালেট আর চাবি, রোজকার দরকারি জিনিস রাখার ছোট ব্যাগ। কাঁধে বা গলায় ঝুলিয়ে নেওয়া যায়।',
  });
  add({
    id: 'dm-watch', slug: 'minimal-analog-watch', name: 'মিনিমাল অ্যানালগ ঘড়ি', cat: 'cat-accessories', brand: 'TimeLoop', price: 1650, compare: 2200, sku: 'TL-WCH-01', featured: true, tags: ['watch', 'gift'], stock: 9, sold: 22, views: 340, ageDays: 11,
    images: ['/demo/watch-1.jpg', '/demo/watch-2.jpg'],
    description: '## বিস্তারিত\n\nপরিষ্কার ডায়াল, নরম স্ট্র্যাপ। শার্ট বা টি-শার্ট, দুটোর সাথেই মানায়।\n\n- জাপানি মুভমেন্ট\n- স্ক্র্যাচ রেজিস্ট্যান্ট গ্লাস\n- ৩০ মিটার স্প্ল্যাশ প্রুফ',
  });
  add({
    id: 'dm-sunglasses', slug: 'uv400-sunglasses', name: 'UV400 সানগ্লাস', cat: 'cat-accessories', brand: 'Trendzznow', price: 450, sku: 'TN-SUN-01', tags: ['summer', 'trending'], stock: 30, sold: 36, views: 260, ageDays: 20,
    images: ['/demo/sunglasses-1.jpg', '/demo/sunglasses-2.jpg'],
    description: '## বিস্তারিত\n\nরোদে চোখের আরামের জন্য UV400 সুরক্ষা। হালকা ফ্রেম, সারাদিন পরলেও ভারী লাগে না।',
  });
  add({
    id: 'dm-earbuds', slug: 'wireless-earbuds', name: 'ওয়্যারলেস ইয়ারবাড', cat: 'cat-gadgets', brand: 'SoundNest', price: 1350, compare: 1790, sku: 'SN-EAR-01', featured: true, tags: ['gadget', 'trending'], stock: 15, sold: 47, views: 520, ageDays: 2,
    images: ['/demo/earbuds-1.jpg', '/demo/earbuds-2.jpg'],
    description: '## বিস্তারিত\n\nব্লুটুথ ৫.৩, কেস সহ মোট ২৪ ঘণ্টা ব্যাকআপ। কল ও গানে পরিষ্কার সাউন্ড।\n\n- টাচ কন্ট্রোল\n- দ্রুত পেয়ারিং\n- টাইপ সি চার্জিং',
  });
  add({
    id: 'dm-cap', slug: 'snapback-cap', name: 'স্ন্যাপব্যাক ক্যাপ', cat: 'cat-accessories', brand: 'Trendzznow', price: 390, sku: 'TN-CAP-01', tags: ['cap'], stock: 25, sold: 15, views: 150, ageDays: 18,
    images: ['/demo/cap-1.jpg', '/demo/cap-2.jpg'],
    description: '## বিস্তারিত\n\nঅ্যাডজাস্টেবল স্ন্যাপ, শক্ত ব্রিম। যেকোনো পোশাকের সাথে মানিয়ে যায়।',
  });
  add({
    id: 'dm-band', slug: 'smart-fitness-band', name: 'স্মার্ট ফিটনেস ব্যান্ড', cat: 'cat-gadgets', brand: 'FitPulse', price: 1550, compare: 1990, sku: 'FP-BND-01', tags: ['gadget', 'fitness'], stock: 0, sold: 26, views: 300, ageDays: 25,
    images: ['/demo/band-1.jpg', '/demo/band-2.jpg'],
    description: '## বিস্তারিত\n\nহার্ট রেট, ঘুম আর স্টেপ ট্র্যাকিং। ফোনের নোটিফিকেশনও হাতেই দেখা যায়।',
  });

  /* ---------- reviews ---------- */
  const R = [];
  const rv = (productId, name, rating, text, daysAgo, o = {}) =>
    R.push({ id: U.uid(5), productId, name, rating, text, photos: o.photos || [], verified: o.verified !== false, status: 'approved', createdAt: iso(daysAgo * DAY) });
  rv('dm-tee', 'রাহিম', 5, 'কাপড়টা অনেক নরম। ছবিতে যেমন দেখেছি ঠিক তেমনই এসেছে। L সাইজ নিয়েছি, ফিট একদম ঠিক।', 2, { photos: ['/demo/tee-2.jpg'] });
  rv('dm-tee', 'সুমাইয়া', 5, 'ভাইয়ার জন্য নিয়েছিলাম, খুব পছন্দ করেছে। ডেলিভারি দ্রুত পেয়েছি।', 5);
  rv('dm-tee', 'তানভীর', 4, 'প্রিন্ট সুন্দর। শুধু একটু লম্বা মনে হয়েছে, তবে অলিভার ফিটে এমনই হয়।', 9, { verified: false });
  rv('dm-hoodie', 'নুসরাত', 5, 'শীতের জন্য পারফেক্ট। ভেতরটা নরম, গরম আছে। রঙও ছবির মতোই।', 4);
  rv('dm-hoodie', 'ফাহিম', 5, 'দামের তুলনায় অনেক ভালো। বন্ধুদের জন্য আরও দুইটা অর্ডার করব।', 8);
  rv('dm-sneaker', 'মেহেদী', 5, 'হালকা আর আরামদায়ক। সারাদিন হেঁটেও পায়ে ব্যথা হয়নি।', 3, { photos: ['/demo/sneaker-1.jpg'] });
  rv('dm-sneaker', 'আরিফ', 4, 'ভালো জুতা। সাইজ একটু টাইট, তাই এক সাইজ বড় নিন।', 7);
  rv('dm-backpack', 'জান্নাত', 5, 'ল্যাপটপ আর বই সব ধরে। ক্লাসের জন্য দারুণ।', 6);
  rv('dm-backpack', 'শাওন', 4, 'ব্যাগ ভালো। চেইন আরেকটু শক্ত হলে ভালো হতো।', 12);
  rv('dm-watch', 'ইফফাত', 5, 'গিফট দিয়েছিলাম, সবাই প্রশংসা করেছে। ডায়াল পরিষ্কার।', 10);
  rv('dm-earbuds', 'সাদমান', 5, 'সাউন্ড কোয়ালিটি দামের তুলনায় অনেক ভালো। ব্যাটারি ভালো টিকে।', 1);
  rv('dm-earbuds', 'রিয়া', 4, 'কানে ভালো লাগে। কলে মাইক ঠিকঠাক কাজ করে।', 4);
  rv('dm-earbuds', 'নাঈম', 5, 'জিমে ব্যবহার করি, ঘামেও সমস্যা হয়নি।', 6);
  rv('dm-sunglasses', 'অনিক', 5, 'রোদে চোখে আরাম পাই। এই দামে ভালো।', 11);
  P.forEach((p) => {
    const rs = R.filter((r) => r.productId === p.id);
    p.ratingCount = rs.length;
    p.ratingAvg = rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : 0;
  });

  /* ---------- banners ---------- */
  const banners = [
    { id: 'bn-a', title: 'নতুন কালেকশন এসে গেছে', subtitle: 'প্রতিদিনের স্টাইল, সারা বাংলাদেশে ক্যাশ অন ডেলিভারি', buttonText: 'এখনই কিনুন', link: '/shop?sort=new', image: '/demo/banner-a.jpg', mobileImage: '/demo/banner-a-m.jpg', textTheme: 'light', align: 'left' },
    { id: 'bn-b', title: 'গ্যাজেট সেল', subtitle: 'ইয়ারবাড, ঘড়ি আর ব্যান্ডে বিশেষ ছাড়', buttonText: 'অফার দেখুন', link: '/c/gadgets', image: '/demo/banner-b.jpg', mobileImage: '/demo/banner-b-m.jpg', textTheme: 'light', align: 'left' },
    { id: 'bn-c', title: 'ব্যাগ আর এক্সেসরিজ', subtitle: 'রোজকার দরকারি সবকিছু এক জায়গায়', buttonText: 'দেখে আসুন', link: '/c/bags', image: '/demo/banner-c.jpg', mobileImage: '/demo/banner-c-m.jpg', textTheme: 'dark', align: 'left' },
  ].map((b, i) => ({ ...b, showText: true, active: true, sort: i + 1, demo: true }));

  /* ---------- coupons ---------- */
  const coupons = [
    { id: 'cp-welcome', code: 'WELCOME10', type: 'percent', value: 10, minOrder: 1000, maxDiscount: 300, usageLimit: 0, startsAt: '', endsAt: '', active: true, used: 0, demo: true, createdAt: iso(10 * DAY) },
    { id: 'cp-ship', code: 'FREESHIP', type: 'freeship', value: 0, minOrder: 1500, maxDiscount: 0, usageLimit: 0, startsAt: '', endsAt: '', active: true, used: 0, demo: true, createdAt: iso(10 * DAY) },
  ];

  /* ---------- demo orders (for the admin dashboard) ---------- */
  const prod = (id) => P.find((p) => p.id === id);
  let seq = 9000;
  const orders = [];
  const mk = (daysAgo, hoursAgo, who, district, lines, status, source, method) => {
    const items = lines.map(([pid, vk, qty]) => {
      const p = prod(pid);
      const v = p.variants.find((x) => x.key === vk);
      return { productId: pid, slug: p.slug, name: p.name, image: p.images[0], variantKey: vk || '', variantLabel: v ? v.label : '', unitPrice: p.price, cost: p.cost, qty };
    });
    const subtotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
    const shipping = district === 'Dhaka' ? 70 : 130;
    const t = daysAgo * DAY + hoursAgo * 3600000;
    const history = [{ status: 'pending', at: iso(t), note: '' }];
    const flow = ['confirmed', 'processing', 'shipped', 'delivered'];
    const idx = flow.indexOf(status);
    if (status === 'cancelled') history.push({ status: 'cancelled', at: iso(t - 3600000), note: 'কাস্টমার ফোন ধরেননি' });
    else for (let i = 0; i <= idx; i++) history.push({ status: flow[i], at: iso(t - (i + 1) * 5 * 3600000), note: '' });
    const number = `TN${++seq}`;
    orders.push({
      id: U.uid(6), number, sig: `demo-${number}`, items,
      customer: { name: who[0], phone: who[1], email: '', division: who[2], district, area: '', address: who[3], note: '' },
      subtotal, discount: 0, couponCode: '', shipping, total: subtotal + shipping,
      payment: { method, status: status === 'delivered' ? 'paid' : method === 'cod' ? 'unpaid' : 'pending_verification', trxId: method === 'cod' ? '' : 'DEMO' + U.uid(3).toUpperCase(), senderNumber: '' },
      status, timeline: history, courier: status === 'shipped' || status === 'delivered' ? { name: 'Pathao', trackingId: 'DEMO' + seq, url: '' } : { name: '', trackingId: '', url: '' },
      source: { label: source, utm_source: source, utm_medium: '', utm_campaign: '', utm_content: '', referrer: '', landing: '', channel: 'web' },
      showInLive: false, adminNote: '', stockApplied: status !== 'cancelled', demo: true, createdAt: iso(t), updatedAt: iso(t),
    });
  };
  mk(0, 3, ['রাহিম আহমেদ', '01711000001', 'Dhaka', 'মিরপুর ১০, ঢাকা'], 'Dhaka', [['dm-tee', 'L|নেভি', 2], ['dm-sunglasses', '', 1]], 'pending', 'facebook', 'cod');
  mk(1, 5, ['সুমাইয়া ইসলাম', '01811000002', 'Chattogram', 'আগ্রাবাদ, চট্টগ্রাম'], 'Chattogram', [['dm-earbuds', '', 1]], 'confirmed', 'instagram', 'bkash');
  mk(2, 2, ['তানভীর হাসান', '01911000003', 'Dhaka', 'ধানমন্ডি ২৭, ঢাকা'], 'Dhaka', [['dm-hoodie', 'L', 1], ['dm-cap', '', 1]], 'shipped', 'tiktok', 'cod');
  mk(3, 6, ['নুসরাত জাহান', '01511000004', 'Sylhet', 'জিন্দাবাজার, সিলেট'], 'Sylhet', [['dm-watch', '', 1]], 'delivered', 'facebook', 'nagad');
  mk(4, 4, ['ফাহিম রহমান', '01611000005', 'Dhaka', 'উত্তরা সেক্টর ৭, ঢাকা'], 'Dhaka', [['dm-sneaker', '42', 1]], 'delivered', 'facebook', 'cod');
  mk(6, 1, ['মেহেদী হাসান', '01311000006', 'Rajshahi', 'সাহেব বাজার, রাজশাহী'], 'Rajshahi', [['dm-backpack', '', 1], ['dm-cap', '', 2]], 'delivered', 'whatsapp', 'cod');
  mk(8, 7, ['জান্নাত ফেরদৌস', '01711000007', 'Khulna', 'সোনাডাঙ্গা, খুলনা'], 'Khulna', [['dm-sling', '', 1]], 'cancelled', 'tiktok', 'cod');
  mk(10, 3, ['আরিফ হোসেন', '01911000008', 'Dhaka', 'মোহাম্মদপুর, ঢাকা'], 'Dhaka', [['dm-tee', 'M|অফ হোয়াইট', 1], ['dm-hoodie', 'M', 1]], 'delivered', 'direct', 'cod');
  mk(12, 5, ['ইফফাত আরা', '01811000009', 'Dhaka', 'বনানী, ঢাকা'], 'Dhaka', [['dm-watch', '', 1], ['dm-sunglasses', '', 1]], 'delivered', 'instagram', 'bkash');

  const pages = DEFAULT_PAGES.map((p) => ({ ...p, updatedAt: new Date().toISOString() }));

  return {
    meta: { seq: { order: 10000 }, demo: true, createdAt: new Date().toISOString() },
    settings: defaultSettings(),
    categories: cats,
    products: P,
    banners,
    coupons,
    reviews: R,
    orders,
    pages,
    messages: [],
    admin: {},
    sessions: {},
    pushSubs: [],
    push: {},
    blocked: { phones: [] },
  };
}

module.exports = { buildInitial };
