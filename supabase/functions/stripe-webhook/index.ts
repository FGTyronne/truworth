import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const enc = new TextEncoder();
const TEMPLATE_PLUS = 'truworth-plus-activated';
const TEMPLATE_TRIAL = 'truworth-trial-started';
const TEMPLATE_CANCELLATION = 'truworth-cancellation-confirmed';
const TEMPLATE_PAYMENT_FAILED = 'truworth-payment-failed';
const FROM = 'TruWorth <notifications@truworth.ramellacorporateconsulting.com>';
const ACCOUNT_URL = 'https://truworth.vercel.app/account.html';

function adminKey() { try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); if (keys?.default) return keys.default; } catch {} return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''; }
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; };
async function verify(raw: string, header: string, secret: string) { const parts = header.split(',').map((x) => x.trim()); const timestamp = parts.find((x) => x.startsWith('t='))?.slice(2); const signatures = parts.filter((x) => x.startsWith('v1=')).map((x) => x.slice(3)); if (!timestamp || !signatures.length) return false; const ts = Number(timestamp); if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false; const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${raw}`))); return signatures.some((x) => safeEq(x, signature)); }
async function stripeGet(path: string, secret: string) { const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-03-31.basil' } }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Stripe retrieve failed ${r.status} ${data?.error?.code || data?.error?.type || ''}`); return data; }
function formatMoney(amountMinor: number, currency: string) { const code = String(currency || 'GBP').toUpperCase(); const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }); const digits = formatter.resolvedOptions().maximumFractionDigits; return formatter.format(amountMinor / Math.pow(10, digits)); }
function formatDate(value: number | string | Date) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)); }
function invoiceSubscriptionId(invoice: any) { const candidate = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription ?? invoice?.lines?.data?.find((line: any) => line?.parent?.subscription_item_details?.subscription)?.parent?.subscription_item_details?.subscription ?? null; return typeof candidate === 'string' ? candidate : candidate?.id || null; }
function dbStatus(raw: string) { if (raw === 'active' || raw === 'trialing' || raw === 'past_due' || raw === 'canceled') return raw; if (raw === 'incomplete_expired') return 'expired'; return 'past_due'; }
async function sendTemplate(apiKey: string, to: string, templateId: string, variables: Record<string, string>, idempotencyKey: string) { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ from: FROM, to: [to], template: { id: templateId, variables } }) }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Resend ${r.status}: ${data?.message || data?.name || 'send failed'}`); return data?.id || null; }
async function sendOnce(admin: ReturnType<typeof createClient>, resendKey: string, userId: string, emailType: string, referenceKey: string, recipient: string, templateId: string, variables: Record<string, string>, idempotencyKey: string, metadata: Record<string, unknown> = {}) { const { data: existing, error: existingError } = await admin.from('email_delivery_log').select('id').eq('user_id', userId).eq('email_type', emailType).eq('reference_key', referenceKey).maybeSingle(); if (existingError) throw existingError; if (existing) return; const emailId = await sendTemplate(resendKey, recipient, templateId, variables, idempotencyKey); const { error: logError } = await admin.from('email_delivery_log').insert({ user_id: userId, email_type: emailType, reference_key: referenceKey, provider_email_id: emailId, metadata: { template: templateId, ...metadata } }); if (logError && logError.code !== '23505') throw logError; }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const signature = req.headers.get('stripe-signature') || '';
  if (!webhookSecret || !stripeSecret) return new Response('Billing not configured', { status: 503 });
  if (!(await verify(raw, signature, webhookSecret))) return new Response('Invalid signature', { status: 400 });
  let event: any; try { event = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const url = Deno.env.get('SUPABASE_URL') || '', key = adminKey();
  if (!url || !key) return new Response('Server configuration unavailable', { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: seen } = await admin.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle();
  if (seen) return new Response('ok', { status: 200 });
  const { error: reserve } = await admin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type });
  if (reserve?.code === '23505') return new Response('ok', { status: 200 });
  if (reserve) return new Response('Ledger unavailable', { status: 500 });

  try {
    const obj = event.data?.object || {};
    const previous = event.data?.previous_attributes || {};
    let sub: any = null, userId: string | null = null, invoice: any = null;
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') { userId = obj.metadata?.supabase_user_id || obj.client_reference_id || null; const sid = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id; if (sid) sub = await stripeGet(`subscriptions/${encodeURIComponent(sid)}`, stripeSecret); }
    else if (event.type.startsWith('customer.subscription.')) sub = obj;
    else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') { invoice = obj; const sid = invoiceSubscriptionId(obj); if (sid) sub = await stripeGet(`subscriptions/${encodeURIComponent(sid)}`, stripeSecret); }
    else return new Response('ok', { status: 200 });
    if (!sub) return new Response('ok', { status: 200 });

    userId = userId || sub.metadata?.supabase_user_id || null;
    if (!userId) { const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id; const { data: row } = await admin.from('subscriptions').select('user_id').or(`provider_subscription_id.eq.${sub.id},provider_customer_id.eq.${customerId}`).maybeSingle(); userId = row?.user_id || null; }
    if (!userId) throw new Error('No TruWorth user mapping');
    const { data: userCheck, error: userCheckError } = await admin.auth.admin.getUserById(userId);
    if (userCheckError) { if ((userCheckError as any)?.status === 404) return new Response('ok', { status: 200 }); throw userCheckError; }
    if (!userCheck?.user) return new Response('ok', { status: 200 });

    const item = sub.items?.data?.[0];
    const priceObj = typeof item?.price === 'object' ? item.price : null;
    const priceId = typeof item?.price === 'string' ? item.price : priceObj?.id || null;
    const interval = priceObj?.recurring?.interval || sub.metadata?.truworth_plan || null;
    const rawStatus = String(sub.status || 'inactive');
    const active = ['active', 'trialing'].includes(rawStatus);
    const trialStartIso = sub.trial_start ? new Date(Number(sub.trial_start) * 1000).toISOString() : null;
    const trialEndIso = sub.trial_end ? new Date(Number(sub.trial_end) * 1000).toISOString() : null;
    const period = item?.current_period_end || sub.current_period_end || null;
    const periodIso = period ? new Date(Number(period) * 1000).toISOString() : null;
    const payload = { user_id: userId, tier: active ? 'plus' : 'free', status: dbStatus(rawStatus), provider: 'stripe', provider_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null, provider_subscription_id: sub.id, provider_price_id: priceId, plan_interval: interval, cancel_at_period_end: Boolean(sub.cancel_at_period_end), current_period_end: periodIso, trial_started_at: trialStartIso, trial_end: trialEndIso, updated_at: new Date().toISOString() };
    const { error: upsertError } = await admin.from('subscriptions').upsert(payload, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;

    if (resendKey && userCheck.user.email) {
      let price: any = priceObj;
      if (!price && priceId) price = await stripeGet(`prices/${encodeURIComponent(priceId)}`, stripeSecret);
      const amount = Number(price?.unit_amount ?? 0), currency = String(price?.currency || 'gbp'), billingInterval = String(price?.recurring?.interval || interval || 'month');
      const planName = billingInterval === 'year' ? 'TruWorth+ Annual' : 'TruWorth+ Monthly';
      const planPrice = `${formatMoney(amount, currency)} / ${billingInterval === 'year' ? 'year' : 'month'}`;
      const startEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'customer.subscription.created';
      if (rawStatus === 'trialing' && startEvent) {
        await sendOnce(admin,resendKey,userId,'trial_started',String(sub.id),userCheck.user.email,TEMPLATE_TRIAL,{PLAN_NAME:planName,PLAN_PRICE:planPrice,TRIAL_END_DATE:trialEndIso?formatDate(trialEndIso):'See your account',ACCOUNT_URL},`truworth/trial/${sub.id}`,{subscription_id:sub.id});
      } else if (rawStatus === 'active' && (startEvent || (event.type === 'customer.subscription.updated' && previous?.status === 'trialing'))) {
        await sendOnce(admin,resendKey,userId,'plus_activated',String(sub.id),userCheck.user.email,TEMPLATE_PLUS,{PLAN_NAME:planName,AMOUNT:formatMoney(amount,currency),NEXT_BILLING_DATE:periodIso?formatDate(periodIso):'See your account',ACCOUNT_URL},`truworth/plus/${sub.id}`,{subscription_id:sub.id});
      }
      if (event.type === 'customer.subscription.updated' && Boolean(sub.cancel_at_period_end) && previous?.cancel_at_period_end === false) {
        const end = trialEndIso || periodIso || new Date().toISOString();
        await sendOnce(admin,resendKey,userId,'cancellation_confirmed',`${sub.id}:${end}`,userCheck.user.email,TEMPLATE_CANCELLATION,{PLAN_NAME:planName,ACCESS_END_DATE:formatDate(end),ACCOUNT_URL},`truworth/cancel/${sub.id}/${end}`,{subscription_id:sub.id});
      }
      if (event.type === 'invoice.payment_failed' && invoice) {
        const invoiceId = String(invoice.id || event.id); const amountDue = Number(invoice.amount_due ?? 0);
        await sendOnce(admin,resendKey,userId,'payment_failed',invoiceId,userCheck.user.email,TEMPLATE_PAYMENT_FAILED,{AMOUNT:formatMoney(amountDue,currency),PLAN_NAME:planName,MANAGE_URL:ACCOUNT_URL},`truworth/payment-failed/${invoiceId}`,{invoice_id:invoiceId,subscription_id:sub.id});
      }
    }
    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Stripe webhook processing failed', event?.type, event?.id, error);
    await admin.from('stripe_webhook_events').delete().eq('event_id', event.id);
    return new Response('Webhook processing failed', { status: 500 });
  }
});