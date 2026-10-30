'use strict';
// Default settings and policy pages. Everything here can be edited from the admin panel.

const FONTS = {
  'Baloo Da 2': 'Baloo+Da+2:wght@500;600;700;800',
  'Hind Siliguri': 'Hind+Siliguri:wght@400;500;600;700',
  'Anek Bangla': 'Anek+Bangla:wght@400;500;600;700;800',
  'Noto Sans Bengali': 'Noto+Sans+Bengali:wght@400;500;600;700;800',
  'Mukta': 'Mukta:wght@400;500;600;700;800',
  'Noto Serif Bengali': 'Noto+Serif+Bengali:wght@400;500;600;700;800',
  'Tiro Bangla': 'Tiro+Bangla',
  'Poppins': 'Poppins:wght@400;500;600;700;800',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
};

// these two ship inside /public/fonts, so the shop looks right even offline
const SELF_FONTS = new Set(['Baloo Da 2', 'Hind Siliguri']);

function defaultSettings() {
  return {
    siteName: 'Trendzznow',
    tagline: { bn: 'ট্রেন্ডে থাকুন, স্টাইলে থাকুন', en: 'Stay on trend. Stay in style.' },
    siteUrl: '',
    orderPrefix: 'TN',
    defaultLang: 'bn',
    defaultTheme: 'system',
    brand: {
      primary: '#D6155B',
      accent: '#FFB400',
      ink: '#1F1B5C',
      headingFont: 'Baloo Da 2',
      bodyFont: 'Hind Siliguri',
      radius: 'soft',
      cardRatio: '1 / 1',
    },
    logo: '',
    logoDark: '',
    appIcon512: '',
    appIcon192: '',
    contact: {
      phone: '01731763504',
      whatsapp: '01731763504',
      messenger: '',
      email: '',
      address: { bn: 'ঢাকা, বাংলাদেশ', en: 'Dhaka, Bangladesh' },
      hours: { bn: 'প্রতিদিন সকাল ১০টা থেকে রাত ১০টা', en: 'Every day, 10 AM to 10 PM' },
    },
    social: { facebook: '', instagram: '', tiktok: '', youtube: '' },
    announcement: {
      enabled: true,
      text: {
        bn: 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। পণ্য হাতে পেয়ে দাম দিন।',
        en: 'Cash on delivery all over Bangladesh. Pay when you receive.',
      },
      link: '',
    },
    shipping: {
      insideFee: 70,
      outsideFee: 130,
      freeAbove: 3000,
      insideDistricts: ['Dhaka'],
      etaInside: { bn: 'ঢাকার ভেতরে ১ থেকে ৩ কর্মদিবস', en: 'Inside Dhaka: 1 to 3 working days' },
      etaOutside: { bn: 'ঢাকার বাইরে ৩ থেকে ৫ কর্মদিবস', en: 'Outside Dhaka: 3 to 5 working days' },
    },
    payments: {
      cod: { enabled: true },
      bkash: { enabled: true, number: '01731763504', kind: 'personal' },
      nagad: { enabled: true, number: '01731763504', kind: 'personal' },
      rocket: { enabled: false, number: '', kind: 'personal' },
    },
    badges: {
      payment: [
        { id: 'bkash', label: 'bKash', image: '', enabled: true },
        { id: 'nagad', label: 'Nagad', image: '', enabled: true },
        { id: 'rocket', label: 'Rocket', image: '', enabled: false },
        { id: 'cod', label: 'Cash on delivery', image: '', enabled: true },
      ],
      courier: [
        { id: 'pathao', label: 'Pathao', image: '', enabled: true },
        { id: 'steadfast', label: 'Steadfast', image: '', enabled: true },
        { id: 'redx', label: 'RedX', image: '', enabled: false },
        { id: 'paperfly', label: 'Paperfly', image: '', enabled: false },
      ],
    },
    marketing: {
      fbPixelId: '',
      tiktokPixelId: '',
      ga4Id: '',
      liveNotices: true,
      showViewers: true,
      lowStockThreshold: 5,
      chatButton: true,
    },
    reviews: { autoApprove: false },
    policies: { minOrder: 0, maxOrdersPerPhonePerDay: 5 },
    legal: { tradeLicense: '', bin: '' },
  };
}

