import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://truworth.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const currencyCode = (v: unknown) => /^[A-Z]{3}$/i.test(String(v || '')) ? String(v).toUpperCase() : null;

function score(input: any) {
  const price = Number(input?.price || 0), upkeep = Number(input?.upkeep || 0), uses = Math.max(1, Number(input?.uses || 1));
  const effort = Math.max(0, Number(input?.effort || 0)), joy = clamp(Number(input?.joy || 5), 1, 10), minutes = Math.max(0, Number(input?.minutes || 0)), hourValue = Math.max(0, Number(input?.hourValue || 0));
  const total = price + upkeep, perUse = total / uses;
  let value = Math.round(Math.min(26, Math.log2(uses + 1) * 3.9) + joy / 10 * 24 + 25 / (1 + perUse / 18) + 15 / (1 + effort / Math.max(1, uses) * 3) + Math.min(10, (minutes / 60 * hourValue) / 12 * 10) - (input?.motive === 'image' ? 12 : 0));
  return clamp(value, 0, 100);
}

function monthlyFreeCash(fin: any) {
  if (!fin || fin.income_amount == null) return null;
  const monthlyIncome = fin.income_period === 'annual' ? Number(fin.income_amount) / 12 : Number(fin.income_amount);
  return monthlyIncome - Number(fin.essential_outgoings_monthly || 0) - Number(fin.debt_commitments_monthly || 0) - Number(fin.savings_target_monthly || 0);
}
function confidence(index: number, complete: number) {
  const margin = Math.abs(index - 62);
  return Math.round(clamp(58 + margin * 1.25 + complete * 4, 61, 94));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return reply({ error: 'Authentication required' }, 401);
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')?.default || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const client = createClient(Deno.env.get('SUPABASE_URL') || '', publishable, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return reply({ error: 'Invalid session' }, 401);

    const { data: sub } = await client.from('subscriptions').select('tier,status').eq('user_id', user.id).maybeSingle();
    const premium = sub?.tier === 'plus' && ['active','trialing'].includes(String(sub?.status || ''));
    if (!premium) return reply({ premium: false, locked: true });

    const body = await req.json();
    const [{ data: fin }, { data: history }, { data: bought }] = await Promise.all([
      client.from('financial_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('assessments').select('id,title,brand,score,status,observed_price,currency,inputs').eq('user_id', user.id),
      client.from('purchase_tracking').select('assessment_id,actual_uses,actual_joy').eq('user_id', user.id),
    ]);
    const freeCash = monthlyFreeCash(fin);
    const profileCurrency = currencyCode(fin?.currency);
    const boughtIds = new Set((bought || []).map((x: any) => x.assessment_id));
    const historical = history || [];
    const actualBought = historical.filter((r: any) => r.status === 'purchased' || boughtIds.has(r.id));
    const conversion = historical.length ? actualBought.length / historical.length : null;
    const avgBoughtScore = actualBought.length ? actualBought.reduce((s: number, r: any) => s + Number(r.score || 0), 0) / actualBought.length : null;

    let baseScore = 55;
    let cautious = null;
    let cost = null;
    let motive = null;
    let quick = false;
    let purchaseCurrency: string | null = null;

    if (body?.assessment_id) {
      const { data: record, error } = await client.from('assessments').select('*').eq('id', String(body.assessment_id)).eq('user_id', user.id).single();
      if (error || !record) return reply({ error: 'Assessment not found' }, 404);
      baseScore = Number(record.score || 0);
      motive = record.inputs?.motive || null;
      cost = Number(record.observed_price || 0) + Number(record.inputs?.upkeep || 0);
      purchaseCurrency = currencyCode(record.currency || record.inputs?.currency);
      cautious = score({ ...record.inputs, item: record.title, uses: Math.max(1, Math.round(Number(record.inputs?.uses || 1) / 2)), joy: Math.max(1, Number(record.inputs?.joy || 5) - 2) });
    } else if (body?.snapshot) {
      quick = true;
      if (body.snapshot.price == null || !Number.isFinite(Number(body.snapshot.price))) return reply({ premium: true, requires_price: true });
      cost = Number(body.snapshot.price);
      purchaseCurrency = currencyCode(body.snapshot.currency);
      if (freeCash == null) return reply({ premium: true, requires_financial_profile: true });
      const brand = String(body.snapshot.brand || '').toLowerCase();
      const sameBrand = historical.filter((r: any) => brand && String(r.brand || '').toLowerCase() === brand);
      if (sameBrand.length) baseScore = sameBrand.reduce((s: number, r: any) => s + Number(r.score || 0), 0) / sameBrand.length;
      else if (avgBoughtScore != null) baseScore = avgBoughtScore;
    } else return reply({ error: 'Assessment or snapshot required' }, 400);

    if (freeCash != null && profileCurrency && purchaseCurrency && profileCurrency !== purchaseCurrency) {
      return reply({ premium: true, requires_currency_confirmation: true, purchase_currency: purchaseCurrency, profile_currency: profileCurrency, message: `The purchase is priced in ${purchaseCurrency} while your financial profile is ${profileCurrency}. Confirm the equivalent ${profileCurrency} price before TruWorth+ gives a financial purchase vote.` });
    }

    let financialAdj = 0;
    let financialLabel = 'Not set';
    let ratio = null;
    if (freeCash != null) {
      ratio = freeCash > 0 ? Number(cost || 0) / freeCash : Infinity;
      if (ratio <= .25) { financialAdj = 12; financialLabel = 'Comfortable'; }
      else if (ratio <= .6) { financialAdj = 6; financialLabel = 'Noticeable'; }
      else if (ratio <= 1) { financialAdj = -4; financialLabel = 'Stretch'; }
      else if (ratio <= 1.5) { financialAdj = -13; financialLabel = 'Heavy'; }
      else { financialAdj = -22; financialLabel = 'Very heavy'; }
    }

    let behaviourAdj = 0;
    let behaviourLabel = historical.length < 3 ? 'Still learning' : 'History-aware';
    if (conversion != null && historical.length >= 4) {
      if (conversion < .25) behaviourAdj += 3;
      if (conversion > .7) behaviourAdj -= 2;
    }
    if (avgBoughtScore != null && avgBoughtScore >= 70) behaviourAdj += 3;
    if (motive === 'image') behaviourAdj -= 6;

    let resilienceAdj = 0;
    if (cautious != null) {
      if (cautious >= 65) resilienceAdj += 6;
      else if (cautious < 45) resilienceAdj -= 8;
    }

    const decisionIndex = clamp(baseScore + financialAdj + behaviourAdj + resilienceAdj, 0, 100);
    const vote = decisionIndex >= 62 && !(ratio != null && ratio > 1.5) ? 'BUY' : "DON'T BUY";
    const completeness = (freeCash != null ? 1 : 0) + (historical.length >= 3 ? 1 : 0) + (!quick ? 1 : 0);
    const conf = confidence(decisionIndex, completeness);
    const pct = ratio != null && Number.isFinite(ratio) ? Math.round(ratio * 100) : null;

    const reasons: string[] = [];
    if (!quick) reasons.push(baseScore >= 68 ? `The underlying TruWorth value score is strong at ${Math.round(baseScore)}.` : `The underlying TruWorth value score is ${Math.round(baseScore)}, so the value case is not especially strong.`);
    if (pct != null) reasons.push(`The cost is about ${pct}% of one month’s typical free cash after the commitments you entered.`);
    else if (freeCash == null) reasons.push('No financial profile was available, so this vote gives less weight to affordability.');
    if (cautious != null) reasons.push(cautious >= 60 ? `The cautious stress test still scores ${cautious}, which makes the decision more resilient.` : `The cautious stress test falls to ${cautious}, so the decision depends on optimistic assumptions.`);
    if (historical.length >= 3) reasons.push(`TruWorth also considered ${historical.length} saved decisions and ${actualBought.length} recorded purchases in your history.`);

    const headline = vote === 'BUY' ? (quick ? 'On the information we have, this gets a BUY.' : 'This purchase earns a BUY from TruWorth+.') : (quick ? 'Our quick vote is DON’T BUY.' : 'TruWorth+ would leave this one for now.');
    const reason = reasons.slice(0,2).join(' ');
    const factors = [
      { label: 'Value fit', value: quick ? (baseScore >= 68 ? 'Historically strong' : baseScore >= 55 ? 'Mixed' : 'Weak') : `${Math.round(baseScore)}/100` },
      { label: 'Financial fit', value: financialLabel },
      { label: 'You fit', value: behaviourLabel },
    ];

    return reply({ premium: true, quick, vote, confidence: conf, headline, reason, explanation: reasons.join(' '), factors, decision_index: Math.round(decisionIndex), financial_ratio: ratio != null && Number.isFinite(ratio) ? Number(ratio.toFixed(3)) : null, currency: purchaseCurrency || profileCurrency });
  } catch (error) {
    console.error(error);
    return reply({ error: 'We could not calculate the purchase vote.' }, 500);
  }
});
