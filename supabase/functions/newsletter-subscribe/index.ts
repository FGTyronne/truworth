import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { Resend } from 'npm:resend@6.33.0';

const APP = 'https://truworth-web.onrender.com';
const ALLOWED_ORIGINS = new Set([APP, 'http://localhost:3000', 'http://127.0.0.1:3000']);
const SEGMENT_ID = 'ce9e7569-0605-43d0-b74f-72d0066d6f70';
const TOPIC_ID = '0ac90202-0624-4820-b2e7-1a30b8e1118e';
const CONSENT_VERSION = '2026-10-16';
const SHORT_WINDOW_LIMIT = 8;
const DAILY_LIMIT = 25;

function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (keys?.default) return keys.default;
  } catch {}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : APP,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function emailAddress(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

function sourcePage(value: unknown) {
  const source = String(value || 'unknown').trim().slice(0, 120);
  return /^[a-z0-9_./?&=\-]+$/i.test(source) ? source : 'unknown';
}

function requestIp(req: Request) {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function optionalUserId(req: Request, admin: ReturnType<typeof createClient>) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user?.id || null;
}

async function enforceRateLimit(admin: ReturnType<typeof createClient>, ipHash: string) {
  const now = Date.now();
  const since15 = new Date(now - 15 * 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [shortWindow, daily] = await Promise.all([
    admin.from('newsletter_subscription_events').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('occurred_at', since15),
    admin.from('newsletter_subscription_events').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('occurred_at', since24),
  ]);
  if (shortWindow.error || daily.error) throw new Error('Rate-limit ledger unavailable');
  return Number(shortWindow.count || 0) < SHORT_WINDOW_LIMIT && Number(daily.count || 0) < DAILY_LIMIT;
}

async function syncResend(email: string) {
  const key = Deno.env.get('RESEND_API_KEY') || '';
  if (!key) throw new Error('Resend API key unavailable');
  const resend = new Resend(key);

  const existing = await resend.contacts.get({ email });
  if (existing.data?.id) {
    const updated = await resend.contacts.update({ email, unsubscribed: false });
    if (updated.error) throw new Error(`Resend contact update failed: ${updated.error.message}`);

    const segment = await resend.contacts.segments.add({ email, segmentId: SEGMENT_ID });
    if (segment.error && segment.error.statusCode !== 409) {
      throw new Error(`Resend segment sync failed: ${segment.error.message}`);
    }

    const topics = await resend.contacts.topics.update({
      email,
      topics: [{ id: TOPIC_ID, subscription: 'opt_in' }],
    });
    if (topics.error) throw new Error(`Resend topic sync failed: ${topics.error.message}`);
    return existing.data.id;
  }

  if (existing.error && existing.error.statusCode !== 404) {
    throw new Error(`Resend contact lookup failed: ${existing.error.message}`);
  }

  const created = await resend.contacts.create({
    email,
    unsubscribed: false,
    segments: [{ id: SEGMENT_ID }],
    topics: [{ id: TOPIC_ID, subscription: 'opt_in' }],
  });
  if (created.error || !created.data?.id) {
    throw new Error(`Resend contact create failed: ${created.error?.message || 'unknown error'}`);
  }
  return created.data.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  const origin = req.headers.get('origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (String(body?.company_website || '').trim()) return json(req, { ok: true });

  const email = emailAddress(body?.email);
  if (!email) return json(req, { error: 'Enter a valid email address.' }, 400);
  if (body?.consent !== true) return json(req, { error: 'Please confirm that you want to receive TruWorth updates.' }, 400);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = adminKey();
  if (!url || !key) return json(req, { error: 'Subscription service is temporarily unavailable.' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const ipHash = await hmacHex(key, `truworth-newsletter-v1:${requestIp(req)}`);
  try {
    if (!(await enforceRateLimit(admin, ipHash))) {
      return json(req, { error: 'Too many subscription attempts. Please try again later.' }, 429);
    }

    const source = sourcePage(body?.source_page);
    const userId = await optionalUserId(req, admin);
    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await admin
      .from('newsletter_subscribers')
      .select('id,status')
      .eq('email', email)
      .maybeSingle();
    if (existingError) throw existingError;

    let subscriberId: string;
    const eventType = existing?.status === 'unsubscribed' ? 'resubscribe' : 'subscribe';
    if (existing?.id) {
      const update: Record<string, unknown> = {
        status: 'active',
        consented_at: now,
        consent_version: CONSENT_VERSION,
        source_page: source,
        source_context: 'domain-change-popup',
        ip_hash: ipHash,
        resend_sync_status: 'pending',
        unsubscribed_at: null,
        updated_at: now,
      };
      if (userId) update.user_id = userId;
      const { error } = await admin.from('newsletter_subscribers').update(update).eq('id', existing.id);
      if (error) throw error;
      subscriberId = existing.id;
    } else {
      const { data, error } = await admin.from('newsletter_subscribers').insert({
        email,
        status: 'active',
        consented_at: now,
        consent_version: CONSENT_VERSION,
        source_page: source,
        source_context: 'domain-change-popup',
        user_id: userId,
        ip_hash: ipHash,
        resend_sync_status: 'pending',
      }).select('id').single();
      if (error || !data?.id) throw error || new Error('Subscriber record unavailable');
      subscriberId = data.id;
    }

    const { error: eventError } = await admin.from('newsletter_subscription_events').insert({
      subscriber_id: subscriberId,
      event_type: eventType,
      source_page: source,
      ip_hash: ipHash,
      metadata: { consent_version: CONSENT_VERSION },
    });
    if (eventError) throw eventError;

    try {
      const resendContactId = await syncResend(email);
      const { error: syncUpdateError } = await admin.from('newsletter_subscribers').update({
        resend_contact_id: resendContactId,
        resend_sync_status: 'synced',
        last_resend_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', subscriberId);
      if (syncUpdateError) throw syncUpdateError;
    } catch (syncError) {
      console.error('newsletter Resend sync failed', syncError);
      await admin.from('newsletter_subscribers').update({
        resend_sync_status: 'error',
        last_resend_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', subscriberId);
      await admin.from('newsletter_subscription_events').insert({
        subscriber_id: subscriberId,
        event_type: 'sync_error',
        source_page: source,
        ip_hash: ipHash,
        metadata: { provider: 'resend' },
      });
      return json(req, { error: 'Your email was saved, but we could not finish the subscription. Please try once more.' }, 502);
    }

    return json(req, {
      ok: true,
      message: 'Subscribed. We’ll send you the new TruWorth address and worthwhile updates as they happen.',
    });
  } catch (error) {
    console.error('newsletter-subscribe', error instanceof Error ? error.message : String(error));
    return json(req, { error: 'We could not complete the subscription. Please try again.' }, 500);
  }
});
