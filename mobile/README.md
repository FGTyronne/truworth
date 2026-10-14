# TruWorth Mobile MVP

This directory contains the native iOS/Android TruWorth MVP built with Expo and React Native. The production web app is served from `https://truworth-web.onrender.com`; Render is the canonical web host. Vercel is legacy infrastructure and must not be treated as the public source of truth for the web product.

## MVP scope

The assessment model is intentionally limited to **physical consumer products**: technology, fashion, home products, beauty, fitness equipment, gaming products and similar goods.

## Data architecture

- Supabase/Postgres is the source of truth for signed-in assessments, purchase tracking, subscription status and account context.
- Supabase Row Level Security remains the authorization boundary for user records.
- The native Supabase auth session is stored with `expo-secure-store` through a chunked storage adapter. It is not written to AsyncStorage.
- Assessment history, financial context and subscription state are not persisted in ordinary device storage.
- Unsigned assessment results exist in React state only and disappear when the app process/session is discarded.
- Non-sensitive static artwork can be fetched from the canonical TruWorth web host.

## Run locally

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Use a development build for final device QA before store submission.

## Native MVP screens

- Home
- Assess
- Result
- Library
- Insights
- Account/authentication
- 3-day trial final-day notice and review/cancellation flow

The native app uses the same score version (`truworth-v1.1`) and formula as the web MVP.

## Billing note before public store release

The current native MVP can read existing TruWorth subscription/trial entitlements and manage an active trial through the existing authenticated backend. Membership acquisition currently hands off to the TruWorth web membership page for internal MVP testing. App Store and Play Store production billing should be finalised as a dedicated release task rather than embedding a web checkout into a public store build.
