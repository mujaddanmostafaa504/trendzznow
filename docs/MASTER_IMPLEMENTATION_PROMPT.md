# TRENDZZNOW — ENTERPRISE E-COMMERCE IMPLEMENTATION MASTER PROMPT

> **Purpose:** Paste this entire prompt into Claude Code, Codex, Cursor Agent, or another repository-aware coding agent while the `trendzznow_v21_enterprise` project is open. The agent must inspect and improve the real project, not merely generate a proposal or mockup.
>
> **Non-negotiable rule:** Preserve all working functionality, existing TrendzzNow content/branding, existing products/orders/settings, and the existing single FAQ section. Improve the project in place, safely and incrementally. Do not wipe or replace the database.

---

## 0. Your role and definition of done

Act as a coordinated senior team consisting of:
- Principal full-stack engineer and e-commerce architect.
- Senior UX/UI and product designer.
- Application security engineer.
- Database and Supabase/PostgreSQL engineer.
- Bangladesh payments and courier integration engineer.
- AI customer-support / RAG engineer.
- QA automation, accessibility, performance, and DevOps engineer.

Your task is to turn the existing TrendzzNow application into a polished, secure, easy-to-operate, production-grade Bangladesh-focused e-commerce platform.

**You are not being asked to only write advice, a visual mockup, or a list of code snippets.** You must inspect the repository, build an implementation plan, edit the actual files, implement the features, run the available checks and tests, fix discovered issues, and document what is genuinely working. Do not stop after the plan. Do not claim a feature is complete unless it is implemented and verified.

Definition of done:
1. Existing customer-facing features and valid business data are preserved.
2. Customer storefront is polished, responsive, accessible, fast, and easy to shop from.
3. Admin is absent from all customer-facing navigation and content, reachable only through a configurable private URL, and protected by real server-side authentication/authorization.
4. Store owner/staff can manage all appropriate storefront, catalog, content, fulfilment, business, integration, and AI settings from the admin dashboard.
5. Product pricing, discount, delivery charge, stock, payment state, and order totals are calculated/verified on the server.
6. Social links, share actions, product previews, analytics, and product-link import/preview workflows work as specified and respect platform/API limitations.
7. AI assistant answers from approved store data, supports Bangla and English, and has strict safety and human handoff controls.
8. Critical flows have automated tests, security checks, and clear deployment instructions.
9. There are no broken routes, fake controls, nonfunctional buttons, placeholder integrations represented as live, or unexplained runtime errors.

If an external provider needs credentials or account approval, implement its adapter and configuration UI safely, add sandbox/test-mode support when the provider offers it, document exactly which environment variables and approvals are required, and show a clear “not configured” state. Do not pretend it is live.

---

## 1. First inspect the existing repository — do not code blindly

The provided project is **TrendzzNow v21 Enterprise**. Initial inspection indicates this stack:
- Node.js / Express 4 application.
- EJS server-rendered customer and admin views.
- Vanilla JavaScript and a shared CSS stylesheet.
- Supabase JavaScript client and PostgreSQL database.
- Existing notification module for SMS and email.
- Main files include `server/index.js`, `server/notifications.js`, `views/index.ejs`, `views/product-detail.ejs`, `views/admin-login.ejs`, `views/admin-dashboard.ejs`, `public/style.css`, and `database/supabase-setup.sql`.

Before changing anything:
1. Read every source file, every EJS template, CSS, SQL, package manifest, and any hidden/configuration files that actually exist.
2. Inspect Git status/history if available. Do not discard uncommitted changes.
3. Check Node/npm versions, package-lock presence, installed dependencies, scripts, runtime assumptions, Supabase schema, storage buckets, and deployment configuration.
4. Map all existing routes, forms, UI sections, data fields, and settings. Identify any DB columns that are assumed by code but absent from the schema.
5. Run baseline syntax/build/test checks that can be run safely. Do not connect to production or mutate production data during inspection.
6. Produce a concise audit table with `Existing and working`, `Existing but incomplete/buggy`, `Missing`, `Security-critical`, and `Needs credentials` classifications.
7. Keep a before/after inventory of routes, schema, and user-facing sections.

### Existing work that must be preserved and improved, not removed

The current source already contains or attempts to provide:
- TrendzzNow branding, tagline, hero/spotlight product card, announcement banner, English/Bangla text variants, and glass/aurora visual styling.
- Sticky header and a hamburger menu at the top-left.
- Product listing, basic category tabs, client-side product search/filtering, product detail pages, and direct-order modal/form flow.
- Existing FAQ with four question/answer fields and a single FAQ section close to the bottom of the home page.
- Footer with brand/support/policy information, delivery charges, courier partner presentation, and payment-method presentation.
- Order placement, SMS/email notification adapters, order tracking UI/API, order status changes, bulk order status updates, CSV export, invoice/shipping-label print actions.
- Admin product create/edit/delete, order management, store settings, FAQ/policy editing, password change, and a rudimentary sub-admin feature.
- Supabase-based products, orders, and settings data.

Preserve the existing content and useful appearance while refactoring components and data structures where necessary. Do not remove the current FAQ questions/answers or add duplicate FAQ sections. Do not remove existing order/admin capabilities; secure and improve them.

### Critical issues already visible in the supplied source — verify and fix

The inspected source contains several high-priority risks. Confirm each in the live code before changing it:

