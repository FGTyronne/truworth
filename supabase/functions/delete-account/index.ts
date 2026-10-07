import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const allowedOrigins = new Set([
  'https://truworth.vercel.app',
  'https://www.truworth.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://truworth.vercel.app',
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
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')?.default || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!url || !publishable || !serviceRole) throw new Error('Server configuration unavailable');

    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return reply(req, { error: 'Invalid session' }, 401);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    return reply(req, { deleted: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return reply(req, { error: 'We could not delete the account. Please try again.' }, 500);
  }
});
