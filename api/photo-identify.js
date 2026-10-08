import { getVercelOidcToken } from '@vercel/oidc';

const MODEL = 'google/gemini-3-flash';
const MAX_IMAGE_CHARS = 4_000_000;
const ALLOWED_ORIGINS = new Set([
  'https://truworth.vercel.app',
  'https://www.truworth.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const schema = {
  name: 'truworth_product_identity',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'product_name', 'brand', 'model', 'variant', 'category', 'confidence',
      'exactness', 'search_query', 'visible_text', 'evidence', 'alternatives'
    ],
    properties: {
      product_name: { type: 'string', maxLength: 180 },
      brand: { type: 'string', maxLength: 100 },
      model: { type: 'string', maxLength: 120 },
      variant: { type: 'string', maxLength: 120 },
      category: { type: 'string', maxLength: 120 },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      exactness: { type: 'string', enum: ['exact', 'probable', 'category_only', 'uncertain'] },
      search_query: { type: 'string', maxLength: 220 },
      visible_text: {
        type: 'array',
        maxItems: 8,
        items: { type: 'string', maxLength: 120 }
      },
      evidence: {
        type: 'array',
        maxItems: 6,
        items: { type: 'string', maxLength: 180 }
      },
      alternatives: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['product_name', 'brand', 'model', 'variant', 'category', 'confidence', 'exactness', 'search_query', 'evidence'],
          properties: {
            product_name: { type: 'string', maxLength: 180 },
            brand: { type: 'string', maxLength: 100 },
            model: { type: 'string', maxLength: 120 },
            variant: { type: 'string', maxLength: 120 },
            category: { type: 'string', maxLength: 120 },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            exactness: { type: 'string', enum: ['exact', 'probable', 'category_only', 'uncertain'] },
            search_query: { type: 'string', maxLength: 220 },
            evidence: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string', maxLength: 180 }
            }
          }
        }
      }
    }
  }
};

function setHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function clean(value, max = 180) {
  return String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normaliseAlternative(item = {}) {
  return {
    product_name: clean(item.product_name, 180),
    brand: clean(item.brand, 100),
    model: clean(item.model, 120),
    variant: clean(item.variant, 120),
    category: clean(item.category, 120),
    confidence: Math.max(0, Math.min(100, Math.round(Number(item.confidence) || 0))),
    exactness: ['exact', 'probable', 'category_only', 'uncertain'].includes(item.exactness) ? item.exactness : 'uncertain',
    search_query: clean(item.search_query, 220),
    evidence: Array.isArray(item.evidence) ? item.evidence.map((x) => clean(x, 180)).filter(Boolean).slice(0, 4) : [],
  };
}

function normaliseIdentity(raw = {}) {
  return {
    product_name: clean(raw.product_name, 180),
    brand: clean(raw.brand, 100),
    model: clean(raw.model, 120),
    variant: clean(raw.variant, 120),
    category: clean(raw.category, 120),
    confidence: Math.max(0, Math.min(100, Math.round(Number(raw.confidence) || 0))),
    exactness: ['exact', 'probable', 'category_only', 'uncertain'].includes(raw.exactness) ? raw.exactness : 'uncertain',
    search_query: clean(raw.search_query, 220),
    visible_text: Array.isArray(raw.visible_text) ? raw.visible_text.map((x) => clean(x, 120)).filter(Boolean).slice(0, 8) : [],
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map((x) => clean(x, 180)).filter(Boolean).slice(0, 6) : [],
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map(normaliseAlternative).filter((x) => x.product_name || x.category).slice(0, 3) : [],
  };
}

function parseJsonContent(content) {
  if (content && typeof content === 'object' && !Array.isArray(content)) return content;
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

async function getGatewayToken() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  if (process.env.VERCEL_OIDC_TOKEN) return process.env.VERCEL_OIDC_TOKEN;
  try {
    return await getVercelOidcToken({
      project: 'prj_zoXOpfD3YBfrBdLFrKnJCIIoyH2A',
      team: 'team_FY7chI81P7NXnvUqmUsFoN9P',
      expirationBufferMs: 60_000,
    });
  } catch (error) {
    console.error('Unable to obtain Vercel OIDC token', error instanceof Error ? error.message : String(error));
    return '';
  }
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.has(origin) && !origin.endsWith('.vercel.app')) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const image = req.body?.image;
  const barcode = clean(req.body?.barcode, 40).replace(/[^0-9A-Za-z-]/g, '');

  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
    return res.status(400).json({ error: 'A JPEG, PNG or WebP image is required.' });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return res.status(413).json({ error: 'The analysis image is too large.' });
  }

  const token = await getGatewayToken();
  if (!token) {
    return res.status(503).json({ error: 'AI vision authentication is unavailable for this deployment.' });
  }

  const instruction = [
    'You are the product-identification engine for TruWorth, a purchase decision app.',
    'Analyse the supplied retail product photo and identify the product as precisely as the image evidence allows.',
    'Use visible logos, packaging, typography, industrial design, colours, model markings and readable text.',
    'Never invent an exact model, generation, size, storage capacity, colourway or variant when the photo does not support it.',
    'If only the category is defensible, set exactness to category_only and keep unknown brand/model/variant fields empty.',
    'If a brand is visible but the model is uncertain, identify the brand and product family and mark probable or uncertain.',
    'product_name should be the cleanest useful name a shopper could search for, without marketing filler.',
    'search_query should combine the strongest identifying terms for a product catalogue lookup.',
    'visible_text must contain only text you can actually read in the image; do not paraphrase it.',
    'evidence should briefly explain the visual clues supporting the identification.',
    'Return alternatives only when there are genuinely plausible competing identities.',
    barcode ? `A locally detected barcode value is ${barcode}. Treat it as supporting evidence but do not assume it is valid if the image conflicts.` : 'No reliable barcode was detected locally.',
  ].join(' ');

  try {
    const gatewayResponse = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
      }),
    });

    if (!gatewayResponse.ok) {
      const gatewayText = await gatewayResponse.text();
      console.error('AI Gateway photo-identify failed', gatewayResponse.status, gatewayText.slice(0, 500));
      return res.status(502).json({ error: 'AI vision could not identify the product right now.' });
    }

    const payload = await gatewayResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    const identity = normaliseIdentity(parseJsonContent(content));

    if (!identity.product_name && !identity.category) {
      return res.status(422).json({ error: 'The image did not contain enough product detail to identify.' });
    }

    return res.status(200).json({
      identity,
      model: MODEL,
      photo_stored: false,
    });
  } catch (error) {
    console.error('photo-identify exception', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'AI vision could not finish the analysis.' });
  }
}