1. Admin login currently accepts the hard-coded password `admin123`.
2. Session signing keys are hard-coded in source, and the session cookie is configured with `secure: false`.
3. Admin and sub-admin credentials are stored/read as plain text in application settings; a sub-admin currently receives the same broad `isAdmin` session state rather than enforceable granular permissions.
4. Admin POST actions do not show a CSRF protection mechanism; logout is currently a GET action.
5. Admin login has no demonstrated rate limit, lockout, MFA, or security audit trail.
6. The public `/order/place` handler trusts browser-supplied product title, unit price, delivery charge, discount and total inputs. A customer can tamper with these values unless the server independently resolves and calculates them.
7. The public order lookup currently searches by partial phone match and returns matching orders without proving ownership. This can expose another customer's personal/order information.
8. Existing `database/supabase-setup.sql` starts with `DROP TABLE IF EXISTS ... CASCADE` for `orders`, `products`, and `settings`, and disables Row Level Security. **Never execute that script against an existing or production database.** It can destroy data and weaken database access controls.
9. The application uses schema-adaptation helpers that silently remove missing fields/default values after DB errors. This can hide schema drift and may silently lose submitted information. Replace this with explicit, versioned migrations and typed/validated data contracts.
10. Product creation/editing trusts several numeric inputs and uses fallback values such as stock `50`; make validation explicit and never invent stock.
11. Image uploads need content validation, file-type allowlisting, safe naming, and storage controls. Do not use data-URI/base64 database fallback as the normal production path.
12. Email HTML is built with customer/order values; escape all untrusted values to prevent HTML/script injection.
13. SMS notification URLs currently use plain HTTP; use HTTPS and provider-documented endpoints, with timeout/retry/error handling.
14. Product cards contain static 4.9 review claims and generated “live viewers” values. These are not verified data. Remove or replace fabricated social proof with real, consent-compliant metrics; never invent ratings, view counts, stock, sales, delivery times, or customer reviews.
15. Product search/category filtering is primarily client-side and the category model is a free-text value rather than a proper hierarchical taxonomy.
16. The platform currently has no complete multi-item cart/checkout, customer account system, verified review system, wishlist, proper coupon engine, full category manager, courier API integration, payment gateway integration, or AI support agent. Verify current code and treat missing work as new implementation, not as already available.
17. Many settings are present, but not all page sections, navigation items, social destinations, footer content, theme, SEO, integrations, roles, and AI configuration are centrally editable.
18. There is no evidence in the supplied package of a test suite, CI pipeline, migration history, or full operational README. Add them.

Do not assume these issues are the entire audit. Search for additional problems.

---

## 2. Preserve the exact storefront layout constraints

These are explicit design requirements. Follow them even while improving the rest of the site.

### Customer storefront
- Never show an Admin, Dashboard, Staff Login, admin URL, hidden-admin hint, or admin control anywhere in customer-facing UI, page source, footer, sitemap, search results, public menus, or social metadata.
- Keep the admin entry point separate from the customer experience. Use a configurable, non-obvious path from an environment variable such as `ADMIN_BASE_PATH`; do not hard-code the route into customer views. `/admin` may redirect to the storefront or return a neutral not-found response. Do not reveal the actual route on the storefront.
- Put the hamburger/menu button at the **top-left** of the main header. The drawer should contain useful customer navigation: Home, Shop/Trending, category links, track order, customer account, wishlist, contact/support, and policy links where applicable. It must be keyboard accessible and mobile friendly.
- Keep the current TrendzzNow branding and existing visual direction as a starting point. Modernize the spacing, typography, hierarchy, cards, navigation, form states, loading states, empty states, and mobile behavior without needlessly replacing the brand identity.
- The category system must feel like a professional commerce store, not a row of unstructured tag buttons. See Section 4.
- Keep **one and only one** existing FAQ section. Preserve its existing questions and answers and keep this same FAQ section at the bottom of the home page, in its current footer-adjacent position. Do not add FAQ cards elsewhere, extra FAQ pages, or duplicate FAQ accordions. It may remain editable in admin.
- Delivery, shipping, courier, return/replacement, payment-provider, support-contact and related logistical information belongs at the **very bottom/footer area**. The user specifically wants delivery/courier information placed down with the bottom/footer content. Do not put a new large delivery/courier promotional section near the hero or product grid. Product/checkout pages may show the exact applicable delivery price needed to make a purchase decision, but the main service-partner/policy presentation should remain in the footer.
- Keep the homepage's existing section sequence unless the audit proves a usability issue: announcement/banner, header/menu, hero, trust strip where truthful, product discovery/listing, exactly one FAQ, footer with delivery/courier/payment/policy/social details. The checkout modal/flow may be separate and accessible.
- All footer social links must be real clickable links, use correct destinations, open safely, and display only when configured.
- All buttons/links must work. Do not leave decorative dead controls.

### Visual quality
- Mobile-first responsive design from small phones through desktop and wide screens.
- Clear visual hierarchy, accessible font sizes and line heights, consistent spacing tokens, consistent border radii, predictable focus rings, clean forms, subtle motion, and reduced-motion support.
- Keep animation lightweight and never let decorative motion interfere with reading, navigation, checkout, or accessibility.
- Use real optimized product images, descriptive alt text, and stable aspect ratios. Avoid broken-image icons and layout shifts.
- Add well-designed skeletons/loading feedback, no-results states, error states, empty-cart state, out-of-stock state, toast/inline success feedback, and accessible confirmation dialogs.
- Use a coherent component system and CSS variables/design tokens. Avoid scattered inline CSS for new components.
- Provide Bangla and English UI support. UI language must be consistent within a page/session; use Bangla when selected and remember that choice appropriately. Do not create mixed-language labels unintentionally.
- Target WCAG 2.2 AA: keyboard operation, visible focus, accessible names, labels, semantic landmarks, sufficient contrast, reduced motion, screen-reader announcements, and appropriate error messages.

