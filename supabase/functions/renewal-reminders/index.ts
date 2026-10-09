import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const TEMPLATE_RENEWAL = 'truworth-renewal-reminder';
const TEMPLATE_TRIAL_ENDING = 'truworth-trial-ending-reminder';
const FROM = 'TruWorth <notifications@truworth.ramellacorporateconsulting.com>';
const MANAGE_URL = 'https://truworth.vercel.app/account.html';
const AUTOMATION_SECRET_NAME = 'truworth_automation_secret';

function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (keys?.default) return keys.default;
  } catch {}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function authenticate(req: Request, admin: ReturnType<typeof createClient>) {
  const supplied = req.headers.get('x-truworth-automation-secret') || '';
  if (!supplied) return false;
  const { data, error } = await admin
    .from('automation_secrets')
    .select('secret_hash')
    .eq('name', AUTOMATION_SECRET_NAME)
    .maybeSingle();
  if (error || !data?.secret_hash) return false;
  return safeEq(await sha256(supplied), data.secret_hash);
}

async function stripeGet(path: string, secret: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-03-31.basil' },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${data?.error?.code || data?.error?.type || 'request_failed'}`);
  return data;
}

async function probeStripe(secret: string) {
  if (!secret) return false;
  const r = await fetch('https://api.stripe.com/v1/account', {
    headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-03-31.basil' },
  });
  return r.ok;
}

async function probeResend(apiKey: string) {
  if (!apiKey) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return r.status !== 401 && r.status !== 403;
}

function formatMoney(amountMinor: number, currency: string) {
  const code = String(currency || 'GBP').toUpperCase();
  const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: code });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amountMinor / Math.pow(10, digits));
}

function formatDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value));
}

