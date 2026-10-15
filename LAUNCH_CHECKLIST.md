# TruWorth launch checklist

## Launch model
- Phase 1 is a lean web-first commercial launch on `https://truworth-web.onrender.com`.
- GitHub `main` is the code source of truth. Render serves the production web frontend. Supabase provides auth, data and Edge Functions. Stripe provides billing. Resend provides transactional email.
- Vercel is legacy/redirect compatibility, not the canonical production website.
- Native iOS/Android public distribution remains Phase 2.
- Recommendation logic and commercial relationships remain separated. Sponsorship, affiliate compensation or partner status must never increase a TruWorth score or cause a BUY outcome.

## Current access and entitlement model
- Guest: up to 3 completed product assessments per UTC day, enforced server-side using a one-way hashed IP-derived quota key. Raw IP addresses are not stored in the quota table.
- Free account: unlimited product assessments/searches, with up to 5 products saved at one time.
- At the Free 5-product limit, users may continue assessing products; additional results are temporary until a saved product is removed or the user upgrades.
- TruWorth+: unlimited assessments and saved history, personalised Decision Profile support, BUY / WAIT / SKIP / NEITHER decision guidance, premium insights and Member Benefits.
- The 5-product Free save allowance is a current commercial setting and may be reduced later.

## Already implemented
- Mobile-first purchase assessment flow and product-link import.
- Guest assessment flow without mandatory signup before first use.
- Server-side guest daily assessment quota.
- Supabase RLS on user-owned tables and service-role-only guest quota storage.
- Auth confirmation/recovery callback page.
- Private financial profile, behavioural Decision Profile and explicit recommendation consent controls.
- Currency mismatch and missing-price blocks for personalised recommendations.
- Server-gated TruWorth+ recommendation logic with protected weights/thresholds.
- Free 5-saved-product database enforcement plus frontend temporary-result handling.
- Self-service account deletion endpoint and UI, including Stripe cancellation handling before account closure.
- Privacy, Terms, Cookies, Security and Decision Support pages.
- Member Benefits surface split between TruWorth Originals and future verified Partner Benefits.
- Light Free-tier house/partner placement framework, with TruWorth+ ad-free and no placement inside the recommendation itself.
- Render static-site production host using `bash render-build.sh`.
- Root `/security.txt` plus `/.well-known/security.txt` publication through the Render build.
- Stripe Checkout, portal and signed webhook functions pointing users back to Render.
- Stripe webhook idempotency ledger and server-side subscription-state updates.
- SEO launch layer: canonical metadata, sitemap, robots rules, structured data and public acquisition pages.
- Personal/account surfaces are `noindex` and blocked from crawler discovery where appropriate.
- Mobile bottom navigation and footer navigation stabilization layer.

## Technical checks completed during launch hardening
- Current Render service is healthy and recent production builds/deploys completed successfully with no Render failure events found in the launch window.
- `robots.txt` and `sitemap.xml` exist in the production build source and use the Render canonical host.
- Supabase Edge Functions are active, including `import-product`, `purchase-vote`, `buyer-insights`, `stripe-checkout`, `stripe-portal`, `stripe-webhook`, `delete-account`, `trial-action`, `renewal-reminders` and `guest-assessment-quota`.
- `stripe-webhook` verifies Stripe signatures with a five-minute tolerance, records event IDs for idempotency and updates `public.subscriptions` server-side.
- Supabase security advisor currently reports leaked-password protection as disabled. This is an accepted Free-tier limitation for the lean launch and should be enabled when the account moves to a plan that supports it.
- Supabase also reports the guest quota table has RLS enabled with no user policy; this is intentional because anon/authenticated roles are revoked and access is service-role-only.

## Must confirm before public launch
1. Supabase Auth URL configuration
   - Site URL: `https://truworth-web.onrender.com` until the branded domain replaces it.
   - Redirect URL includes `https://truworth-web.onrender.com/auth.html`.
   - Re-test signup confirmation and password recovery from a real mailbox.
2. Transactional email
   - Verify signup confirmation, password recovery, trial start, cancellation, final-24h reminder, payment-failure and account-deletion emails using real mailboxes.
   - Avoid link tracking that rewrites authentication links.
3. Payments
   - Complete one real low-value/live Stripe subscription test, including 3-day trial eligibility, successful return, portal access, cancellation and webhook-driven subscription state.
   - Test cancellation before first trial charge and at least one failure/edge path.
4. Search and domain
   - Add the final production domain to Render when selected.
   - Replace Render canonical URLs, OG URLs, sitemap and security.txt canonical with the branded domain at cutover.
   - Add the production property to Google Search Console and submit the sitemap.
5. Final device QA
   - iPhone Safari and Android Chrome.
   - Guest assessment 1–3 -> fourth attempt gate -> signup -> email confirmation -> guest-history migration -> Free unlimited assessments -> five saved products -> sixth temporary result -> delete one -> save again -> compare -> mark purchased -> check-in -> insights -> password reset -> Plus trial -> personalised recommendation -> cancellation -> account deletion.
   - Test expired/used auth links, missing prices, currency mismatch, bad import URLs and manual-entry edge cases.
6. Legal/commercial exactness
   - Confirm registered-office/controller details, practical retention periods, processor/subprocessor wording, cancellation/refund wording and final affiliate/sponsored disclosure before material paid marketing.

## Assistant launch-hardening lane
These can be completed without waiting for domain/DNS or a real payment card:
- remove stale entitlement copy and contradictory old limits from loaded source files;
- audit canonical/SEO/noindex/robots/sitemap consistency;
- audit current Render deploy health and Supabase security/function status;
- tighten legacy Vercel references where they are no longer required without breaking native/development flows;
- review public legal/decision-support consistency against the actual product behaviour;
- review import, recommendation and navigation failure handling;
- maintain this checklist as the release source of truth.

## Owner-dependent launch lane
These require account decisions, real-world verification or credentials/actions outside code:
- choose/connect the branded domain and DNS;
- perform real mailbox auth/email tests;
- perform the live Stripe purchase/refund/cancellation test;
- add/verify Google Search Console property;
- perform physical iPhone/Android QA;
- confirm company/legal particulars that should appear publicly.

## Deferred until after initial validation
- Native app-store distribution and store-compliant billing.
- Paid acquisition until conversion economics are understood.
- Google/third-party advertising until an appropriate UK/EEA consent/CMP implementation is in place.
- Affiliate monetisation at scale until partner governance and traffic justify it.
- Supabase Pro operational/security upgrades where not available on the current plan.

## Cost-control principles
- Keep fixed launch infrastructure lean while validating demand.
- Keep optional paid-provider features behind explicit usage limits and a commercial model.
- Keep premium recommendation logic server-gated.
- Add budget/rate alerts before a marketing spike.