---

## 3. Secure administration — mandatory before adding more admin features

The private admin area is a separate product surface and must be secure by default.

### Entry and authentication
- Make the private base path configurable through `ADMIN_BASE_PATH` in the environment. Use a safe default only in local development. Do not show this path on customer pages.
- Never use `admin123`, default passwords, hard-coded signing secrets, credentials stored in source code, or public bootstrap credentials.
- Create a secure first-run owner setup process. Require an environment-provided one-time setup token or another documented safe bootstrap. Force the owner to set a strong password and invalidate the bootstrap token after setup.
- Store passwords using a modern password hash (prefer Argon2id; if not feasible, use a secure scrypt/bcrypt implementation with appropriate parameters). Never store or display plaintext passwords.
- Support MFA for owner and privileged users (TOTP or an established identity provider). Provide secure recovery codes and audited recovery flow.
- Rate-limit login and password recovery by account and IP. Add progressive delay/temporary lockout, audit events, generic authentication errors, and monitoring.
- Rotate the session on successful login. Use secure server-managed sessions (prefer a server-side session store for production) with `HttpOnly`, `Secure` in HTTPS production, appropriate `SameSite`, bounded lifetime, idle timeout, absolute timeout, and logout invalidation.
- Never put secrets, passwords, access tokens, or sensitive customer data inside a client-readable signed cookie.
- Use CSRF protection for every state-changing browser form/action. All delete/update/change actions must use POST/PATCH/DELETE, never GET. Verify origin where appropriate.
- Set security headers, HTTPS enforcement in production, safe CORS policy, input validation, output escaping, safe error pages, and request-size limits.
- All server routes must validate authentication **and permission** on every request. Hiding a button in the interface is not authorization.

### Role-based access control

Implement real roles and permission keys rather than a single `isAdmin` boolean. Suggested roles:
- `owner`: complete control, user/role management, integrations and security settings.
- `store_manager`: catalog, orders, inventory, content and ordinary store settings.
- `catalog_manager`: products, variants, categories, inventory view.
- `fulfilment_staff`: order processing, courier assignment, shipment/consignment updates, shipping labels.
- `customer_support`: customer queries and read-only order lookup; limited notes/status actions.
- `content_editor`: banners, content, policies, SEO, FAQ editing (but not admin/security/payment secrets).
- `finance`: payment/refund records and finance reports, with high-impact actions requiring re-authentication.
- `analyst`: read-only analytics.

Define granular permissions such as `products.read`, `products.create`, `products.update`, `products.delete`, `orders.read`, `orders.update_status`, `orders.delete`, `settings.content.update`, `settings.payment.update`, `admins.manage`, `analytics.read`, `ai.configure`, and `audit.read`. Create an explicit permission matrix. Deny by default. Enforce on the server and test direct API requests by users lacking permissions.

### Admin dashboard navigation

Create a clean, professional dashboard with a clear left navigation or compact admin sidebar. Include:
1. Overview dashboard and activity alerts.
2. Products and product variants.
3. Categories and subcategories.
4. Inventory and stock movements.
5. Orders and order details.
6. Payments and transactions.
7. Shipping zones, courier providers and fulfilment.
8. Customers and support.
9. Coupons, promotions and campaigns.
10. Reviews and moderation.
11. Wishlist/engagement insights where useful.
12. Homepage/content/sections and banners.
13. Menu/navigation manager.
14. Footer manager — delivery and courier information here.
15. Existing FAQ manager — edit the existing four FAQ items/entries; do not create a second FAQ system on the storefront.
16. Social links, sharing and link-import tools.
17. SEO and metadata.
18. AI chat configuration, knowledge sources and handoff inbox.
19. Analytics and reports.
20. Staff users, roles and permissions.
21. Integrations/secrets/connection status.
22. Audit logs, backups, system health and settings.

Use permission-aware navigation so users see only the tools they are authorized to use.

### Admin editing workflow

All store-operational content should be editable without editing source files:
- Site name, logo, favicon, taglines and brand settings.
- Colors, typography and safe theme presets.
- Announcement bar and hero/spotlight content.
- Homepage section visibility, order, text, images, buttons and destinations.
- Header menu, categories, subcategories and navigation links.
- Product cards and product details.
- Footer columns, text, social URLs, payment logos, courier partners and delivery/policy content.
- Existing FAQ questions and answers (preserving the existing single section).
- Store pages and editable policy content.
- Banners, promotions, coupons and campaigns.
- Delivery zones, fees, delivery estimates and supported couriers.
- Tax/fee configuration where applicable.
- Social share defaults, URL import policy and analytics toggles.
- SEO title, description, canonical URL, OG image and structured data.
- Notification templates and provider connection state.
- AI assistant enabled state, greeting, tone, languages, knowledge sources, handoff policy and response guardrails.

Sensitive credentials are different: allow authorized users to **set/rotate** a secret and test the connection, but never display a stored secret again. Store secrets only in server environment/secret management or encrypted server-side storage. Do not expose secrets to browser JavaScript or logs.

Every editable item should support:
- Input validation and sanitization.
- Draft, preview and publish where content is customer-facing.
- Change history/versioning and rollback for content/configuration.
- Actor, timestamp, old/new values and reason in an audit trail for important changes.
- Permission check, confirmation for destructive changes, and re-authentication for sensitive changes.
- Useful success/error feedback.

---

## 4. Professional product catalog and category architecture

Do not keep category as only an uncontrolled free-text label. Add a proper category taxonomy.

