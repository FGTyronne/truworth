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
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
const clean = (v: unknown, max = 180) => String(v || '').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

const knownBrands = ['Apple','Samsung','Sony','Meta','Dyson','Bose','Nintendo','Microsoft','Xbox','PlayStation','Canon','Nikon','Dell','HP','Lenovo','ASUS','Acer','LG','Philips','Bosch','DeLonghi','Nespresso','Nike','Adidas','LEGO','Garmin','Fitbit','GoPro','JBL','Pepsi','Coca-Cola','Coke','Red Bull','Nestle','Nescafe','Amazon','Kindle'];

function textQuality(raw: string) {
  const text = clean(raw, 160);
  const tokens = text.split(/\s+/).filter(Boolean);
  const singles = tokens.filter((t) => t.replace(/[^A-Za-z0-9]/g,'').length <= 1).length;
  const alnum = (text.match(/[A-Za-z0-9]/g) || []).length;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const meaningful = tokens.filter((t) => /[A-Za-z]{3,}/.test(t) || /[A-Za-z]{2,}\d{1,4}/.test(t) || /\d{1,4}[A-Za-z]{2,}/.test(t));
  const known = knownBrands.find((b) => text.toLowerCase().includes(b.toLowerCase()));
  const ok = Boolean(known || meaningful.length >= 2 || (meaningful.length >= 1 && tokens.length <= 5)) && tokens.length > 0 && singles / tokens.length < .34 && letters / Math.max(1, alnum) >= .45;
  const useful = known ? [known, ...meaningful.filter((x) => x.toLowerCase() !== known.toLowerCase())].join(' ') : meaningful.join(' ');
  return { ok, query: clean(useful || text, 120), brand: known || '', tokens: tokens.length, singles };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { headers: { 'Accept':'application/json', 'User-Agent':'TruWorth/1.0 product-resolution' }, signal: controller.signal });
    if (!response.ok) throw new Error(`provider ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function catalogueCandidate(item: any, source: 'barcode'|'ocr') {
  const offers = Array.isArray(item?.offers) ? item.offers : [];
  const offer = offers.find((o: any) => o?.link && o?.price != null) || offers.find((o: any) => o?.link) || offers[0] || {};
  const priceNumber = Number(offer?.price);
  const currency = /^[A-Z]{3}$/i.test(String(offer?.currency || '')) ? String(offer.currency).toUpperCase() : null;
  return {
    title: clean(item?.title || item?.description || '', 220),
    brand: clean(item?.brand || '', 100),
    category: clean(item?.category || '', 140),
    image_url: Array.isArray(item?.images) && item.images[0] ? clean(item.images[0], 700) : null,
    source_url: clean(offer?.link || '', 700) || null,
    source_label: source === 'barcode' ? 'Barcode database match' : 'Structured catalogue text match',
    price: Number.isFinite(priceNumber) && priceNumber > 0 ? priceNumber : null,
    currency,
    retailer: clean(offer?.merchant || offer?.domain || '', 120) || null,
    barcode: clean(item?.ean || item?.upc || '', 40) || null,
    confidence: source === 'barcode' ? 98 : 74,
  };
}

async function openFoodFactsCandidate(barcode: string) {
  try {
    const data = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,image_front_url,categories`);
    const p = data?.product;
    if (!p?.product_name) return null;
    return {
      title: clean(p.product_name, 220),
      brand: clean(p.brands || '', 100),
      category: clean(p.categories || '', 140),
      image_url: /^https?:\/\//i.test(String(p.image_front_url || '')) ? clean(p.image_front_url, 700) : null,
      source_url: `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`,
      source_label: 'Open Food Facts barcode match',
      price: null,
      currency: null,
      retailer: null,
      barcode,
      confidence: 96,
    };
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error:'Method not allowed' }, 405);
  const origin = req.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) return json(req, { error:'Origin not allowed' }, 403);
  try {
    const body = await req.json();
    const barcode = clean(body?.barcode, 40).replace(/[^0-9A-Za-z-]/g,'');
    const rawText = clean(body?.text, 160);
    if (!barcode && !rawText) return json(req, { error:'Barcode or product text required' }, 400);

    let candidates: any[] = [];
    const resolution = barcode ? 'barcode' : 'ocr';
    let lowConfidence = false;
    let detectedQuery = '';

    if (barcode && /^\d{8,14}$/.test(barcode)) {
      try {
        const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);
        candidates = (data?.items || []).map((item: any) => catalogueCandidate(item, 'barcode')).filter((x: any) => x.title).slice(0,4);
      } catch (error) { console.warn('UPC lookup failed', error); }
      if (!candidates.length) {
        const food = await openFoodFactsCandidate(barcode);
        if (food) candidates = [food];
      }
    }

    if (!candidates.length && rawText) {
      const quality = textQuality(rawText);
      detectedQuery = quality.query;
      if (!quality.ok) return json(req, { candidates: [], resolution:'ocr', low_confidence:true, detected_text: rawText, suggested_query:'', photo_stored:false });
      try {
        const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(quality.query)}&offset=0`);
        candidates = (data?.items || []).map((item: any) => catalogueCandidate(item, 'ocr')).filter((x: any) => x.title).slice(0,4);
      } catch (error) { console.warn('Text catalogue lookup failed', error); }
      if (!candidates.length) lowConfidence = true;
    }

    return json(req, { candidates, resolution, low_confidence: lowConfidence, detected_text: rawText || null, suggested_query: detectedQuery || null, photo_stored:false });
  } catch (error) {
    console.error(error);
    return json(req, { error:'We could not resolve that product right now.' }, 500);
  }
});
