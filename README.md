# TrendzzNow — GitHub & Render Ready

This repository is the deployable starting point built from the supplied `trendzznow_v21_enterprise.zip`. It keeps the existing storefront and admin dashboard source, adds GitHub/Render configuration, replaces the destructive Supabase setup SQL, and hardens several critical v21 issues.

> **Important:** This is a deployable v21-based starter, not the fully expanded v22 feature set described in `docs/MASTER_IMPLEMENTATION_PROMPT.md`. AI customer support, live payment-gateway checkout, live courier booking/tracking APIs, multi-role admin permissions, and the full social/product-import automation are not implemented in this source yet. Do not advertise them as live features until they are built and tested.

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

Optional notification variables: `SMS_API_KEY`, `SMS_SENDER_ID`, `EMAIL_USER`, `EMAIL_PASS`.

Run checks and start the app:

```bash
npm run check
npm start
```

The app intentionally refuses to start when required secrets are missing or obvious placeholders are still configured.

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
- Secure session cookies are enabled in production.
- Added baseline security headers and rate limiting for admin login, order placement, and order tracking.
- Order tracking now requires both the exact order ID and the phone number used at checkout.
- Order totals are calculated on the server from the current product price, server-side delivery settings, and configured promo code. Browser-supplied price/discount/delivery values are not trusted.
- Product stock is checked and decremented with an optimistic conditional update to reduce overselling.
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

Still to implement from the expanded requirements:

- AI customer support assistant with verified knowledge retrieval and human handoff.
- Actual payment gateway integrations and verified transaction callbacks.
- Courier API booking, label generation, and live tracking.
- Customer accounts, secure wishlist, reviews/ratings, and multi-item cart checkout.
- Proper role-based admin users and granular permissions.
- Admin audit log, draft/preview/publish workflow, and stronger CSRF protection.
- URL-based product import with source validation, social link management, and real trending analytics.
- Full automated integration test suite and production monitoring.

Use `docs/MASTER_IMPLEMENTATION_PROMPT.md`, `docs/PROJECT_AUDIT.md`, and `docs/IMPLEMENTATION_CHECKLIST.md` for the next implementation phase.