### Category features
- Parent category and nested subcategory support.
- Category name in Bangla and English, unique slug, description, optional icon/image/banner, SEO fields, parent ID, display order, active/inactive state, and category-specific filter attributes.
- Drag/drop or accessible ordering controls in admin.
- Avoid duplicate slugs and circular parent relationships.
- Category landing pages with clear heading, intro, breadcrumb, product count, filters, sorting and pagination.
- Products may have one primary category and optional secondary categories/tags if useful.
- Menu drawer and desktop navigation should build from published category data.
- Display a manageable, clear category hierarchy; do not crowd mobile navigation with dozens of items.

### Catalog features
- Product name/title in Bangla and English where available; slug; SKU; product code; short/long description; category; brand/vendor; tags; images/gallery/video; price; compare-at/regular price; cost price visible only to authorized staff; status (draft/active/archived); featured/trending flags; created/updated timestamps.
- Product variant model for color, size, model, pack size, or other attributes. Each sellable variant has its own SKU, price override if applicable, stock, image, active state and option values.
- Explicit stock quantity, low-stock threshold, stock status, stock reservation and stock movement history. Never default a new product to 50 units unless an operator intentionally enters it.
- Stock must be decremented atomically only after order acceptance according to the chosen COD/payment workflow. Prevent race-condition overselling. Define reservation expiry and cancellation/restock behavior.
- Product image upload: allow known image formats only; validate content signature, MIME, extension, file size and dimensions; sanitize SVG or disallow unsafe SVG; use randomized object keys; store in Supabase Storage or another object store; validate external image URLs; no arbitrary filesystem paths; no unbounded base64 fallback.
- Admin bulk import/export through validated CSV/XLSX where feasible, with preview, field mapping, error report and duplicate detection.
- Product draft/preview/publish, archive, duplicate, bulk edit, bulk status/stock/price changes, audit history.

### Product listing/detail page
- Responsive, consistent product cards.
- Real current price, sale/regular price, truthful discount, variant/stock status, and verified rating/count only if real reviews exist.
- Quick view or fast details only if it does not harm accessibility/performance.
- Category/brand/price/availability/attribute filters, clear-all filters, sorting (featured, newest, popularity using real metrics, price low-high/high-low, rating only if valid), pagination or accessible “load more”, result count.
- Search with debounce, suggestions, typo tolerance, recent searches if privacy-safe, and useful empty results. Server-side search/filter for larger catalogs; do not depend only on client-side DOM filtering.
- Product details: image gallery, description/specifications, selected variant, stock state, clear price, quantity, shipping estimate based on configured zone, returns/policy link, add-to-cart/buy flow, share/copy-link, related products based on real category/tags.
- Compare products only if useful for the category; make the compare feature usable on mobile.
- Reviews: authenticated/verified-purchase review workflow, moderation, anti-spam, clear disclosure and abuse reporting. Never fabricate review entries or ratings.

---

## 5. Complete shopping, cart, checkout and order management

The existing one-product quick-order workflow should remain accessible as a convenient option, but the platform must also gain a proper cart and multi-item checkout.

### Cart
- Add/remove items; change quantity; choose variants; persist guest cart with a safe browser token and logged-in cart server-side; merge carts safely on login.
- Display item, selected variant, price, quantity, stock state, subtotal and estimated delivery.
- Revalidate prices, availability and quantities on every server-side cart/checkout action.
- Prevent stale cart quantities and show clear stock/price-change warnings.

### Checkout
- Guest checkout must be supported; account creation must not be mandatory.
- Collect only needed details: customer name, Bangladesh phone number, optional email, district/area/address, delivery method and payment method.
- Validate Bangladeshi mobile numbers robustly without rejecting valid supported formats.
- Calculate prices, discount eligibility, delivery fees and final payable amount on the server. Ignore browser-sent totals/prices/discounts/delivery charges.
- Show an order summary and terms/privacy consent clearly.
- Provide COD and configurable online payment methods. Show manual bKash/Nagad instructions only if the store owner has enabled and configured them; never claim manual transfers are verified before reconciliation.
- Payment gateway flows must verify signed callbacks/webhooks server-side and use idempotency. Never mark an order paid from a frontend redirect alone.
- Use a payment abstraction so the store can configure supported providers. For Bangladesh, evaluate provider options such as SSLCommerz, ShurjoPay, aamarPay, bKash and Nagad based on merchant eligibility, available APIs, current documentation and account credentials. Do not hard-code provider assumptions or store raw card data.
- PCI-sensitive card data must be handled by a compliant provider-hosted/tokenized flow. Never collect/store raw card number, CVV or PIN.
- Coupon/promo validation must be on the server, with start/end dates, usage limits, customer limits, min order, product/category exclusions, stacking rules, fixed/percentage discount, maximum discount, and redemption records.
- Confirm order with a human-friendly order number, item breakdown, shipping fee, payment state and next-step message.
- Order creation must be transaction-safe/idempotent to avoid duplicate submissions.

### Data integrity and pricing security
- The browser submits product/variant IDs and requested quantity, not authoritative prices or product title/total.
- Server fetches canonical active product/variant records, checks inventory and price, applies valid coupon, calculates shipping based on the configured delivery zone, and computes the total.
- Use integer minor units (paisa) or a safe decimal library for money. Avoid floating-point arithmetic for financial calculations.
- Store a snapshot of the item name/SKU/variant/unit price at order time so future catalog edits do not alter old invoices.
- Keep an immutable money breakdown: subtotal, discounts, delivery, tax/fees, payable total, paid amount, refunded amount, currency.
- Use a DB transaction or Supabase RPC function for atomic order and inventory operations; retry safely and use idempotency keys.

