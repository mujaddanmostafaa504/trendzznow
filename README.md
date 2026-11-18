# TrendzzNow V23.1 — GitHub & Render Ready

This repository is the deployable starting point built from the supplied `trendzznow_v22_enterprise.zip`. It keeps the existing storefront and admin dashboard source, adds GitHub/Render configuration, replaces the destructive Supabase setup SQL, and hardens several critical v22 issues.

> **Important:** This is the V23 update of the existing Express/EJS/Supabase application. The customer storefront, secure single-admin workspace, product/inventory/order/settings management and optional catalogue-grounded AI assistant are implemented in this source. Live payment-gateway callbacks, live courier API booking/tracking, multi-admin RBAC, multi-item cart/customer accounts/wishlist/reviews and automated third-party product URL importing are not implemented as live features. Do not advertise those as available until they are separately implemented and tested.

## 1. Requirements

- Node.js 20 or newer
- A Supabase project
- A GitHub repository
- A Render web service

## 2. Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set real values. Generate a session secret with:

```bash
openssl rand -hex 32
```

Required environment variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase **service_role** key, server-side only |
| `ADMIN_PASSWORD` | Admin login password, minimum 16 characters |
| `SESSION_SECRET` | Cookie-session signing secret, minimum 32 characters |
| `APP_BASE_URL` | Public website URL, e.g. `https://your-app.onrender.com` |
| `OPENAI_API_KEY` | Optional server-side key for the AI support widget |
| `OPENAI_MODEL` | Required when enabling AI; choose a model ID available to your OpenAI API project |

Optional variables:
- AI customer assistant: `OPENAI_API_KEY` and `OPENAI_MODEL` (choose a model available to your API project).
- Order notifications: `SMS_API_KEY`, `SMS_SENDER_ID`, `EMAIL_USER`, `EMAIL_PASS`.

Run checks and start the app:

```bash
npm test
npm start
```

The app intentionally refuses to start when required secrets are missing or obvious placeholders are still configured. `npm test` checks server/client JavaScript syntax, EJS templates, the single-FAQ rule, storefront admin-route exposure and destructive SQL statements.

## 3. Supabase setup

1. Open Supabase → SQL Editor.
2. Review `database/supabase-setup.sql` and run it against the intended project.
3. The script uses `CREATE TABLE IF NOT EXISTS` and additive `ALTER TABLE` statements. It does **not** drop existing tables.
4. Confirm the `product-images` Storage bucket exists. The script creates/updates it as a public image bucket (public product images only).
5. Copy the project URL and the **service_role** key into server environment variables only.

The Express backend uses the service-role credential to access Supabase. Never add that key to EJS, frontend JavaScript, a public config file, or Git.

## 4. Push to GitHub

1. Extract this ZIP.
2. Open the extracted `TRENDZZNOW_GITHUB_READY` folder. `package.json`, `server/`, `views/`, `public/`, and `render.yaml` should be at the repository root.
3. Create an empty GitHub repository.
4. From this folder, run:

```bash
git init
git add .
git commit -m "Prepare TrendzzNow for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not upload `.env`, credentials, `node_modules`, or private customer data.

## 5. Deploy on Render

### Blueprint method

1. In Render, choose **New → Blueprint**.
2. Connect the GitHub repository containing `render.yaml`.
3. Review the service settings. The supplied Blueprint selects the Free plan; availability and limitations depend on your Render account and current plan.
4. Add the required secret values when Render prompts for them.
5. Set `APP_BASE_URL` to the actual Render URL, e.g. `https://your-service.onrender.com`.
6. Deploy and check `/healthz`.

