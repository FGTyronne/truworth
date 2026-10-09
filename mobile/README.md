# TruWorth Mobile MVP

This directory contains the native iOS/Android TruWorth MVP built with Expo and React Native. The existing web app remains at the repository root and continues to deploy independently to Vercel.

## MVP scope

The assessment model is intentionally limited to **physical consumer products**: technology, fashion, home products, beauty, fitness equipment, gaming products and similar goods. Travel, holidays, subscriptions and general services are deferred until they have scoring designed for those decisions.

## Data architecture

- Supabase/Postgres is the source of truth for signed-in assessments, purchase tracking, subscription status and account context.
- Supabase Row Level Security remains the authorization boundary for user records.
- The native Supabase auth session is stored with `expo-secure-store` through a chunked storage adapter. It is not written to AsyncStorage.
- Assessment history, financial context and subscription state are not persisted in ordinary device storage.
- Unsigned assessment results exist in React state only and disappear when the app process/session is discarded.
- Non-sensitive static artwork can be fetched from the TruWorth web CDN.

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

The current native MVP can read existing TruWorth subscription/trial entitlements and manage an active trial through the existing authenticated backend. Membership acquisition currently hands off to the existing TruWorth web membership page for internal MVP testing. App Store and Play Store production billing should be finalised as a dedicated release task rather than embedding a web checkout into a public store build.
