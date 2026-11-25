# TrendzzNow v22.1 fixes

Render env: SUPABASE_URL, SUPABASE_KEY (service_role, server only), SESSION_SECRET_1, SESSION_SECRET_2, NODE_ENV=production.
After first login the admin password in the database is converted to a hash automatically. Change it once from the dashboard.

Products: edit no longer wipes images, base64 image URLs are not split, archive/delete/edit report real errors, is_active kept in sync.
Orders: stock reserved atomically (no overselling), rolled back if the order fails, restored on Cancel/Return, unknown or archived products rejected,
delivery_charge / discount_applied / product_id / unit_price saved, BD phone validation, order and track rate limits, COD toggle enforced.
Security: CSRF on every admin POST, passwords hashed (scrypt), login rate limit, stored XSS fixed (admin panel, labels, emails, script data),
settings and sub-admin changes limited to SuperAdmin, protected keys cannot be edited through the settings form, tracking API returns minimal fields.
Dashboard: profit now uses cost of goods sold, not shelf stock value.

# v22.2 additions
- Real pages: /privacy-policy /return-policy /terms /shipping-policy /about /contact (text comes from the CMS settings), linked in the footer and sitemap.
- Branded 404 and error pages. Unknown or archived products now return a proper 404.
- Customer reviews and star ratings: pending until approved in Admin > Customer Reviews. Verified Buyer badge when the mobile matches a Delivered order. Star rating on product cards, schema.org rating markup for Google.
- Wishlist (saved in the customer's browser): heart on every card plus a floating Wishlist filter.
- PWA manifest, favicon route, security headers, 1 hour static cache, admin pages no-store and noindex.
- Database: new `reviews` table (database/supabase-setup.sql has it, already applied on the live project).

## v22.3.0
- New professional storefront look (public/theme.css): clean white cards, navy hero and footer, trust strip, 2-column mobile grid.
- SEO: clean product URLs (/product/12-name, old links redirect with 301), richer sitemap with images, robots.txt, JSON-LD (Product, rating, breadcrumbs, organization), Google Search Console and GA4 fields.
- Admin: new "SEO & Marketing" pane (store search settings, per-product SEO health score) and live character counters on SEO fields.

## v22.4.0
- Coupons: unlimited coupons (percent or fixed, minimum order, use limit, expiry, pause/delete) in a new "Coupons & Fraud" pane. The old single code in settings still works. Discounts are always recalculated on the server.
- Blocked phone numbers: blocked numbers cannot place orders. Orders list shows High risk / Watch badges from past cancelled or returned orders.
- Products: duplicate (copy starts archived), bulk archive / restore / delete, CSV export (formula-injection safe), "Free delivery" flag per product, Top Selling Products on the dashboard.
- Delivery: optional third zone with its own charge, and editable delivery time text for each zone. Checkout preview now also shows free delivery.
- Needs the SQL at the end of database/supabase-setup.sql (already applied to the live project).