### Orders and customer tracking
- Order statuses: Pending, Confirmed, Processing, Packed, Shipped/Handed to Courier, In Transit, Out for Delivery, Delivered, Cancelled, Return Requested, Returned, Refunded. Configure allowed transitions and transition history.
- Every status update records actor, time, source, note and courier tracking ID.
- Admin can search/filter by date, status, courier, payment state, order ID, phone (authorized users only), and customer name.
- Preserve useful current order tools: status update, bulk actions, CSV export, invoice and shipping label printing, customer contact shortcut, staff notes.
- Order details should show a timeline, items, payment, shipping, notes and event history.
- Customer tracking must verify ownership using a secure order-specific tracking token, authenticated account, or phone/email OTP. Never return all orders based on a partial phone search. Rate-limit attempts and avoid leaking whether an order exists.
- Customer account (optional): profile, addresses, order history, order details, invoice, saved items, reviews and notification preferences.
- Allow guest order lookup only with sufficient verification (e.g. order reference plus OTP). Do not reveal full address/phone details to an unverified visitor.

---

## 6. Bangladesh delivery and courier management

The main courier/logistics information and partner presentation belongs in the bottom/footer area as requested. Checkout may show the relevant delivery charge/estimate.

### Admin configuration
- Delivery zones should support division/district/city/area or configurable service zones.
- Set inside-Dhaka, outside-Dhaka and area-specific fees; free-delivery thresholds; minimum basket if needed; delivery estimates; COD eligibility; weight/size rules if needed.
- Courier providers: allow enabling/disabling, logo/name, service zones, service types, credentials, test mode, tracking URL template and connection state.
- Potential providers to evaluate: SteadFast, Pathao Courier and RedX. Integrate only using current official APIs/documentation and valid business credentials.
- Admin can choose a courier manually or use a configurable preferred-provider rule; record consignment/tracking ID and provider response.
- Do not call an external courier API from browser code. Use server-side adapters, webhooks where supported, retries, timeouts, idempotency and logs.
- Provide manual fallback when an API is not configured or temporarily unavailable.
- Validate and escape courier data. Never expose courier API credentials.
- Ensure the courier logos and partner names in the footer reflect actual enabled services, not hard-coded promises.

---

## 7. Social media, sharing, link copying, trending and product-link import

### Social profile links
- Add editable social profile fields in admin for Facebook, Instagram, TikTok, YouTube, Pinterest, WhatsApp, Messenger and any other relevant configured channel.
- Each visible social icon must be a real anchor with a valid URL, appropriate `rel="noopener noreferrer"` for new tabs, accessible labels, and sensible disabled/hidden state when no URL exists.
- Admin can test links and preview the footer/header placement.

### Product sharing
- On every product detail page provide working share actions: Web Share API where supported, WhatsApp share, Facebook share intent where supported, and Copy Link with clipboard fallback.
- Show real success/error feedback and a fallback URL the customer can select/copy.
- Generate canonical product URLs and unique Open Graph metadata (`og:title`, `og:description`, `og:url`, `og:image`, `og:type`) and appropriate product structured data. Product pages need server-rendered metadata so social crawlers can read it; do not rely solely on client-side JavaScript.
- Ensure preview images have public, stable HTTPS URLs, correct dimensions and no authentication requirement. Add Twitter/X card metadata as appropriate.
- Test actual crawler behavior using a preview/debugging workflow where available; explain that each social platform has its own caching and metadata rules.

### URL paste / product preview / import
- In admin add a “Paste product URL” tool. The operator pastes a public product URL.
- Validate protocol and hostname. Block localhost, private IP ranges, link-local, cloud metadata endpoints, internal network destinations, redirects to unsafe destinations and unsupported protocols to prevent SSRF. Add timeouts and response-size limits.
- Only fetch metadata server-side through a safe URL-fetch service. Extract Open Graph/Twitter title, description, image, source URL and possibly price only as untrusted suggestions. Do not treat scraped price/stock as authoritative.
- Display a preview card with extracted metadata and let an authorized human review/edit each field before creating a product draft. Do not auto-publish or copy copyrighted images/content without permission. Respect website terms and robots policy; use official APIs where available.
- Allow a pasted TrendzzNow product URL to resolve to the internal product record and preview it without creating a duplicate.

### Trending products
- Create a real trending score from approved first-party events such as product view, share click, add-to-cart, checkout start and completed purchase, with configurable weights/time windows and bot filtering.
- Use privacy-conscious analytics and consent settings. Avoid storing unnecessary personal data. Do not equate a pasted URL with external sales popularity.
- Admin can manually feature a product and set start/end dates. A trending badge must be based on real event data or explicit editorial curation.
- Remove fabricated “live viewers”, fake sales counts, fake stock urgency and unverified ratings. Never display false scarcity.

---

## 8. AI customer chat assistant — real store-aware support

Add a friendly, lightweight AI chat widget that works in Bangla and English. It should appear on customer-facing pages without obstructing checkout or mobile navigation.

### Allowed capabilities
- Answer store FAQs, delivery, payment, replacement/return, privacy and warranty policy questions from the current approved store policies and the existing FAQ entries.
- Search the live product catalog and recommend products based on budget, category, use case, price and available variants/stock.
- Compare available products using verified catalog data.
- Explain order status only after the customer verifies ownership (logged-in account or secure OTP/token check), using a read-only order API.
- Collect a contact/handoff request and route it to a human support queue.
- Understand Bangla, Banglish and English; reply in the customer's chosen/current language.

