# TrendzzNow v21 Enterprise — Initial Project Audit

Audit basis: the uploaded `trendzznow_v21_enterprise.zip` source archive. This is a static source inspection, not a live deployment or database penetration test.

## 1. Project inventory

| Area | Current implementation observed | Status |
|---|---|---|
| Runtime | Node.js + Express 4, EJS templates | Present |
| Database | Supabase JS client; `products`, `orders`, `settings` referenced | Present, schema alignment needs review |
| Customer home | Hero, announcement banner, trust strip, product grid | Present |
| Navigation | Top-left hamburger drawer and header links | Present; improve accessibility and category generation |
| Product categories | Free-text product `category` and dynamically generated tabs | Basic only; no taxonomy management |
| Search | Client-side filtering in browser | Basic only; no server search/facets |
| Product details | Product route and direct order form | Present; cart/variant model incomplete |
| Checkout | Single-item direct order flow | Present; server trusts client price fields |
| Orders | Order insertion, statuses, bulk actions, export and print actions | Present; require data-integrity and permissions work |
| Tracking | Phone-based lookup route | Present but privacy/security unsafe |
| Notifications | SMS + email adapter | Present; needs delivery status, safe HTML, HTTPS and error handling |
| Admin | Separate secret route, product/order/settings forms | Present but authentication and authorization are unsafe |
| Sub-admin | Sub-admin list stored in settings | Present but plaintext password and no actual role boundaries |
| Footer | FAQ adjacent to footer; delivery/courier/payment information near bottom | Present; preserve and improve |
| Social links | WhatsApp shortcut(s) present | Partial; no central editable social profile manager or share system evidenced |
| AI assistant | No complete customer AI chat implementation found | Missing |
| Payment gateway | COD/manual values are represented in checkout; no verified gateway adapter evidenced | Missing / requires credentials |
| Courier API | Courier names/consignment fields represented; no verified provider API adapter evidenced | Missing / requires credentials |
| Cart | No full multi-item cart workflow evidenced | Missing |
| Customer accounts | No full account/login/address/wishlist system evidenced | Missing |
| Reviews | Static 4.9/5 display in product cards | Not verified; replace with real review data or remove |
| Wishlist/compare | Not found in supplied views/routes | Missing |
| Tests/CI | No test script or test suite in supplied `package.json` | Missing |
| Documentation | No complete deployment/security/operations docs found | Missing |

## 2. High-priority risks found in source

1. `server/index.js` accepts the hard-coded admin password `admin123`.
2. Cookie-session signing keys are hard-coded and cookie `secure` is set to `false`.
3. Admin/sub-admin password values are read from settings as plain text; sub-admins are not assigned distinct enforceable permissions.
4. No CSRF mechanism is visible for admin state-changing forms. Logout is a GET endpoint.
5. Login throttling/lockout, MFA and audit log infrastructure are not evidenced.
6. `/order/place` calculates the order using browser-supplied price, delivery charge and discount rather than authoritative product and settings records.
7. `/order/track` matches partial phone numbers and returns matching order records without customer verification.
8. `database/supabase-setup.sql` drops `orders`, `products` and `settings` tables with `CASCADE`, then disables RLS. It is destructive and must not be executed against existing/production data.
9. `universalInsert` / `universalUpdate` remove fields or fabricate defaults in response to DB errors; this can conceal schema drift and lose data.
10. Product stock parsing uses fallback values such as 50 when values are empty/invalid; this can create inaccurate inventory.
11. Image upload accepts the uploaded MIME type and has a base64 fallback; validation and storage hardening are required.
12. Email HTML inserts customer/order fields without visible HTML escaping.
13. SMS notification fetch URL uses HTTP rather than HTTPS.
14. Product cards show fixed 4.9 ratings and formula-generated viewer counts; these should not be presented as factual.
15. Category filtering is based on a flat list derived from strings, not a managed parent/child taxonomy.

## 3. User-specific UI constraints to retain

- Keep the top-left hamburger/menu control.
- Do not show admin entry points on the customer storefront.
- Keep the existing FAQ as the only FAQ section and preserve current Q&A content.
- Keep delivery/courier/payment/related logistics presentation at the bottom/footer area.
- Keep TrendzzNow brand assets, text and current useful design direction; modernize rather than wipe.

## 4. Baseline checks

- `node --check server/index.js`: passed during static inspection.
- `node --check server/notifications.js`: passed during static inspection.
- Dependencies are not bundled in the ZIP; `node_modules` was absent. Runtime/EJS rendering and integration tests could not be executed in this inspection environment.
- No live Supabase connection or production schema was available; database changes were not attempted.

## 5. Priority order

**P0 — before production use:** Remove default admin credential and hard-coded secrets; secure sessions; add CSRF/rate limits/RBAC; secure order tracking; server-authoritative price/stock/delivery/coupon logic; replace destructive SQL procedure with safe migrations; validate uploads; escape notification HTML.

**P1 — essential commerce:** Category taxonomy, proper product/variant catalog, multi-item cart, checkout, order/customer data model, safe tracking, coupon rules, admin editing workflow and tests.

**P2 — business integrations:** Bangladesh payment adapters, courier adapters, webhook handling, customer notifications, real social sharing and product metadata.

**P3 — growth and automation:** AI chat with guardrails/human handoff, data-driven trending, analytics, reviews, wishlist, comparison and further marketing automations.

## 6. Important limitation

This audit describes what can be established from the uploaded source files. It does not confirm the production Supabase schema, live API credentials, deployment provider, actual running behavior, merchant eligibility, courier API approvals or existing customer/order data. The coding agent must inspect these before applying migrations or enabling external integrations.
