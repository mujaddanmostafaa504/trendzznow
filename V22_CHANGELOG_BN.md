# TrendzzNow v22 — দুইটি UI Upgrade

## কী পরিবর্তন করা হয়েছে

### Customer Storefront
- Desktop, tablet ও mobile-এর জন্য responsive product grid; ১টি product থাকলেও card মাঝখানে ও নির্দিষ্ট প্রস্থে থাকবে।
- Category filter ও search এখন একই সঙ্গে কাজ করে; একটি ব্যবহার করলে অন্যটি reset হয় না।
- Price low-to-high, high-to-low এবং name sorting যুক্ত।
- Product card থেকে native share বা copy-link fallback যুক্ত; product details page থেকেও share করা যায়।
- Hard-coded `4.9` rating এবং কৃত্রিম “viewers watching” count সরানো হয়েছে।
- Product-এর stock field database-এ থাকলেই stock badge দেখাবে; stock value না থাকলে কৃত্রিমভাবে `In Stock` দেখাবে না।
- Product detail page ও footer mobile-এ উন্নত করা হয়েছে।
- Admin settings থেকে Facebook, Instagram, TikTok ও YouTube profile URL যোগ/পরিবর্তন করা যায়; কেবল valid HTTP/HTTPS URL footer-এ দেখায়।
- “Admin Panel-এ login করুন” লেখা customer-facing empty state থেকে সরানো হয়েছে।
- Existing single FAQ section এবং তার চারটি প্রশ্ন/উত্তর অপরিবর্তিত রাখা হয়েছে। Delivery/courier/payment information footer-এই রাখা হয়েছে।

### Admin Panel
- আগের লম্বা এক-পেজ layout-কে responsive left-sidebar navigation-এ সাজানো হয়েছে।
- আলাদা view: Overview, Orders, Products & Stock, Storefront & Policies, Security।
- Mobile-এ collapsible sidebar।
- Orders table-এ order ID/customer/phone/product search। Existing status tabs, bulk update, CSV export, label/invoice actions বজায় আছে।
- Inventory-তে product/category search।
- Product category field-এ existing category suggestion (datalist) এবং new category লেখার সুবিধা।
- Product image upload-এর preview এবং ৫ MB client-side size validation। Backend-এর existing ৫ MB upload limit-এর সঙ্গে মেলে।
- Social profile URL-এর editable fields যুক্ত; settings table-এ existing settings/update route দিয়ে save হয়।
- Admin data map inline script-এ `</script>` injection ঝুঁকি কমাতে `<` escape করা হয়েছে।

## কী পরিবর্তন করা হয়নি
- Existing Express/EJS/Supabase architecture ও existing route paths রাখা হয়েছে।
- কোনো SQL migration বা database table change করা হয়নি। Existing FAQ text ও product/order record বদলানো হয়নি।
- Admin URL অপরিবর্তিত: `/secret-admin-panel-2026`। Render-এ নতুন Environment Variable লাগার কথা নয়।
- AI chatbot, multi-item cart, true payment gateway, courier API booking/tracking, customer accounts, product URL import, multi-role admin এবং full analytics নতুন করে implement করা হয়নি। এগুলো UI-তে live feature হিসেবে দাবি করা হয়নি।

## GitHub ও Render-এ update করার পদ্ধতি
1. তোমার আগের project folder/branch-এর backup রাখো।
2. ZIP extract করে `TRENDZZNOW_GITHUB_READY` folder-এর files তোমার local GitHub repository folder-এ copy/replace করো। `package.json`, `server/`, `views/`, `public/`, `database/` ও `render.yaml` repository root-এ থাকবে।
3. GitHub Desktop-এ changes review করো। বিশেষ করে `server/index.js`, `views/index.ejs`, `views/product-detail.ejs`, `views/admin-dashboard.ejs`, `public/upgrade.css`, `public/upgrade.js`, `public/admin-upgrade.js` দেখো।
4. Commit message দাও: `Upgrade TrendzzNow storefront and admin dashboard v22`। তারপর Push origin করো।
5. Render existing service নতুন commit detect করে deploy করতে পারে; না করলে Manual Deploy → Deploy latest commit চাপো।
6. Build command `npm install`, start command `npm start` আগের মতো থাকবে। Environment Variable আগের মতোই থাকবে।
7. Deploy শেষে homepage, product details, mobile layout, share/copy, category + search + sorting, admin login, sidebar views, orders search, product add/edit, settings save এবং social links test করো।

## Test report
- Node syntax checks: passed (`server/index.js`, notification module, server entry, storefront JS, admin JS)।
- EJS template compile/render smoke-check: passed using representative mock product/order/settings data (all four EJS templates parsed; homepage, admin and product detail rendered)।
- Rendered inline JavaScript syntax: passed.
- HTML nesting smoke-check: homepage, admin and product detail had no unmatched tags in parser check.
- CSS parse: passed with zero syntax/declaration errors.
- Full `npm install`, real Supabase integration, actual browser interaction, and live Render deployment test were not completed in this environment. After push, please verify against the live database.
