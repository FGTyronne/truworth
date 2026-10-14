# TruWorth launch checklist

## Launch model
- Phase 1 is a lean web-first commercial launch on `https://truworth-web.onrender.com`.
- Native iOS/Android distribution is Phase 2 and will be funded once revenue justifies store fees and native billing work.
- GitHub remains the code source of truth. Render serves the commercial web frontend. Supabase provides auth/data/functions. Stripe provides billing. Resend provides transactional email.
- Advertising is prepared but disabled until a real publisher account and consent configuration are approved. TruWorth+ remains ad-free and advertising must never change a TruWorth score.

## Already implemented
- Mobile-first manual purchase assessment flow.
- Guest-first usage; sign-in is not required for the first assessment.
- Supabase RLS on user-owned tables.
- Auth confirmation/recovery callback page.
- Private financial profile and currency mismatch controls.
- Buyer profile and premium insight entitlement logic.
- Server-gated TruWorth+ BUY / DON'T BUY vote.
- Self-service account deletion endpoint and UI, including safe Stripe cancellation handling before account closure.
- Privacy, Terms and Decision Support pages.
- Render static-site production host and Render origin support across browser-facing Edge Functions.
- Stripe checkout, billing portal and lifecycle email account links point to the Render web launch.
- SEO launch layer: canonical metadata, sitemap, robots rules, structured data and public acquisition pages.
- Ad-ready Free-tier framework that remains hard-disabled until publisher configuration and consent are present.
- Production Render browser certification passed at 320/390/430 px, including guest Assessment -> Result -> reload -> Library, calculator, acquisition pages, crawler files and Edge Function CORS.

## Deferred features
- Camera/photo product recognition and related product lookup are intentionally removed from the current product. Reintroduce only after the commercial model, provider cost, privacy disclosure and rate limits are agreed.
- Native app public distribution and native store billing are deferred to Phase 2.
- Supabase leaked-password protection is intentionally deferred while using the Free plan. Enable it when revenue justifies Supabase Pro.
- Paid advertising and affiliate integrations remain deferred until traffic and compliance controls justify activation.

## Must confirm before lean public launch
1. Supabase Auth > URL Configuration
   - Site URL: `https://truworth-web.onrender.com`
   - Additional redirect URL: `https://truworth-web.onrender.com/auth.html`
   - Keep the former Vercel callback temporarily as an additional allowed redirect during migration.
   - Re-test signup confirmation and password recovery from a real mailbox.
2. Supabase Auth security
   - Keep email confirmation enabled.
   - Review Auth rate limits and use CAPTCHA if abuse appears or before a large traffic push.
   - Leaked-password protection is an accepted Free-tier limitation for the lean launch, not a launch blocker.
3. Transactional email
   - Verify signup confirmation, password recovery, trial-start, cancellation, final-24h trial reminder and account-deletion emails from real mailboxes.
   - Avoid link tracking that rewrites authentication links.
4. Payments
   - Confirm real Stripe checkout, trial, return-to-Render, portal/cancellation and signed webhook handling.
   - Webhook must update `public.subscriptions`; never trust client-side plan state.
   - Test cancellation before first trial charge and at least one failure/edge path before a wider marketing push.
5. Search / acquisition
   - Confirm `robots.txt` and `sitemap.xml` remain reachable on Render.
   - Add the production property to Google Search Console and submit the sitemap when ready.
   - Keep personal app surfaces out of search indexing.
6. Advertising
   - Keep ads disabled until an approved publisher ID and legally appropriate consent mechanism are configured.
   - Never place sponsored inventory inside the assessment questions or allow it to influence scoring.
   - TruWorth+ remains ad-free.
7. Final human production QA
   - iPhone Safari and Android Chrome.
   - Guest assessment -> result -> signup -> email confirmation -> saved result -> second assessment -> compare -> purchase -> check-in -> insights -> currency mismatch -> password reset -> trial -> cancellation -> delete data -> delete account.
   - Test expired/used auth links and manual product-entry edge cases.
8. Legal / commercial review
   - Review Privacy, Terms and Decision Support wording before a material paid marketing campaign.
   - Revisit legal/consent wording before activating advertising or affiliate links.

## Later upgrades funded by revenue
- Custom TruWorth domain.
- Supabase Pro, including leaked-password protection and stronger operational resilience.
- Native app-store accounts and store-compliant billing.
- Paid acquisition only after conversion economics are understood.
- Advertising/affiliate monetisation after meaningful free-user traffic exists.

## Cost-control principles
- Keep fixed launch infrastructure close to £0 while validating demand.
- Keep optional paid-provider features behind explicit usage limits and a commercial model.
- Keep deep premium analysis server-gated.
- Add budget/rate alerts before a marketing spike.