### AI architecture and guardrails
- Use an LLM provider through a server-side adapter. Store API keys only in server environment/secret manager. Add provider/model selection only if implemented and tested.
- Ground answers using approved knowledge sources: product catalogue, approved policies, current FAQ content, store settings and verified order lookup tools. Use retrieval with source IDs/versioning and freshness control.
- If information is missing, uncertain or contradictory, say so and offer human support. Never invent price, availability, delivery date, discount, product specs, courier status or policy.
- Define a strict tool allowlist. Order lookup is read-only and must require customer verification. The model must not get direct arbitrary database access or execute arbitrary SQL/shell/network requests.
- Treat customer messages, pasted links, uploaded content, retrieved documents and tool results as untrusted data. Defend against prompt injection and data exfiltration. Retrieved text must never override system rules or expose hidden admin instructions.
- Never ask for or echo card number, CVV, mobile-wallet PIN, password, OTP, API key or other authentication secret. Detect/redact sensitive data before model calls and logs.
- Obtain appropriate AI/privacy consent; tell customers they are talking to an AI assistant and provide human handoff. Support conversation deletion/retention policy as required.
- Do not let AI autonomously place orders, take payments, cancel orders, issue refunds, alter addresses, change order status, change prices/stock, or make legal/financial promises. For any future action-capable workflow, require an explicit confirmation step and a separately authorized deterministic backend action. In the initial release, keep the agent read-only plus handoff.
- Human handoff triggers: customer asks for a human, low confidence, angry/upset customer, payment dispute, return/refund request, privacy/security concern, sensitive issue, or a failed lookup. Send the transcript, relevant retrieved sources, safety flags and verified customer/order context only to authorized staff.
- Admin can edit welcome message, tone, supported languages, suggested prompts, knowledge sources, business hours, handoff destination and escalation rules. Do not allow arbitrary unsafe system-prompt editing without validation/preview and owner permission.
- Log safety events and tool calls. Avoid retaining full transcripts longer than needed. Provide an admin inbox with assignment, state, notes and export/delete policy.
- Add offline/fallback support text if AI provider is unconfigured or unavailable.

### AI acceptance tests
- Correctly answers questions using current FAQ/policies.
- Does not hallucinate stock/price/shipping fees.
- Returns current product IDs/URLs and valid variants from the actual catalogue.
- Cannot access another customer's order without verification.
- Refuses prompt injection asking for secrets, admin access or arbitrary tool calls.
- Never performs refund/cancel/order-write action.
- Escalates uncertain and sensitive cases.
- Bangla, Banglish and English language behavior is tested.

---

## 9. Notifications, communication and customer experience

- Preserve existing SMS/email behavior but refactor into provider adapters and background-safe jobs where appropriate.
- Configure SMS provider, sender ID, email SMTP/provider, WhatsApp contact link and notification templates from secure admin settings/environment.
- Use HTTPS endpoints, request timeout, retry with bounded backoff, idempotency and delivery status logs.
- Escape all HTML values in emails and templates. Do not expose sensitive details in SMS.
- Send order acknowledgement, payment status, dispatch, tracking, delivery and cancellation notifications based on verified events.
- Avoid telling a customer an order is “confirmed” if it is only pending.
- Admin can edit safe parts of templates; secrets are not editable/displayed as plain text.
- Provide customer contact options that work: WhatsApp deep link, tap-to-call, email, social profile, support ticket and AI-human handoff if configured.

---

## 10. SEO, discoverability and analytics

- Unique page title and description for homepage, category and product pages.
- Canonical URL, Open Graph/Twitter metadata, robots.txt and dynamic sitemap.
- Product/Offer/Breadcrumb structured data with accurate price, currency, availability and rating fields only when valid.
- Clean slugs, 404 page, redirects for changed slugs, noindex for admin/private/account/cart/checkout pages as appropriate.
- Optimized images, modern image formats, lazy loading below the fold, reserved dimensions, caching and compression.
- Track key funnel events: view_item, search, select_item, add_to_cart, remove_from_cart, begin_checkout, purchase, share, copy_link and support_handoff.
- Analytics must respect consent and privacy settings. Do not send PII (phone, email, address, order identifiers that can identify users) to general analytics tools.
- Admin dashboard should show clear metrics: sales, orders, average order value, conversion funnel where tracking is available, top products/categories, low stock, cancellation/return rate, payment status and courier status. Clearly distinguish actual data from estimates.

---

## 11. Database, API and architecture requirements

### Database safety
- **Do not run or retain as an executable setup step the destructive current SQL that drops existing tables.** Keep a backup copy only if required for history, clearly label it as destructive/legacy and never execute it.
- Create forward-only, versioned, idempotent migrations. Prefer additive changes and explicit backfill steps. Never drop/rename production data without a documented migration, backup, test restore and explicit approval.
- Preserve existing `products`, `orders`, and `settings` data. Map legacy columns (`name`/`title`, `mobile`/`phone`, `product_name`/`product_title`, etc.) and backfill carefully. Do not use error-driven field deletion to hide schema mismatch.
- Use Supabase service-role credentials only on the trusted server, never in browser code. Keep RLS enabled and define restrictive policies. Public users should not query tables directly unless a deliberate safe policy exists.
- Use DB constraints, foreign keys, indexes, uniqueness constraints and transaction-safe RPCs for order/inventory workflows.
- Make migrations reversible where safe, and always document rollback limitations.