async function sendTemplate(apiKey: string, to: string, templateId: string, variables: Record<string, string>, idempotencyKey: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      template: { id: templateId, variables },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${data?.message || data?.name || 'send failed'}`);
  return data?.id || null;
}

async function deliveryExists(admin: ReturnType<typeof createClient>, userId: string, emailType: string, referenceKey: string) {
  const { data, error } = await admin
    .from('email_delivery_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .eq('reference_key', referenceKey)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function logDelivery(admin: ReturnType<typeof createClient>, userId: string, emailType: string, referenceKey: string, providerEmailId: string | null, metadata: Record<string, unknown>) {
  const { error } = await admin.from('email_delivery_log').insert({
    user_id: userId,
    email_type: emailType,
    reference_key: referenceKey,
    provider_email_id: providerEmailId,
    metadata,
  });
  if (error && error.code !== '23505') throw error;
}

async function getRecipient(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    if ((error as any)?.status === 404) return null;
    throw error || new Error('Recipient unavailable');
  }
  return data.user.email;
}

async function resolvePlan(sub: any, fallbackPriceId: string | null, stripeSecret: string) {
  const item = sub.items?.data?.[0];
  let price: any = item?.price || null;
  if (typeof price === 'string') price = await stripeGet(`prices/${encodeURIComponent(price)}`, stripeSecret);
  if (!price?.id && fallbackPriceId) price = await stripeGet(`prices/${encodeURIComponent(fallbackPriceId)}`, stripeSecret);
  const amountMinor = Number(price?.unit_amount ?? 0);
  const currency = String(price?.currency || 'gbp');
  const interval = String(price?.recurring?.interval || item?.price?.recurring?.interval || 'month');
  return {
    item,
    amount: formatMoney(amountMinor, currency),
    planName: interval === 'year' ? 'TruWorth+ Annual' : 'TruWorth+ Monthly',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = adminKey();
  if (!url || !key) return response({ error: 'Server configuration unavailable' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await authenticate(req, admin))) return response({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';

  if (body?.healthcheck === true) {
    const [resendValid, stripeValid] = await Promise.all([
      probeResend(resendKey),
      probeStripe(stripeSecret),
    ]);
    return response({
      ok: resendValid && stripeValid,
      resend_configured: Boolean(resendKey),
      resend_valid: resendValid,
      stripe_configured: Boolean(stripeSecret),
      stripe_valid: stripeValid,
      trial_ending_template: TEMPLATE_TRIAL_ENDING,
    }, resendValid && stripeValid ? 200 : 503);
  }

  if (!resendKey || !stripeSecret) return response({ error: 'Reminder delivery not configured' }, 503);

  const results: Array<Record<string, unknown>> = [];
  let failed = 0;
  const now = new Date();
  const trialCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: trialDue, error: trialDueError } = await admin
    .from('subscriptions')
    .select('user_id, provider_subscription_id, provider_price_id, trial_end')
    .eq('provider', 'stripe')
    .eq('status', 'trialing')
    .eq('cancel_at_period_end', false)
    .not('provider_subscription_id', 'is', null)
    .not('trial_end', 'is', null)
    .gt('trial_end', now.toISOString())
    .lte('trial_end', trialCutoff.toISOString());

  if (trialDueError) {
    console.error('trial reminder query failed', trialDueError);
    return response({ error: 'Trial reminder query failed' }, 500);
  }

  for (const row of trialDue || []) {
    const userId = row.user_id as string;
    const subscriptionId = row.provider_subscription_id as string;
    const referenceKey = `${subscriptionId}:${row.trial_end}`;
    try {
      if (await deliveryExists(admin, userId, 'trial_ending_reminder', referenceKey)) {
        results.push({ kind: 'trial_ending', user_id: userId, status: 'deduplicated' });
        continue;
      }

      const sub: any = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecret);
      if (String(sub.status) !== 'trialing' || Boolean(sub.cancel_at_period_end) || !sub.trial_end) {
        results.push({ kind: 'trial_ending', user_id: userId, status: 'no_longer_due' });
        continue;
      }

      const trialEnd = new Date(Number(sub.trial_end) * 1000);
      const remaining = trialEnd.getTime() - Date.now();
      if (remaining <= 0 || remaining > 24 * 60 * 60 * 1000) {
        results.push({ kind: 'trial_ending', user_id: userId, status: 'trial_changed' });
        continue;
      }

      const rowTrialEnd = new Date(row.trial_end as string);
      if (Math.abs(rowTrialEnd.getTime() - trialEnd.getTime()) > 1000) {
        results.push({ kind: 'trial_ending', user_id: userId, status: 'trial_changed' });
        continue;
      }

      const recipient = await getRecipient(admin, userId);
      if (!recipient) {
        results.push({ kind: 'trial_ending', user_id: userId, status: 'user_missing' });
        continue;
      }
      const plan = await resolvePlan(sub, row.provider_price_id as string | null, stripeSecret);
      const emailId = await sendTemplate(
        resendKey,
        recipient,
        TEMPLATE_TRIAL_ENDING,
        {
          PLAN_NAME: plan.planName,
          AMOUNT: plan.amount,
          TRIAL_END_DATE: formatDateTime(trialEnd),
          MANAGE_URL,
        },
        `truworth/trial-ending/${subscriptionId}/${trialEnd.toISOString()}`,
      );
      await logDelivery(admin, userId, 'trial_ending_reminder', referenceKey, emailId, {
        template: TEMPLATE_TRIAL_ENDING,
        subscription_id: subscriptionId,
        trial_end: trialEnd.toISOString(),
      });
      results.push({ kind: 'trial_ending', user_id: userId, status: 'sent' });
    } catch (error) {
      failed++;
      console.error('trial ending reminder failed', userId, subscriptionId, error);
      results.push({ kind: 'trial_ending', user_id: userId, status: 'failed' });
    }
  }

  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5));
  const next = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1));

  const { data: due, error: dueError } = await admin
    .from('subscriptions')
    .select('user_id, provider_subscription_id, provider_price_id, current_period_end')
    .eq('provider', 'stripe')
    .in('status', ['active', 'trialing'])
    .eq('cancel_at_period_end', false)
    .not('provider_subscription_id', 'is', null)
    .gte('current_period_end', target.toISOString())
    .lt('current_period_end', next.toISOString());

  if (dueError) {
    console.error('renewal query failed', dueError);
    return response({ error: 'Subscription query failed' }, 500);
  }

  for (const row of due || []) {
    const userId = row.user_id as string;
    const subscriptionId = row.provider_subscription_id as string;
    const referenceKey = `${subscriptionId}:${row.current_period_end}`;
    try {
      if (await deliveryExists(admin, userId, 'renewal_reminder', referenceKey)) {
        results.push({ kind: 'renewal', user_id: userId, status: 'deduplicated' });
        continue;
      }

      const sub: any = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecret);
      if (!['active', 'trialing'].includes(String(sub.status)) || Boolean(sub.cancel_at_period_end)) {
        results.push({ kind: 'renewal', user_id: userId, status: 'no_longer_due' });
        continue;
      }
      const plan = await resolvePlan(sub, row.provider_price_id as string | null, stripeSecret);
      const periodEnd = plan.item?.current_period_end || row.current_period_end;
      const periodDate = new Date(typeof periodEnd === 'number' ? periodEnd * 1000 : periodEnd);
      if (periodDate < target || periodDate >= next) {
        results.push({ kind: 'renewal', user_id: userId, status: 'period_changed' });
        continue;
      }

      const recipient = await getRecipient(admin, userId);
      if (!recipient) {
        results.push({ kind: 'renewal', user_id: userId, status: 'user_missing' });
        continue;
      }

      const emailId = await sendTemplate(
        resendKey,
        recipient,
        TEMPLATE_RENEWAL,
        {
          RENEWAL_DATE: formatDate(periodDate),
          AMOUNT: plan.amount,
          PLAN_NAME: plan.planName,
          MANAGE_URL,
        },
        `truworth/renewal/${subscriptionId}/${periodDate.toISOString()}`,
      );

      await logDelivery(admin, userId, 'renewal_reminder', referenceKey, emailId, {
        template: TEMPLATE_RENEWAL,
        subscription_id: subscriptionId,
      });
      results.push({ kind: 'renewal', user_id: userId, status: 'sent' });
    } catch (error) {
      failed++;
      console.error('renewal reminder failed', userId, subscriptionId, error);
      results.push({ kind: 'renewal', user_id: userId, status: 'failed' });
    }
  }

  return response({
    ok: failed === 0,
    trial_due: trialDue?.length || 0,
    renewal_due: due?.length || 0,
    failed,
    results,
  }, failed ? 207 : 200);
});
