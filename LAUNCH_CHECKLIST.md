# TruWorth launch checklist

## Already implemented
- Mobile-first assessment and Snap & Assess flow.
- Guest-first usage; sign-in is not required for the first assessment.
- Supabase RLS on user-owned tables.
- Auth confirmation/recovery callback page.
- Private financial profile and currency mismatch controls.
- Buyer profile and premium insight entitlement logic.
- Server-gated TruWorth+ BUY / DON'T BUY vote.
- Self-service account deletion endpoint and UI.
- Privacy, Terms and Decision Support pages.

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
   - Connect Stripe.
   - Create TruWorth+ product/price.
   - Implement checkout, customer portal/cancellation and signed webhook handling.
   - Webhook must update public.subscriptions; never trust client-side plan state.
   - Test renewals, cancellation, failed payment and refund paths.
5. Analytics / monitoring
   - Connect PostHog or another approved observability provider.
   - Add consent controls before enabling optional analytics where consent is required.
   - Keep financial-profile fields and raw camera images out of analytics payloads.
6. Domain / trust
   - Connect final TruWorth domain.
   - Update Supabase redirect URLs, legal pages and email branding to final domain.
7. Final production QA
   - iPhone Safari: 320/375/390/430 widths.
   - Android Chrome.
   - Guest assessment -> Snap -> result -> signup -> email confirmation -> saved result -> second assessment -> compare -> purchase -> check-in -> insights -> currency mismatch -> password reset -> delete data -> delete account.
   - Test expired/used auth links and product lookup failures.
8. Legal review
   - Review Privacy, Terms and Decision Support wording before accepting paid subscriptions.
   - Update subscription wording once live pricing/cancellation mechanics are known.

## Cost-control principles
- Prefer on-device barcode/OCR before paid recognition.
- Reject low-confidence product matches instead of creating support work.
- Do not retain raw camera images unless a future feature has a clear reason and disclosure.
- Keep deep premium analysis server-gated.
- Add budget/rate alerts before a marketing spike.