### Suggested normalized data model
Adapt to the existing schema and use migrations rather than replacing tables blindly. Add/normalize entities as needed:
- `products`, `product_variants`, `product_images`, `categories`, `brands`, `product_tags`, `product_category_links`.
- `inventory_locations` if needed, `inventory_movements`, `stock_reservations`.
- `customers`, `customer_addresses`, `customer_sessions` or secure auth provider references.
- `carts`, `cart_items`.
- `orders`, `order_items`, `order_status_events`.
- `payments`, `payment_events`, `refund_records` (refunds controlled by authorized humans/gateway only).
- `shipping_zones`, `shipping_rates`, `courier_providers`, `shipments`, `shipment_events`.
- `coupons`, `coupon_redemptions`, `promotions`.
- `reviews`, `review_moderation_events`, `wishlists`, `wishlist_items`.
- `site_settings`, `navigation_items`, `content_pages`, `content_sections`, `content_versions`, `media_assets`, `social_links`.
- `admin_users`, `roles`, `permissions`, `role_permissions`, `admin_sessions`, `audit_logs`.
- `social_events`, `analytics_events` with privacy-conscious retention.
- `ai_settings`, `ai_knowledge_sources`, `ai_conversations`, `ai_messages`, `ai_handoffs`, `ai_tool_events` with retention controls.
- `webhook_events`, `notification_jobs`, `integration_logs` as required.

Avoid overengineering: implement the smallest robust schema that serves real requirements and current scale. Document every table and important index.

### API design
- Define consistent validation and response shapes.
- Use clear route/controller/service/repository boundaries. Keep business logic out of EJS templates.
- Add request validation (e.g. Zod/Joi/express-validator) and response-safe error handling.
- Use pagination/filter/sort server-side for large lists.
- Add idempotency for order creation and payment/courier webhooks.
- Add request IDs and structured logs.
- Use correct HTTP status codes and avoid leaking stack traces/secrets.

Suggested endpoint groups (adapt to current route naming):
- Public: `/api/catalog/products`, `/api/catalog/categories`, `/api/search`, `/api/cart`, `/api/checkout`, `/api/orders`.
- Customer: `/api/account/*`, `/api/customer/orders/:id`, `/api/customer/orders/:id/tracking`.
- Tracking: `/api/tracking/lookup` with OTP/token verification.
- Admin: `/api/admin/products/*`, `/api/admin/categories/*`, `/api/admin/orders/*`, `/api/admin/inventory/*`, `/api/admin/settings/*`, `/api/admin/users/*`, `/api/admin/audit/*`, `/api/admin/ai/*`, `/api/admin/integrations/*`.
- Webhooks: provider-specific, signature-verified, idempotent endpoints.
- AI: `/api/support/chat`, `/api/support/handoff`, restricted server-only tools.

The existing Express/EJS stack can be kept if it remains maintainable and secure. Do not perform a framework rewrite merely because a new framework is fashionable. If migration to a new architecture is genuinely required, propose the migration with compatibility and data-preservation steps, then implement incrementally.

---

## 12. Error handling, security, privacy and operational reliability

- Add a centralized error handler and safe user-facing error pages/messages.
- Add secure headers (Helmet or equivalent), strict input validation, output escaping, SQL/RLS checks, CSRF, rate limiting, brute-force protection, session security, upload controls, SSRF protection, webhook signatures, and dependency vulnerability review.
- Use parameterized Supabase queries and avoid dynamic untrusted table/column names.
- Add secret scanning and `.gitignore` protections. Provide `.env.example` with names only; no real keys, passwords or customer data.
- Do not print secrets, full tokens, OTPs, password values, payment payloads or unnecessary PII in logs.
- Add privacy/data retention rules for customers, AI conversations, analytics, notifications and audit logs.
- Add secure backup instructions, scheduled database backup/snapshot process if the hosting provider supports it, media backup, and a tested restore procedure.
- Add health checks: liveness, DB connectivity/readiness, storage and integration status (without exposing private detail publicly).
- Add graceful shutdown, timeouts, bounded retries and queue strategy for notifications/webhooks where practical.
- Use environment-based configuration for production/staging/development.

---

## 13. Testing and release gates — no feature is complete without evidence

Create automated tests appropriate to this stack. Preferred options can include Node's built-in test runner or Jest/Vitest for unit/integration and Playwright for end-to-end tests; choose what fits the actual repository.

### Required test coverage
**Authentication/authorization**
- No default credentials work.
- Wrong-password throttling works.
- Session cookie flags are correct in production.
- Session rotation/logout/expiry works.
- MFA flow and recovery behavior are tested if enabled.
- Unauthorized and wrong-role requests fail at the backend even when a user manually calls endpoints.
- CSRF-protected forms reject missing/invalid tokens.

**Catalog/inventory**
- Category hierarchy, duplicate slug and invalid parent checks.
- Product create/edit/publish/archive.
- Variant validation and stock tracking.
- Upload invalid file, oversize file and malicious file tests.
- Low-stock and out-of-stock behavior.
- Concurrent checkout cannot oversell stock.

**Cart/checkout/orders**
- Guest and authenticated cart.
- Multi-item cart and variant handling.
- Tampered browser price/discount/shipping/total is ignored.
- Coupon expiry, limit, eligibility and stacking.
- Invalid phone/address/quantity handling.
- Duplicate order submission/idempotency.
- Payment callback signature validation and duplicate webhook handling.
- Order state transition validation.
- OTP/token tracking prevents unauthorized access.

**Courier/notifications/social**
- Provider disabled/not configured behavior.
- API timeout, retry and malformed response behavior.
- SMS/email escaping and safe failure behavior.
- Share and copy actions.
- Product OG metadata renders on server.
- URL import rejects localhost/private IP/redirect SSRF attempts.
- Trending score ignores known bot/noise patterns and uses actual events.

**AI**
- Grounded answers and correct catalog/policy retrieval.
- Prompt injection and data-leak tests.
- No write action capability.
- Order verification boundary.
- Human handoff triggers.
- Bangla/Banglish/English behavior.
- Provider timeout/unavailable fallback.

