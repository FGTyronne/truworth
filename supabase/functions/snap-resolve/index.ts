const allowedOrigins = new Set(['https://truworth.vercel.app','https://www.truworth.vercel.app','http://localhost:3000','http://127.0.0.1:3000']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://truworth.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function clean(value: unknown, max = 180) {
  return String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function ukOffer(offers: any[]) {
  if (!Array.isArray(offers)) return null;
  return offers.find((o) => /(^|\.)co\.uk$/i.test(String(o?.domain || '').replace(/^www\./,''))) || offers.find((o) => /GBP/i.test(String(o?.currency || ''))) || null;
}

function candidate(item: any, source: 'barcode' | 'ocr') {
  const offer = ukOffer(item?.offers || []);
  const image = Array.isArray(item?.images) ? item.images.find((x: unknown) => /^https?:\/\//i.test(String(x || ''))) : null;
  const sourceUrl = clean(offer?.link || item?.offers?.[0]?.link || '', 600);
  return {
    title: clean(item?.title || item?.description || 'Unknown product', 220),
    brand: clean(item?.brand || '', 120),
    category: clean(item?.category || '', 160),
    barcode: clean(item?.ean || item?.upc || '', 32),
    image_url: image ? clean(image, 700) : null,
    source_url: sourceUrl || null,
    retailer: clean(offer?.merchant || offer?.domain || '', 120) || null,
    price: offer?.price != null && Number.isFinite(Number(offer.price)) ? Number(offer.price) : null,
    currency: offer?.price != null ? 'GBP' : null,
    confidence: source === 'barcode' ? 98 : 76,
    source_label: source === 'barcode' ? 'Barcode database match' : 'Text database match',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  const origin = req.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'Origin not allowed' }, 403);

  try {
    const body = await req.json();
    const barcode = clean(body?.barcode, 32).replace(/[^0-9A-Za-z-]/g, '');
    const text = clean(body?.text, 160);
    if (!barcode && text.length < 3) return json(req, { error: 'Barcode or product text required' }, 400);

    let endpoint = '';
    let source: 'barcode' | 'ocr' = 'ocr';
    if (barcode) {
      endpoint = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
      source = 'barcode';
    } else {
      endpoint = `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(text)}&offset=0`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const response = await fetch(endpoint, { headers: { 'Accept': 'application/json', 'User-Agent': 'TruWorth/1.0 product-resolution' }, signal: controller.signal });
    clearTimeout(timer);

    if (response.status === 429) return json(req, { error: 'Product lookup is temporarily at its free-provider limit. Try again later or continue with search.' }, 429);
    if (!response.ok) return json(req, { error: 'Product lookup provider did not respond.' }, 502);
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const candidates = items.slice(0, 6).map((item: any) => candidate(item, source)).filter((x: any) => x.title && x.title !== 'Unknown product');
    return json(req, { candidates, source, query: barcode || text, provider: 'UPCitemdb', provider_limit_note: 'Explorer tier is rate limited.' });
  } catch (error) {
    console.error(error);
    return json(req, { error: 'We could not resolve that product right now.' }, 500);
  }
});
