# TruWorth launch checklist

## Already implemented
- Mobile-first manual purchase assessment flow.
- Guest-first usage; sign-in is not required for the first assessment.
- Supabase RLS on user-owned tables.
- Auth confirmation/recovery callback page.
- Private financial profile and currency mismatch controls.
- Buyer profile and premium insight entitlement logic.
- Server-gated TruWorth+ BUY / DON'T BUY vote.
- Self-service account deletion endpoint and UI.
- Privacy, Terms and Decision Support pages.

## Deferred features
- Camera/photo product recognition and related product lookup are intentionally removed from the current product. Reintroduce only after the commercial model, provider cost, privacy disclosure and rate limits are agreed.

## Must confirm before broad public launch
1. Supabase Auth > URL Configuration
   - Site URL: https://truworth.vercel.app (or final custom domain once connected)
   - Additional redirect URL: https://truworth.vercel.app/auth.html
   - Re-test signup confirmation and password recovery from a real mailbox.
2. Supabase Auth security
   - Enable leaked-password protection.
   - Keep email confirmation enabled.
   - Review Auth rate limits and consider CAPTCHA before a large traffic push.
3. Transactional email
   - Configure branded custom SMTP before a material public campaign.
   - Disable provider link tracking if it rewrites Supabase auth links.
4. Payments
   - Confirm Stripe checkout, portal/cancellation and signed webhook handling.
   - Webhook must update public.subscriptions; never trust client-side plan state.
   - Test renewals, cancellation, failed payment and refund paths.
5. Analytics / monitoring
   - Connect PostHog or another approved observability provider if required.
   - Add consent controls before enabling optional analytics where consent is required.
   - Keep financial-profile fields out of analytics payloads.
6. Domain / trust
   - Connect final TruWorth domain.
   - Update Supabase redirect URLs, legal pages and email branding to final domain.
7. Final production QA
   - iPhone Safari: 320/375/390/430 widths.
   - Android Chrome.
   - Guest assessment -> result -> signup -> email confirmation -> saved result -> second assessment -> compare -> purchase -> check-in -> insights -> currency mismatch -> password reset -> delete data -> delete account.
   - Test expired/used auth links and manual product-entry edge cases.
8. Legal review
   - Review Privacy, Terms and Decision Support wording before accepting paid subscriptions.
   - Update subscription wording once live pricing/cancellation mechanics are known.

## Cost-control principles
- Keep optional paid-provider features behind explicit usage limits and a commercial model.
- Keep deep premium analysis server-gated.
- Add budget/rate alerts before a marketing spike.
