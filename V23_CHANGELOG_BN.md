# TrendzzNow V23.1 — Storefront ও Admin Update

এই update-টি আগের TrendzzNow Express/EJS/Supabase project-এর ওপর তৈরি। আলাদা website নয়; একই codebase, একই database এবং একই hidden admin route বজায় রাখা হয়েছে।

## Customer storefront

- Product card layout responsive করা হয়েছে; mobile, tablet ও desktop width অনুযায়ী grid বদলায়।
- Category filter, search এবং price/name sorting একসঙ্গে কাজ করে।
- Product sharing ও copy-link control রাখা হয়েছে।
- Fake rating/viewer count দেখানো হয় না।
- Draft/inactive product storefront ও direct order API—দুই জায়গাতেই block করা হয়।
- আগের একটি FAQ section-ই রাখা হয়েছে; নতুন FAQ section যোগ করা হয়নি।
- Delivery/courier/payment/support তথ্য footer অংশে রাখা হয়েছে।
- Optional AI assistant শুধু তখনই দেখায়, যখন Render-এ OPENAI_API_KEY ও OPENAI_MODEL আছে এবং Admin setting-এ assistant enable করা হয়েছে।

## Admin workspace

- আলাদা sidebar view: Overview, Orders, Products & Stock, Categories, Customers, Analytics, Stock & Audit History, Storefront & Policies, Security।
- Product add/edit form-এ SKU, selling/regular/cost price, stock, low-stock threshold, variants, image এবং publish/draft state আছে।
- Product search, category filter, sorting, bulk publish/unpublish, bulk stock update, category change, bulk delete, CSV import/export।
- Manual stock adjustment ও movement history।
- Category add/rename/reassign।
- Existing order records থেকে customer summary; আলাদা customer table বানানো হয়নি।
- Delivered revenue, open order value, inventory value, recent order summary ও low-stock summary।
- Product/order/settings actions-এর admin audit log।
- Admin form-এ session-bound CSRF protection; logout-ও POST + CSRF।
- Admin pages no-store/noindex response headers পায়।
- Admin order table-এ dispatch/delivery/return হওয়া record delete করা যায় না।

## Inventory and order safeguards

- Stock `0` বৈধ; `0`-কে ভুল করে default quantity বানানো হয় না।
- New order stock reservation record করে।
- Pending/Confirmed order courier dispatch-এর আগে Cancelled করলে database transaction stock ফেরত দেয়।
- Cancelled order re-activate করতে গেলে যথেষ্ট stock না থাকলে update বাতিল হয়।
- Pending/Confirmed order delete করলে reserved stock transactionally ফেরত যায়।
- Shipped/Delivered/Return status-এ পণ্য বাস্তবে ফেরত এসেছে কি না manual inspection দরকার; তাই ওই order-গুলো delete করা যায় না এবং Return status নিজে থেকে stock-এ যোগ করে না।
- V22 বা তার আগের order-গুলোর stock reservation history নিশ্চিত নয়, তাই সেগুলো স্বয়ংক্রিয়ভাবে restock করা হয় না।

## Security

- `admin123` default password নেই; `ADMIN_PASSWORD` ও `SESSION_SECRET` Render environment-এ রাখতে হবে।
- Server-side Supabase service-role key browser code-এ প্রকাশ করা হয় না।
- Product/order price browser থেকে বিশ্বাস করা হয় না; checkout-এর price database থেকে নেওয়া হয়।
- Product SKU duplicate validation এবং order input validation আছে।
- Product CSV এবং order/customer CSV export-এ spreadsheet formula injection mitigation আছে।
- Image upload MIME type ও size সীমাবদ্ধ।

## V23 deploy-এর আগে অবশ্যই

1. Supabase backup নাও।
2. Supabase SQL Editor-এ `database/supabase-setup.sql` আবার চালাও। এটি additive migration; পুরোনো products/orders/settings drop বা truncate করে না।
3. SQL success নিশ্চিত হলে repository root-এ এই ZIP-এর `TRENDZZNOW_GITHUB_READY/` folder-এর ভেতরের files replace করে commit/push করো।
4. Render deploy শেষ হলে `/healthz`, homepage, hidden admin login, product add/edit, test order, order cancel/restock ও CSV import/export পরীক্ষা করো।
5. Optional AI চালাতে `OPENAI_API_KEY` এবং API project-এ enabled `OPENAI_MODEL` দুটোই Render-এ সেট করো। Admin → Storefront & Policies থেকে AI enable করো।

## যেগুলো এখনো live integration নয়

- bKash/Nagad/SSLCommerz/Stripe payment gateway ও verified callback। Current bKash/Nagad flow manual send-money transaction reference; automatic payment verification নয়।
- SteadFast/Pathao/RedX API booking, label creation বা live tracking। Current courier selection/status manual।
- Multi-admin account ও granular role-based access control। বর্তমান system single admin password-based; sub-admin create বন্ধ রাখা আছে।
- Multi-item cart, customer account/login, wishlist, review/rating এবং third-party URL থেকে automatic product import।
- Live production database/browser end-to-end test এই build environment থেকে করা হয়নি।

কোনো feature provider API/credential বা production test ছাড়া enabled/complete বলে প্রচার করা যাবে না।

## V23.1 safety refinements

- Admin password বা session secret rotate করলে আগের signed admin sessions invalid হয়ে যায়।
- Pending/Confirmed order থাকা product single বা bulk delete করা যায় না; আগে order cancel/fulfil করতে হবে।
- CSV import-এ duplicate SKU skip করা হয়।
- Product threshold `0` বৈধভাবে support করা হয়।
- `npm test` এখন server/client JavaScript syntax, EJS smoke render, single FAQ marker, storefront admin-route exposure এবং destructive SQL statement পরীক্ষা করে।
- Canonical product/store URLs-এ `www.trendzznow.com` ব্যবহার করা হয়েছে।


## SQL Migration Hotfix
- Added `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text DEFAULT 'Trending'` before the category index is created. This fixes Supabase error `42703: column "category" does not exist` on older/live schemas.
- Added `database/fix-products-category.sql` as a safe standalone recovery script.