const DEFAULT_PAGES = [
  {
    slug: 'about',
    title: 'আমাদের সম্পর্কে',
    titleEn: 'About us',
    body: `## আমরা কারা

**{siteName}** একটি অনলাইন স্টোর। আমরা নিজেদের বাছাই করা পণ্য সরাসরি আপনার কাছে পৌঁছে দিই, মাঝখানে কোনো অতিরিক্ত হাত নেই। তাই দামও থাকে ন্যায্য।

## আমরা যা কথা দিই

- পণ্যের ছবি আর বিবরণ যেমন, পণ্যও তেমন
- অর্ডার কনফার্ম হলে দ্রুত কুরিয়ারে পাঠানো
- ক্যাশ অন ডেলিভারি, মানে হাতে পেয়ে দাম দেওয়া
- সমস্যা হলে সহজ রিটার্ন ও রিফান্ড

## আমাদের সাথে কথা বলুন

কোনো পণ্য নিয়ে প্রশ্ন থাকলে WhatsApp বা ফোনে জানান: **{phone}**। আমরা সাধারণত কয়েক মিনিটের মধ্যেই উত্তর দিই।`,
    bodyEn: `## Who we are

**{siteName}** is an online store. We pick our products carefully and send them straight to you, so prices stay fair.

## What we promise

- Photos and descriptions match the product you receive
- Fast courier dispatch once your order is confirmed
- Cash on delivery, so you pay after you receive
- Easy returns and refunds if something is wrong

## Talk to us

Questions about a product? Message us on WhatsApp or call **{phone}**. We usually reply within minutes.`,
  },
  {
    slug: 'contact',
    title: 'যোগাযোগ',
    titleEn: 'Contact us',
    body: `## আমাদের ঠিকানা ও যোগাযোগ

- ফোন ও WhatsApp: **{phone}**
- ইমেইল: {email}
- ঠিকানা: {address}
- সময়: {hours}

নিচের ফর্মে মেসেজ পাঠালে আমরা ফোনে বা WhatsApp এ উত্তর দেব।`,
    bodyEn: `## Find us

- Phone and WhatsApp: **{phone}**
- Email: {email}
- Address: {address}
- Hours: {hours}

Send us a message with the form below and we will reply by phone or WhatsApp.`,
  },
  {
    slug: 'delivery-policy',
    title: 'ডেলিভারি নীতি',
    titleEn: 'Delivery policy',
    body: `## ডেলিভারি সময়

- ঢাকার ভেতরে: ১ থেকে ৩ কর্মদিবস
- ঢাকার বাইরে: ৩ থেকে ৫ কর্মদিবস

প্রাকৃতিক দুর্যোগ, হরতাল বা কুরিয়ারের সমস্যায় দেরি হতে পারে। তবে সব ক্ষেত্রেই আমরা ১০ দিনের মধ্যে ডেলিভারি দেওয়ার চেষ্টা করি।

## ডেলিভারি চার্জ

- ঢাকার ভেতরে ৳{insideFee}
- ঢাকার বাইরে ৳{outsideFee}
- ৳{freeAbove} বা এর বেশি টাকার অর্ডারে ডেলিভারি ফ্রি

## পেমেন্ট

- ক্যাশ অন ডেলিভারি: পণ্য হাতে পেয়ে কুরিয়ারকে টাকা দিন
- bKash, Nagad বা Rocket: আগে টাকা পাঠিয়ে Transaction ID দিন, আমরা যাচাই করে অর্ডার কনফার্ম করব

## পণ্য হাতে পেলে

কুরিয়ার ম্যানের সামনে প্যাকেট খুলে পণ্য দেখে নেওয়া ভালো। কোনো সমস্যা থাকলে সাথে সাথে আমাদের জানান।`,
    bodyEn: `## Delivery time

- Inside Dhaka: 1 to 3 working days
- Outside Dhaka: 3 to 5 working days

Floods, strikes or courier problems can cause delays. We always try to deliver within 10 days.

## Delivery charge

- Inside Dhaka: ৳{insideFee}
- Outside Dhaka: ৳{outsideFee}
- Free delivery on orders of ৳{freeAbove} or more

## Payment

- Cash on delivery: pay the courier when you receive the parcel
- bKash, Nagad or Rocket: send the money first and enter the Transaction ID. We verify it and confirm your order

## When it arrives

Please open the parcel in front of the courier and check the product. If anything is wrong, tell us right away.`,
  },
  {
    slug: 'return-policy',
    title: 'রিটার্ন ও রিফান্ড নীতি',
    titleEn: 'Return and refund policy',
    body: `## কখন রিটার্ন করা যাবে

- ভুল পণ্য এসেছে
- পণ্য ভাঙা বা নষ্ট অবস্থায় এসেছে
- পণ্যের ছবি বা বিবরণের সাথে মিল নেই

পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে আমাদের জানাতে হবে। পণ্য ব্যবহার না করা এবং আসল প্যাকেটে থাকতে হবে।

## কীভাবে জানাবেন

WhatsApp এ **{phone}** নম্বরে অর্ডার নম্বর আর পণ্যের ছবি পাঠান। আমরা যাচাই করে দ্রুত জানাব।

## রিফান্ড

রিটার্ন পণ্য আমাদের হাতে পৌঁছানোর পর ৭ কর্মদিবসের মধ্যে bKash বা Nagad এ টাকা ফেরত দেওয়া হয়। আমাদের ভুলে সমস্যা হলে রিটার্নের কুরিয়ার খরচ আমরা বহন করি।

## যেসব পণ্য ফেরত নেওয়া যায় না

ব্যবহার করা পণ্য, অন্তর্বাস, এবং বিউটি পণ্য যার সিল খোলা হয়েছে।`,
    bodyEn: `## When you can return

- You received the wrong product
- The product arrived broken or damaged
- The product does not match the photos or description

Tell us within 7 days of receiving it. The product must be unused and in its original packaging.

## How to tell us

Send the order number and photos of the product to **{phone}** on WhatsApp. We check and reply quickly.

## Refund

After the returned product reaches us, we refund to your bKash or Nagad within 7 working days. If the problem was our mistake, we pay the return courier cost.

## What we cannot take back

Used products, innerwear, and beauty products whose seal has been opened.`,
  },
  {
    slug: 'privacy',
    title: 'গোপনীয়তা নীতি',
    titleEn: 'Privacy policy',
    body: `## আমরা কী তথ্য নিই

অর্ডারের জন্য আপনার নাম, ফোন নম্বর, ঠিকানা এবং ইমেইল (যদি দেন)। এর বাইরে কিছু নিই না।

## কীভাবে ব্যবহার করি

শুধু আপনার অর্ডার প্রসেস করতে, ডেলিভারি দিতে এবং অর্ডার নিয়ে যোগাযোগ করতে। ডেলিভারির জন্য কুরিয়ার কোম্পানির সাথে আপনার নাম, ফোন ও ঠিকানা শেয়ার করা হয়।

## লাইভ অর্ডার নোটিশ

আপনি সম্মতি দিলে সাম্প্রতিক অর্ডার নোটিশে আপনার শুধু প্রথম নাম ও জেলা দেখানো হয়। ফোন নম্বর বা ঠিকানা কখনো দেখানো হয় না।

## মার্কেটিং ট্র্যাকিং

বিজ্ঞাপনের ফলাফল বোঝার জন্য আমরা Facebook Pixel এর মতো টুল ব্যবহার করতে পারি।

## আপনার অধিকার

আপনার তথ্য মুছে ফেলতে চাইলে **{phone}** নম্বরে জানান।`,
    bodyEn: `## What we collect

Your name, phone number, address and email (if you give it) for your order. Nothing else.

## How we use it

Only to process your order, deliver it and contact you about it. We share your name, phone and address with the courier company for delivery.

## Live order notices

If you agree, recent order notices show only your first name and district. Your phone number or address is never shown.

## Marketing tracking

We may use tools like Facebook Pixel to understand how our ads perform.

## Your rights

To have your data deleted, contact us at **{phone}**.`,
  },
  {
    slug: 'terms',
    title: 'শর্তাবলী',
    titleEn: 'Terms and conditions',
    body: `## সাধারণ শর্ত

- এই ওয়েবসাইটে অর্ডার করলে আপনি এই শর্তগুলো মেনে নিচ্ছেন
- পণ্যের দাম ও স্টক যেকোনো সময় বদলাতে পারে। অর্ডার কনফার্ম হওয়ার সময়ের দামই চূড়ান্ত
- স্টক শেষ হয়ে গেলে বা ঠিকানা সঠিক না হলে আমরা অর্ডার বাতিল করতে পারি এবং আপনাকে জানাব

## অর্ডার কনফার্মেশন

অর্ডারের পর আমরা ফোন বা WhatsApp এ কনফার্ম করতে পারি। ফোন ধরা না হলে অর্ডার দেরিতে প্রসেস হতে পারে।

## পেমেন্ট

bKash, Nagad বা Rocket এ আগে পেমেন্ট করলে সঠিক Transaction ID দিতে হবে। ভুল ID দিলে অর্ডার কনফার্ম হবে না।

## রিটার্ন ও রিফান্ড

রিটার্ন ও রিফান্ড নীতি পেজে বিস্তারিত দেওয়া আছে।

## লেনদেনের রেকর্ড

সব অর্ডার ও লেনদেনের তথ্য আমরা আইন অনুযায়ী সংরক্ষণ করি।`,
    bodyEn: `## General

- By placing an order on this website you accept these terms
- Prices and stock can change at any time. The price at the time your order is confirmed is final
- If stock runs out or the address is not correct, we may cancel the order and we will tell you

## Order confirmation

After you order we may confirm by phone or WhatsApp. If we cannot reach you, processing may be delayed.

## Payment

If you pay first by bKash, Nagad or Rocket, you must give the correct Transaction ID. Orders with a wrong ID cannot be confirmed.

## Returns and refunds

See the return and refund policy page for details.

## Records

We keep order and transaction records as required by law.`,
  },
  {
    slug: 'faq',
    title: 'সাধারণ প্রশ্ন',
    titleEn: 'FAQ',
    body: `## অর্ডার করলে কখন ফোন আসবে?

সাধারণত ১ ঘণ্টার মধ্যে আমাদের টিম কনফার্মেশনের জন্য ফোন বা WhatsApp করে।

## ক্যাশ অন ডেলিভারি আছে?

হ্যাঁ, সারা বাংলাদেশে।

## অর্ডার কোথায় পৌঁছাল দেখব কীভাবে?

ওয়েবসাইটের "অর্ডার ট্র্যাক" পেজে অর্ডার নম্বর আর ফোন নম্বর দিন।

## সাইজ বা রঙ বদলাতে চাইলে?

অর্ডার শিপ হওয়ার আগে **{phone}** নম্বরে জানান, আমরা বদলে দেব।`,
    bodyEn: `## When will you call after I order?

Usually within an hour our team calls or messages you on WhatsApp to confirm.

## Is cash on delivery available?

Yes, all over Bangladesh.

## How do I see where my order is?

Open the Track order page and enter your order number and phone number.

## Can I change the size or colour?

Tell us on **{phone}** before the order ships and we will change it.`,
  },
];

module.exports = { FONTS, SELF_FONTS, defaultSettings, DEFAULT_PAGES };
