# TruWorth Auth release checklist

Before moving the staged patch to production, verify Supabase Auth URL Configuration for project `npfdkbqjoxolxxtmprmr`:

- Site URL: `https://truworth.vercel.app`
- Additional Redirect URL: `https://truworth.vercel.app/auth.html`

The application uses the exact callback above for both signup confirmation and password recovery.

Release test cases:

1. New user signup -> confirmation email -> click confirmation -> branded `Email confirmed` screen -> account opens successfully.
2. Re-click the same confirmation link -> friendly expired/used-link screen, never blank/null.
3. Forgot password -> email sent -> click newest recovery link -> password form loads -> mismatched passwords rejected -> valid password updates successfully.
4. Re-click used recovery link -> friendly expired/used-link screen.
5. Invalid/expired auth links -> `Request a new link` returns to `account.html`.
6. Confirmation/recovery URL must never point to localhost, a Supabase raw response page, or a missing Vercel route.

Supabase documentation requires redirect destinations to be present in Auth URL Configuration. The code-side `redirectTo` alone is not sufficient if the hosted allow-list is wrong.