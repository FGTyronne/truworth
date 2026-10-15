import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP = 'https://truworth-web.onrender.com';
const allowedOrigins = new Set([
  APP,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const TEMPLATE_DELETED = 'truworth-account-deleted';
const FROM = 'TruWorth <notifications@truworth.ramellacorporateconsulting.com>';

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : APP,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (keys?.default) return keys.default;
  } catch {}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(value);
}

async function cancelStripeSubscription(subscriptionId: string, secret: string) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': '2025-03-31.basil',
    },
  });
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  if (response.status === 404 && data?.error?.code === 'resource_missing') return;
  console.error('Stripe cancellation failed', response.status, data?.error?.type, data?.error?.code);
  throw new Error('Stripe cancellation failed');
}

async function sendDeletionEmail(apiKey: string, recipient: string, userId: string, billingNote: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `truworth/account-deleted/${userId}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [recipient],
      template: {
        id: TEMPLATE_DELETED,
        variables: {
          BILLING_NOTE: billingNote,
          DELETION_DATE: formatDate(new Date()),
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${data?.message || data?.name || 'send failed'}`);
  return data?.id || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { error: 'Method not allowed' }, 405);

  const origin = req.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) return reply(req, { error: 'Origin not allowed' }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') return reply(req, { error: 'Explicit confirmation required' }, 400);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return reply(req, { error: 'Authentication required' }, 401);

    const url = Deno.env.get('SUPABASE_URL') || '';
    let publishable = '';
    try { publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')?.default || ''; } catch {}
    publishable = publishable || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const secretKey = adminKey();
    if (!url || !publishable || !secretKey) throw new Error('Server configuration unavailable');

    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return reply(req, { error: 'Invalid session' }, 401);

    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: subscription, error: subscriptionError } = await admin
      .from('subscriptions')
      .select('provider, provider_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    let billingNote = 'There was no active TruWorth+ subscription to cancel.';
    if (subscription?.provider === 'stripe' && subscription.provider_subscription_id && subscription.status !== 'canceled') {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
      if (!stripeSecret) return reply(req, { error: 'We could not safely stop billing before deleting the account.' }, 503);
      try {
        await cancelStripeSubscription(subscription.provider_subscription_id, stripeSecret);
        billingNote = 'Your TruWorth+ subscription was cancelled as part of the account closure, so no further renewal payments will be taken.';
      } catch {
        return reply(req, { error: 'We could not stop the subscription, so your account was not deleted. Please try again.' }, 502);
      }
    }

    const email = user.email || '';
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    if (resendKey && email) {
      try {
        const emailId = await sendDeletionEmail(resendKey, email, user.id, billingNote);
        const { error: logError } = await admin.from('email_delivery_log').insert({
          user_id: user.id,
          email_type: 'account_deleted',
          reference_key: 'account-deleted',
          provider_email_id: emailId,
          metadata: { template: TEMPLATE_DELETED },
        });
        if (logError && logError.code !== '23505') console.warn('Deletion email ledger failed', logError);
      } catch (emailError) {
        console.warn('Account deleted but confirmation email failed', user.id, emailError);
      }
    } else {
      console.warn('Account deleted without confirmation email because Resend or recipient is unavailable', user.id);
    }

    return reply(req, { deleted: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return reply(req, { error: 'We could not delete the account. Please try again.' }, 500);
  }
});