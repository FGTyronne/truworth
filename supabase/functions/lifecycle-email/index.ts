import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const TEMPLATE_WELCOME = 'truworth-welcome';
const FROM = 'TruWorth <notifications@truworth.ramellacorporateconsulting.com>';
const START_URL = 'https://truworth-web.onrender.com/';
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = adminKey();
  if (!url || !key) return response({ error: 'Server configuration unavailable' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!(await authenticate(req, admin))) return response({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';

  if (body?.kind === 'healthcheck') {
    return response({ ok: true, resend_configured: Boolean(resendKey), sender: 'TruWorth' });
  }

  if (body?.kind !== 'welcome' || typeof body?.user_id !== 'string') {
    return response({ error: 'Invalid request' }, 400);
  }
  if (!resendKey) return response({ error: 'Email delivery not configured' }, 503);

  const userId = body.user_id;
  const referenceKey = 'account-confirmed';
  const { data: existing, error: existingError } = await admin
    .from('email_delivery_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', 'welcome')
    .eq('reference_key', referenceKey)
    .maybeSingle();
  if (existingError) return response({ error: 'Delivery ledger unavailable' }, 500);
  if (existing) return response({ ok: true, deduplicated: true });

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    if ((userError as any)?.status === 404) return response({ ok: true, skipped: 'user_missing' });
    return response({ error: 'Recipient unavailable' }, 500);
  }

  try {
    const emailId = await sendTemplate(
      resendKey,
      userData.user.email,
      TEMPLATE_WELCOME,
      { START_URL },
      `truworth/welcome/${userId}`,
    );
    const { error: logError } = await admin.from('email_delivery_log').insert({
      user_id: userId,
      email_type: 'welcome',
      reference_key: referenceKey,
      provider_email_id: emailId,
      metadata: { template: TEMPLATE_WELCOME },
    });
    if (logError && logError.code !== '23505') throw logError;
    return response({ ok: true });
  } catch (error) {
    console.error('welcome email failed', userId, error);
    return response({ error: 'Email delivery failed' }, 502);
  }
});