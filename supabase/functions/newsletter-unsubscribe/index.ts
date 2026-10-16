import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { Resend } from 'npm:resend@6.33.0';

const APP = 'https://truworth-web.onrender.com';
const ALLOWED_ORIGINS = new Set([APP, 'http://localhost:3000', 'http://127.0.0.1:3000']);
const SEGMENT_ID = 'ce9e7569-0605-43d0-b74f-72d0066d6f70';
const TOPIC_ID = '0ac90202-0624-4820-b2e7-1a30b8e1118e';
const REASONS = new Set(['too_many_emails','not_relevant','just_browsing','prefer_no_marketing','privacy','other']);

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

function validToken(value: unknown) {
  const token = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function syncResend(email: string) {
  const key = Deno.env.get('RESEND_API_KEY') || '';
  if (!key) throw new Error('Resend API key unavailable');
  const resend = new Resend(key);

  const contact = await resend.contacts.get({ email });
  if (contact.error && contact.error.statusCode === 404) return;
  if (contact.error) throw new Error(`Resend contact lookup failed: ${contact.error.message}`);

  const topic = await resend.contacts.topics.update({
    email,
    topics: [{ id: TOPIC_ID, subscription: 'opt_out' }],
  });
  if (topic.error) throw new Error(`Resend topic update failed: ${topic.error.message}`);

  const segment = await resend.contacts.segments.remove({ email, segmentId: SEGMENT_ID });
  if (segment.error && segment.error.statusCode !== 404) {
    throw new Error(`Resend segment removal failed: ${segment.error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  const origin = req.headers.get('origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed.' }, 403);

  const body = await req.json().catch(() => ({}));
  const token = validToken(body?.token);
  if (!token) return json(req, { error: 'This unsubscribe link is invalid.' }, 400);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = adminKey();
  if (!url || !key) return json(req, { error: 'Unsubscribe service is temporarily unavailable.' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: subscriber, error } = await admin
    .from('newsletter_subscribers')
    .select('id,email,status')
    .eq('unsubscribe_token', token)
    .maybeSingle();
  if (error) return json(req, { error: 'We could not check this subscription.' }, 500);
  if (!subscriber) return json(req, { error: 'This unsubscribe link is no longer valid.' }, 404);

  if (body?.action === 'status') {
    return json(req, { ok: true, active: subscriber.status === 'active' });
  }

  if (body?.action !== 'unsubscribe') return json(req, { error: 'Invalid request.' }, 400);
  const reason = String(body?.reason || '').trim();
  if (!REASONS.has(reason)) return json(req, { error: 'Choose a reason before confirming.' }, 400);
  const detail = String(body?.detail || '').trim().slice(0, 500);
  const now = new Date().toISOString();

  if (subscriber.status === 'unsubscribed') {
    return json(req, { ok: true, already_unsubscribed: true, message: 'You are already unsubscribed from TruWorth updates.' });
  }

  const { error: updateError } = await admin.from('newsletter_subscribers').update({
    status: 'unsubscribed',
    unsubscribe_reason: reason,
    unsubscribe_reason_detail: detail || null,
    unsubscribed_at: now,
    updated_at: now,
  }).eq('id', subscriber.id);
  if (updateError) return json(req, { error: 'We could not update your subscription.' }, 500);

  const { error: eventError } = await admin.from('newsletter_subscription_events').insert({
    subscriber_id: subscriber.id,
    event_type: 'unsubscribe',
    source_page: '/unsubscribe.html',
    metadata: { reason, detail: detail || null },
  });
  if (eventError) console.error('newsletter unsubscribe event log failed', eventError.message);

  try {
    await syncResend(subscriber.email);
  } catch (syncError) {
    console.error('newsletter Resend unsubscribe sync failed', syncError);
    return json(req, {
      ok: true,
      warning: true,
      message: 'Your TruWorth subscription was removed. Email-provider synchronisation is still being completed.',
    });
  }

  return json(req, {
    ok: true,
    message: 'You have been unsubscribed from TruWorth news, benefits and offers. Account and transactional emails are unaffected.',
  });
});
