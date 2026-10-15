# TruWorth launch checklist

## Launch model
- Phase 1 is a lean web-first commercial launch on `https://truworth-web.onrender.com` until a branded domain is connected.
- GitHub `main` is the code source of truth. Render serves the production web frontend. Supabase provides auth, data and Edge Functions. Stripe provides billing. Resend provides transactional email.
- Vercel is legacy redirect compatibility only, not the canonical production website.
- Native iOS/Android public distribution remains Phase 2.
- Recommendation logic and commercial relationships remain separate. Sponsorship, affiliate compensation or partner status must never increase a TruWorth score or cause a BUY outcome.

## Current access and entitlement model
- Guest: up to 3 completed product assessments per UTC day, enforced server-side using a one-way keyed hash derived from the connecting IP. Raw IP addresses are not stored in the quota table.
- Free account: unlimited product assessments/searches, with up to 5 products saved at one time.
- At the Free 5-product limit, users may continue assessing products; additional results are temporary until a saved product is removed or the user upgrades.
- TruWorth+: unlimited assessments and saved history, personalised Decision Profile support, BUY / WAIT / SKIP / NEITHER decision guidance, premium insights and Member Benefits.
- The 5-product Free allowance is a current commercial setting and may be reduced later.

## Autonomous launch-hardening completed
- Guest assessment flow and server-side 3/day quota.
- Free unlimited assessment model with database-enforced 5-saved-product cap and temporary-result handling at capacity.
- Auth confirmation/recovery callback hardening and account deletion flow.
- Financial profile, behavioural Decision Profile and explicit personalised-recommendation consent.
- Server-gated Plus recommendation logic with protected weights/thresholds, missing-price block and currency-mismatch block.
- Decision outcome regression coverage for BUY / WAIT / SKIP / NEITHER combinations.
- Product importer with SSRF/private-network protection, response-size/redirect limits, price provenance, variant handling and `exact / starting / sale / monthly / unknown` price classification with confidence.
- Factor-based “What would change TruWorth’s mind?” explanation surface without allowing AI to override the deterministic result.
- Accessibility/failure-state hardening including skip navigation, focus-visible behaviour, reduced-motion handling, offline messaging and clearer product-import evidence.
- Mobile bottom navigation/footer stabilisation.
- Privacy, Terms, Cookies, Security, Decision Support and Commercial & Affiliate Disclosure pages aligned to the current product architecture.
- Consent version refreshed for live optional partner-campaign measurement; existing users must make a fresh optional-marketing choice.
- TruWorth+ remains ad-free. Commercial placements remain outside the personalised recommendation surface and are excluded from account/settings/plans/assessment pages.
- Partner enquiry form with server validation, honeypot, short-window/daily abuse controls, keyed IP hash and Resend notification path.
- Commercial backend tables for partner relationships, Member Benefits, campaigns and privacy-conscious impression/click events.
- Commercial event telemetry now has keyed visitor hashing, session-level impression deduplication and abuse-rate budgets to reduce analytics poisoning.
- Private partner/commercial admin dashboard with enquiry pipeline, active partner/benefit/campaign counts and 30-day impression/click/CTR reporting.
- Partner administration remains JWT-protected and additionally gated by the service-role-only `app_admins` list.
- User-owned Supabase tables have explicit authenticated grants plus owner-scoped RLS. Internal/commercial tables are service-role-only.
- Public `SECURITY DEFINER` functions were audited; normal anon/authenticated roles cannot execute the internal bootstrap or guest-quota RPC.
- Current browser-facing Edge Function origins are Render plus local development where appropriate; Vercel is no longer an active browser origin for the current production functions reviewed.
- `purchase-vote`, Stripe Checkout, commercial telemetry and partner admin deployed from current repository source.
- Render build publishes root and `/.well-known/security.txt` security contacts.
- Render build emits `release.txt` containing the exact Git commit used for the production artifact.
- Every Render build rewrites app-shell `app.js` and `app.css` URLs with the current release SHA to prevent stale-loader/browser-cache regressions.
- Static CI validates local references, private-page `noindex`, canonical/SEO integrity, security files, active runtime scripts, hardened auth callbacks, no legacy public Vercel URLs and no superseded 10-product Free entitlement copy.
- CI additionally protects guest/Free/Plus entitlement rules, decision gates, importer security/classification, consent, commercial independence, telemetry anti-abuse controls and private admin boundaries.
- Scheduled production smoke test checks critical Render routes/assets, `release.txt` parity, robots/sitemap and the standard security.txt endpoint every six hours, with manual dispatch support.
- Render production was manually reconciled after unreliable Git auto-deploy behaviour and is serving the final hardening commit recorded below.

