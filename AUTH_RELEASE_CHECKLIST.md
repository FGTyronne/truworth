# TruWorth Auth release checklist

For the lean web launch, verify Supabase Auth URL Configuration for project `npfdkbqjoxolxxtmprmr`:

- Site URL: `https://truworth-web.onrender.com`
- Additional Redirect URL: `https://truworth-web.onrender.com/auth.html`
- During the migration window, keep the existing Vercel auth callback as an additional allowed redirect so older confirmation/recovery emails do not fail.

The web application derives its auth callback from the current browser origin, so the Render callback must be explicitly allowed by Supabase for signup confirmation and password recovery.

Release test cases:

1. New user signup -> confirmation email -> click confirmation -> branded `Email confirmed` screen -> account opens successfully on Render.
2. Re-click the same confirmation link -> friendly expired/used-link screen, never blank/null.
3. Forgot password -> email sent -> click newest recovery link -> password form loads -> mismatched passwords rejected -> valid password updates successfully.
4. Re-click used recovery link -> friendly expired/used-link screen.
5. Invalid/expired auth links -> `Request a new link` returns to `account.html` on the current production origin.
6. Confirmation/recovery URL must never point to localhost, a raw Supabase response page, or a missing route.

Supabase requires redirect destinations to be present in Auth URL Configuration. The code-side `redirectTo` alone is not sufficient if the hosted allow-list is wrong.

## Lean-launch security decision

Leaked-password protection is a paid Supabase feature and is intentionally deferred while TruWorth remains on the Free plan. This is an accepted lean-launch limitation, not a failed release test. Keep email confirmation enabled, use sensible password requirements/rate limits, and enable leaked-password protection when revenue justifies Supabase Pro.
