# TrendzzNow V23.1 deployment status

## Implemented in this source package
- Customer storefront and product details page retain the existing FAQ and footer structure.
- Admin workspace includes Overview, Orders, Products & Stock, Categories, Customers, Analytics, Stock & Audit History, Storefront & Policies, and Security.
- Product fields include SKU, cost/selling/regular price, variants, stock, low-stock threshold and publish state.
- Product search, category filtering, sorting, CSV import/export and bulk actions are implemented.
- Manual stock adjustment and movement history are implemented.
- Customer summaries are derived from existing order records; no separate customer table is required.
- Admin activity records are stored in `admin_audit_logs`.
- New orders are marked as stock-reserved. Database transactions return reserved stock when Pending/Confirmed orders are cancelled before dispatch, prevent reactivation without sufficient stock, and restore stock when eligible pending orders are deleted. Dispatched/delivered/returned records cannot be deleted. Legacy orders are not auto-restocked because their reservation history is unknown.
- Admin POST requests and logout use session-bound CSRF validation, including multipart forms; admin responses are no-store/noindex.
- Optional customer AI chat is grounded in the current catalogue, FAQ and store policies using OpenAI Responses API. The assistant cannot access orders or perform transactions.

## Required before deploy
1. Back up the Supabase project.
2. Run the updated `database/supabase-setup.sql` migration in Supabase SQL Editor.
3. Push the V23 folder contents to the existing GitHub repository root.
4. Confirm existing Render variables remain present: `SUPABASE_URL`, `SUPABASE_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `APP_BASE_URL`.
5. Optional AI: add both `OPENAI_API_KEY` and `OPENAI_MODEL` (choose a model enabled for your API project), redeploy, then enable the assistant in Admin settings.

## Not implemented as live integrations
- bKash/Nagad/other gateway API collection and verified payment callbacks.
- SteadFast/Pathao/RedX API booking and live tracking.
- Multi-admin role-based accounts.
- Multi-item cart, customer accounts, wishlists and reviews.
- Automated third-party product URL importer.

These require provider credentials, source-specific integration work or additional customer-facing flows. They are not represented as active features in this update.

## V23.1 refinements
- Product deletion is blocked while Pending/Confirmed orders still reference that product.
- Duplicate SKU rows are skipped during CSV import.
- Admin sessions are invalidated after the admin password or session secret is rotated.
- Automated `npm test` checks JavaScript syntax, template smoke rendering, storefront FAQ/admin-route conditions and non-destructive SQL.
