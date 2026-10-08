export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    oidc_available: Boolean(process.env.VERCEL_OIDC_TOKEN),
    gateway_key_available: Boolean(process.env.AI_GATEWAY_API_KEY),
    vercel_runtime: Boolean(process.env.VERCEL),
  });
}