### Manual method

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`

Add the same environment variables listed above in Render → Environment.

Official Render Blueprint reference: https://render.com/docs/blueprint-spec

## 6. Admin access

The admin login route is:

`/secret-admin-panel-2026`

There is no admin link in the storefront navigation. The route is not a security boundary by itself: access is protected by an environment-configured password, a signed HTTP-only cookie, HTTPS-only secure cookies in production, and login rate limiting.

To change the admin password, update `ADMIN_PASSWORD` in Render → Environment and redeploy. The old hard-coded `admin123` login has been removed. Plain-text database/sub-admin password login is disabled; sub-admin creation is intentionally disabled until a real role/permission system is implemented.

## 7. Security and behavior changes included

- Removed the hard-coded `admin123` admin bypass.
- Removed hard-coded cookie-session secrets and require a strong `SESSION_SECRET`.
- Secure session cookies are enabled in production. Rotating the admin password or session secret invalidates previously issued admin sessions.
- Added baseline security headers and rate limiting for admin login, order placement, and order tracking.
- Order tracking now requires both the exact order ID and the phone number used at checkout.
- Order totals are calculated on the server from the current product price, server-side delivery settings, and configured promo code. Browser-supplied price/discount/delivery values are not trusted.
- Product stock is reserved atomically by a PostgreSQL function that locks the order and product rows, preventing two simultaneous orders from overselling the same stock.
- Customer-visible tracking output escapes dynamic text.
- Supabase setup no longer drops production tables or disables RLS.

## 8. Before accepting real customer orders

- Test a complete order on a staging Supabase project.
- Verify product stock is correct after successful, failed, and concurrent orders.
- Verify order lookup with correct and incorrect ID/phone pairs.
- Verify the admin session works behind Render HTTPS.
- Verify image uploads, SMTP, and SMS with test credentials.
- Configure actual payment gateway APIs before treating bKash/Nagad as online payment processing. Current storefront payment instructions are not a verified gateway integration.
- Courier names shown in the storefront are not live courier API integrations.
- Keep backups of Supabase data before schema changes.

## 9. Existing features and known gaps

The supplied code includes the storefront, product listing/detail pages, category filtering, a checkout form for one product per order, an admin login/dashboard, product/order/settings management, basic SMS/email notification hooks, and existing FAQ/policy content.

### V23 admin and customer-support update

The V23 update extends the existing application with:
- Admin pages for category management, customer summaries, analytics, and operational history.
- Product fields for SKU, per-product low-stock threshold and published/draft state (requires the additive SQL migration).
- Product CSV import/export, product search/filter/sorting, bulk publish/unpublish, bulk category changes, bulk stock changes, and bulk deletion.
- Manual stock-adjustment dialog and inventory movement records.
- Admin activity logging for product, category, order, inventory and settings actions.
- Unique SKU validation, inactive-product order rejection, and formula-injection-safe CSV exports.
- Session-bound CSRF checks for admin POST requests and logout, including multipart forms; private admin responses are marked no-store and noindex.
- Image MIME filtering and validated product price/stock fields; stock value `0` is retained instead of being overwritten by a default.
- Optional store-grounded AI chat using the OpenAI Responses API. It is disabled by default and only appears when `ai_enabled=true` in Admin settings and both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured in Render. The assistant can discuss catalog data and store policies, but cannot access order records or execute refunds, cancellations or order changes.

#### Required V23 database migration

Run the updated `database/supabase-setup.sql` again in Supabase SQL Editor. The V23 statements are additive: they add product metadata columns and create `inventory_movements` and `admin_audit_logs`. They do not drop or truncate products, orders, or settings. Back up Supabase before applying any production migration.

#### Optional AI setup

1. Add `OPENAI_API_KEY` in Render → Environment.
2. Set `OPENAI_MODEL` to a model available to your API project.
3. Redeploy.
4. Open Admin → Storefront & Policies and set “AI support widget enabled” to Enabled.
5. Test product/FAQ questions and confirm the WhatsApp fallback works.

The AI endpoint uses the OpenAI Responses API. Set an API-enabled model ID in `OPENAI_MODEL`; there is intentionally no guessed default. See https://developers.openai.com/api/reference/resources/responses/methods/create.

#### Still requiring provider credentials or separate implementation

- Live bKash/Nagad/SSLCommerz/Stripe payment checkout and verified callbacks.
- Live courier booking, label API and tracking integrations (SteadFast, Pathao, RedX credentials and API contracts required).
- Multi-item cart checkout, customer login/accounts, wishlist and product reviews.
- Multi-admin accounts with granular RBAC. Sub-admin creation remains deliberately disabled.
- Fully automated end-to-end tests and hosted monitoring/alerting.
- URL-based third-party product importer (requires domain allow-listing, SSRF defenses and per-source parsing).

Do not describe payment, courier, multi-admin or these remaining items as live integrations until implemented and tested.


## v22 storefront and admin UX update

This update refines the existing customer storefront and administrator dashboard without replacing the Express/EJS/Supabase architecture. The storefront now has responsive product cards, combined category/search filtering, product sorting, share/copy links, and removes placeholder rating/viewer counts. The admin dashboard now has a responsive sidebar and focused views for Overview, Orders, Products & Stock, Storefront & Policies, and Security. Existing FAQ content and current server-backed forms/routes are retained.

The v22 UI does not itself activate payment gateway, courier API, or AI customer-support integrations; these still require implementation and provider credentials.


## v22 storefront/admin update package

See `V22_CHANGELOG_BN.md` for the implemented UI changes, deployment steps, test results, and features that remain out of scope. The existing Render start/build commands and required environment variables are unchanged.
