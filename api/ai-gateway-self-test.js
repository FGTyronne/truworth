import { getVercelOidcToken } from '@vercel/oidc';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || await getVercelOidcToken();
    if (!token) return res.status(200).json({ ok: false, stage: 'token', status: 0, message: 'No gateway credential available' });
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with exactly OK.' }],
      }),
    });
    const text = await response.text();
    return res.status(200).json({ ok: response.ok, stage: 'gateway', status: response.status, message: text.slice(0, 500) });
  } catch (error) {
    return res.status(200).json({ ok: false, stage: 'exception', status: 0, message: error instanceof Error ? error.message : String(error) });
  }
}