## Current verified production state
- Final hardening head at verification: `0a83db919937ba905a0ac3641fe573f89f2c9849`.
- Web static smoke CI run for that SHA: successful.
- Render deploy `dep-db8gnpe7bikc73e2qlv0`: live on the same SHA.
- `commercial-event`: ACTIVE v2, public only by design, origin constrained, hashed visitor/session controls, server-side campaign validation and rate limiting.
- `partner-admin`: ACTIVE v2, JWT verified and app-admin gated.
- `purchase-vote`: ACTIVE v12, JWT verified.
- `stripe-checkout`: ACTIVE v9, JWT verified.
- `import-product`: ACTIVE v7, JWT verified.
- Recent reviewed Supabase Edge Function telemetry showed no recorded 4xx/5xx responses in the examined launch window.

## Security/advisor position
- Supabase advisor reports RLS-without-policy INFO notices on internal service-role-only tables. This is intentional: anon/authenticated direct table grants are revoked, and public access goes through constrained Edge Functions rather than direct Data API table access.
- Supabase advisor still reports leaked-password protection disabled. Enable it if/when the project plan/account permits or exposes the setting.
- Performance advisor currently reports unused-index INFO notices only. Do not remove launch indexes until real traffic/query history provides evidence.
- Render Git auto-deploy is configured but was unreliable during hardening. The scheduled `Production smoke` workflow now detects source/production SHA drift; the underlying Render-Git webhook/integration should still be reconnected in the Render dashboard if drift recurs.

## Owner-dependent launch actions still required
1. **Branded domain and DNS**
   - Select/connect the final TruWorth domain to Render.
   - At cutover, replace Render-host canonical/OG/sitemap/security URLs with the branded domain and update Supabase auth redirects.

2. **Real mailbox authentication/email QA**
   - Complete signup confirmation and password recovery through a real inbox.
   - Verify welcome, trial/cancellation/reminder/payment-failure/account-deletion emails as applicable.
   - Confirm auth links are not rewritten by email tracking.

3. **Real Stripe lifecycle QA**
   - Perform one genuine low-value/live subscription transaction using a real payment method.
   - Verify 3-day trial eligibility, Plus unlock, successful return, webhook state, portal access, cancellation and at least one cancellation/failure edge path.
   - Refund/reconcile the test transaction if appropriate.

4. **Final public company/legal particulars**
   - Confirm the registered-office/contact particulars you want published.
   - Confirm ICO registration/reference if applicable.
   - Make the final owner decision on refund/cancellation wording and any additional retention commitments.

5. **Search launch**
   - Add/verify the final production property in Google Search Console.
   - Submit the sitemap after domain cutover.

6. **Physical-device QA**
   - Test iPhone Safari and Android Chrome with real touch/keyboard/browser behaviour.
   - Run guest -> fourth-attempt gate -> signup -> Free -> five saved -> temporary sixth result -> delete/save -> Plus trial -> personalised recommendation -> cancellation/account-deletion journeys.

7. **Render Git integration**
   - If scheduled production parity monitoring reports drift again, reconnect/repair the GitHub integration/webhook in the Render dashboard. The connector available to ChatGPT does not expose that control.

## Deferred until after web validation
- Native app-store distribution and store-compliant billing.
- Direct migration of the remaining native `mobile/App.tsx` legacy Vercel constants once a full-file-safe editing path is available; legacy URLs currently redirect to Render.
- Paid acquisition at scale until conversion economics are known.
- Google/third-party ad networks until any provider-specific UK/EEA CMP/IAB requirements are satisfied.
- Affiliate monetisation at scale until live partner inventory and traffic justify it.

## Cost-control principles
- Keep fixed launch infrastructure lean while validating demand.
- Keep optional paid-provider features behind explicit usage limits and a commercial model.
- Keep premium recommendation logic server-gated.
- Add budget/rate alerts before a marketing spike.
