const PROD_ORIGIN = 'https://truworth-web.onrender.com';
const LIMIT = 3;

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = origin === PROD_ORIGIN || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') ? origin : PROD_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function clientIp(req: Request) {
  const cloudflare = req.headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return req.headers.get('x-real-ip')?.trim() || '';
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
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== PROD_ORIGIN && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
      return json(req, { error: 'Origin not allowed.' }, 403);
    }

    const ip = clientIp(req);
    if (!ip) return json(req, { error: 'Unable to verify guest allowance.' }, 503);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRole) throw new Error('Server configuration unavailable.');

    const ipHash = await hmacHex(serviceRole, `truworth-guest-assessment-v1:${ip}`);
    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_guest_assessment`, {
      method: 'POST',
      headers: {
        'apikey': serviceRole,
        'Authorization': `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });

    if (!rpc.ok) {
      const detail = await rpc.text();
      console.error('guest-assessment-quota rpc failed', rpc.status, detail.slice(0, 500));
      return json(req, { error: 'Unable to verify guest allowance.' }, 503);
    }

    const rows = await rpc.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== 'boolean') throw new Error('Invalid quota response.');

    return json(req, {
      allowed: row.allowed,
      used: Number(row.used || 0),
      remaining: Number(row.remaining || 0),
      limit: LIMIT,
      reset_at: row.reset_at || null,
    });
  } catch (error) {
    console.error('guest-assessment-quota error', error instanceof Error ? error.message : String(error));
    return json(req, { error: 'Unable to verify guest allowance.' }, 503);
  }
});
