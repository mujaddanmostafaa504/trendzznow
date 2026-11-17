# TrendzzNow implementation checklist

Use this alongside `MASTER_IMPLEMENTATION_PROMPT.md`. Do not mark an item complete until implemented and tested.

## Phase 0 — Audit and preservation
- [ ] Inspect all source files, routes, views, CSS, package files and deployment files.
- [ ] Record existing UI sections, settings, product/order columns and current behavior.
- [ ] Back up current source and make a staging database copy before migrations.
- [ ] Confirm production DB schema and Supabase RLS policies.
- [ ] Preserve branding, existing orders/products/settings and the single existing FAQ block.
- [ ] Never execute the destructive legacy SQL as supplied.

## P0 — Security and correctness
- [ ] Remove `admin123` and all hard-coded session secrets.
- [ ] Add secure owner bootstrap and password hashing.
- [ ] Add secure session cookies, rotation, expiry and logout invalidation.
- [ ] Add rate limiting, CSRF, secure headers and audit logs.
- [ ] Implement real staff roles/permissions and server-side checks.
- [ ] Secure order lookup using OTP/account/token verification.
- [ ] Recalculate product price, discounts, delivery and totals on the server.
- [ ] Add transaction-safe inventory reservation/decrement and idempotency.
- [ ] Validate image uploads and escape email content.
- [ ] Use HTTPS for provider API requests.
- [ ] Replace error-driven schema mutation with explicit migrations.

## P1 — Storefront and commerce foundations
- [ ] Keep top-left hamburger menu; improve keyboard/mobile accessibility.
- [ ] Keep admin completely absent from customer-facing UI and metadata.
- [ ] Build managed category/subcategory taxonomy and professional category pages.
- [ ] Add server-side search, facets, sorting and pagination.
- [ ] Add robust products, variants, images, SKU and inventory management.
- [ ] Add multi-item cart and guest checkout.
- [ ] Add customer profiles/addresses and secure order history/tracking.
- [ ] Add coupon/promotion rule engine.
- [ ] Add verified review moderation and wishlist/compare where useful.
- [ ] Preserve the existing single FAQ block and all existing Q&A.
- [ ] Keep delivery/courier/payment information in the footer area.
- [ ] Make all approved content and storefront settings editable in admin.
- [ ] Add draft, preview, publish, version history and audit trail.

## P2 — Integrations and social
- [ ] Add payment gateway adapters and sandbox tests.
- [ ] Add courier adapters for enabled providers and manual fallback.
- [ ] Add signed webhook verification, retries and idempotency.
- [ ] Add editable social profile links; verify every destination.
- [ ] Add share, WhatsApp share, Web Share and Copy Link actions.
- [ ] Add server-rendered Open Graph/Twitter metadata and product structured data.
- [ ] Add secure product URL paste/preview/import for admins (SSRF protected).
- [ ] Add event-driven trending products; remove fabricated metrics.

## P3 — AI and analytics
- [ ] Add bilingual store-grounded customer chat.
- [ ] Add approved knowledge sources and freshness/version controls.
- [ ] Add safe read-only verified order lookup.
- [ ] Add prompt-injection defense, PII/PCI redaction and consent.
- [ ] Add human handoff and an admin support inbox.
- [ ] Add editable AI tone, welcome, language, knowledge and handoff controls.
- [ ] Add privacy-aware ecommerce funnel analytics and admin reports.

## Quality and release
- [ ] Unit/integration/E2E tests for all critical flows.
- [ ] Accessibility and responsive tests.
- [ ] Security tests for roles, CSRF, auth, tracking, uploads, SSRF and webhooks.
- [ ] Dependency audit, lint, formatting and runtime checks.
- [ ] Migration run against a staging copy; verify backup/restore.
- [ ] `.env.example`, README, SECURITY.md and implementation status report.
- [ ] No dead controls, fake data, placeholder integrations or undocumented limitations.