**UI/accessibility/performance**
- Mobile widths and desktop layouts.
- Keyboard-only navigation, focus visibility, form labels, contrast, accessible dialogs and menu.
- Existing FAQ appears exactly once and stays at bottom adjacent to the footer.
- Delivery/courier/payment partner information appears in footer area, not as an extra hero-level block.
- Admin path/link is never exposed in customer pages, page source, sitemap or robots-visible content.
- No dead buttons or invalid social destinations.
- Performance smoke tests and image/layout-shift checks.

### Release gates
- Run syntax check, test suite, lint/format, dependency audit, migration test on an isolated/staging database, and end-to-end checkout test.
- Verify no destructive SQL is executed.
- Verify backups/restoration before any production migration.
- Do not deploy if critical security tests fail.
- Clearly report test command, pass/fail count, and any test that could not run.

---

## 14. Implementation plan — execute phase by phase

Do not implement everything in one uncontrolled rewrite. Complete each phase and verify it before moving on. Do not stop after describing the phases.

### Phase 0 — repository audit and baseline
- Inspect all files and runtime requirements.
- Capture current behavior and preserve existing business data.
- Produce route/schema/settings inventory, issue list and exact implementation checklist.
- Identify required secrets/accounts and deployment constraints.
- Do not touch production data.

### Phase 1 — security and data protection (highest priority)
- Remove default credentials and hard-coded secrets.
- Implement safe bootstrap, password hashing, secure sessions, rate limit, CSRF, RBAC, audit logs and safe logout.
- Secure tracking/order lookup.
- Server-authoritative price/stock/delivery/coupon calculation.
- Replace destructive schema setup with safe forward-only migration plan; preserve existing data and RLS.
- Fix upload and email/SMS security.
- Add security tests.

### Phase 2 — foundations and store administration
- Build normalized migration path and explicit validation.
- Create admin layout/navigation, staff roles, permissions and audit event views.
- Make all current settings editable with preview/draft/publish and validation.
- Preserve existing product CRUD, order manager, bulk updates, CSV, invoice and shipping labels.
- Add menus/footer/social settings and integration configuration status.

### Phase 3 — professional catalog and storefront
- Build category/subcategory manager and navigation.
- Improve product search, filter, sorting, pagination, detail page, variants and media.
- Build responsive customer UI with the exact layout constraints in Section 2.
- Add product metadata, sharing and copy-link functionality.
- Remove fabricated metrics and ratings.

### Phase 4 — cart, checkout, orders, payments and courier
- Implement multi-item cart, guest checkout, server-side totals and safe order flow.
- Add coupon system, order item snapshots and customer order history/tracking.
- Integrate payment/courier providers only after official API/docs and credentials are available; test in sandbox.
- Retain a safe manual COD/manual courier fallback.

### Phase 5 — social media and trending workflow
- Configure clickable social destinations.
- Add product share/OG previews and copy-link features.
- Add safe URL paste/import preview for admins and data-driven trending scores.

### Phase 6 — AI customer support
- Add store-grounded bilingual AI chat.
- Implement read-only, verified order lookup, knowledge management, guardrails, privacy and human handoff.
- Test prompt-injection, PII protection, hallucination and failure behavior.

### Phase 7 — analytics, QA, deployment and handover
- Add dashboards, observability, CI tests, backups and operational docs.
- Test every feature and device class.
- Prepare staging release, then production checklist.
- Deliver final package and deployment guide.

If time or token limits prevent every phase from being completed in one run, complete and test the highest-priority safe phases first, leave a clear progress log and next-step checklist, and never falsely mark unfinished features as complete.

---

## 15. Required deliverables

Modify the real project and return:
1. Complete updated project source, preserving existing useful files and content.
2. A database migration folder with safe forward-only SQL and any required Supabase RPC functions.
3. `.env.example` containing every required variable name, without secrets.
4. Updated `package.json` scripts and lockfile consistent with installed dependencies.
5. `README.md` with install, local run, Supabase setup, environment variables, migration instructions, admin bootstrap, test commands, deployment, backups and troubleshooting.
6. `SECURITY.md` with threat model, admin access, data handling and incident/recovery notes.
7. `IMPLEMENTATION_STATUS.md` listing implemented, tested, requires credentials, and not implemented items.
8. Automated tests and a test report.
9. If possible, a ZIP containing the full updated project but excluding `node_modules`, `.env`, credentials, real customer data, and production backups.
10. A short final handover summarizing files changed, features done, exact test results, known limitations and what credentials/configuration I must provide.

### Mandatory reporting format at the end of every phase
- **Implemented:** concrete features and behavior.
- **Files changed:** actual paths.
- **Database changes:** migration names and whether applied to an isolated/staging DB.
- **Tests run:** commands and actual results.
- **Security review:** checks completed and remaining concerns.
- **Blocked by credentials:** exact provider/account/env variable requirements.
- **Next phase:** what will be done next.

### Work discipline
- Make changes directly in the current repository.
- Do not ask me to re-explain requirements already written here.
- Do not stop at a plan unless a genuine blocker makes code changes unsafe.
- Do not overwrite original data or run destructive commands.
- Do not silently replace the existing product/brand design or FAQ content.
- Do not generate fake credentials or hard-code secrets.
- Do not use placeholder functions for features described as complete.
- Do not install unnecessary dependencies or change frameworks without technical justification.
- Use small, reviewable changes and keep the application runnable throughout.
- When a requirement cannot be implemented without credentials or external account approval, implement the safe adapter/configuration/status path and identify the blocker accurately.

**Start now with Phase 0. Inspect the repository and make the actual changes.**
