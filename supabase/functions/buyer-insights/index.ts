import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const archetype = (motive: string | null | undefined) => motive === "need" ? "Practical" : motive === "joy" ? "Joy-led" : motive === "image" ? "Impulse-led" : "Exploring";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ error: "Service configuration unavailable" }, 500);
  const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const [{ data: sub }, { data: assessments, error: assessmentsError }, { data: purchases }, { data: financial }] = await Promise.all([
    supabase.from("subscriptions").select("tier,status").eq("user_id", user.id).maybeSingle(),
    supabase.from("assessments").select("id,score,observed_price,status,inputs,created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("purchase_tracking").select("assessment_id,actual_uses,actual_joy,purchased_at").eq("user_id", user.id),
    supabase.from("financial_profiles").select("currency,income_amount,income_period,essential_outgoings_monthly,debt_commitments_monthly,savings_target_monthly").eq("user_id", user.id).maybeSingle(),
  ]);
  if (assessmentsError) return json({ error: "Could not load buyer history" }, 500);

  const rows = assessments ?? [];
  const boughtIds = new Set((purchases ?? []).map((p: any) => p.assessment_id));
  const bought = rows.filter((r: any) => r.status === "purchased" || boughtIds.has(r.id));
  const motiveCounts = (source: any[]) => source.reduce((acc: Record<string, number>, row: any) => { const m = row.inputs?.motive || "unknown"; acc[m] = (acc[m] || 0) + 1; return acc; }, {});
  const dominant = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const avg = (source: any[], key: string) => source.length ? source.reduce((sum, row) => sum + Number(row[key] || 0), 0) / source.length : 0;
  const consideredMotive = dominant(motiveCounts(rows));
  const boughtMotive = dominant(motiveCounts(bought));
  const consideredAvg = Math.round(avg(rows, "score"));
  const boughtAvg = Math.round(avg(bought, "score"));
  const conversion = rows.length ? bought.length / rows.length : 0;
  const teaserHeadline = rows.length < 3 ? "Your buyer profile is just getting started." : consideredMotive && boughtMotive && consideredMotive !== boughtMotive ? `Your Wants Self looks ${archetype(consideredMotive).toLowerCase()}, while your Real Buyer looks ${archetype(boughtMotive).toLowerCase()}.` : `Your Wants Self and Real Buyer are currently both ${archetype(consideredMotive).toLowerCase()}.`;
  const isPlus = sub?.tier === "plus" && ["active", "trialing"].includes(sub?.status || "");
  if (!isPlus) return json({ premium:false, teaser:{ headline:teaserHeadline, considerations:rows.length, purchases:bought.length } });

  const observations: string[] = [];
  if (rows.length < 3) observations.push("Add a few more considerations and purchases to make your buyer profile more precise.");
  if (consideredMotive && boughtMotive && consideredMotive !== boughtMotive) observations.push(`You are most often tempted by ${archetype(consideredMotive).toLowerCase()} purchases, but the things you actually buy skew ${archetype(boughtMotive).toLowerCase()}.`);
  if (rows.length >= 3 && conversion <= 0.3) observations.push("You are highly selective: most things you consider never become purchases.");
  else if (rows.length >= 3 && conversion >= 0.7) observations.push("You convert a large share of considerations into purchases, so slowing the decision stage may have an outsized impact.");
  if (bought.length >= 2 && boughtAvg >= consideredAvg + 5) observations.push("Your actual purchases score better than your typical consideration, suggesting you become more disciplined when money is really leaving your account.");
  if (bought.length >= 2 && boughtAvg <= consideredAvg - 5) observations.push("The things you actually buy score below your average consideration; convenience, urgency or impulse may be overriding your original value test.");

  let financialFit = null as null | Record<string, unknown>;
  if (financial?.income_amount != null) {
    const monthlyIncome = financial.income_period === "annual" ? Number(financial.income_amount) / 12 : Number(financial.income_amount);
    const disposable = Math.max(0, monthlyIncome - Number(financial.essential_outgoings_monthly || 0) - Number(financial.debt_commitments_monthly || 0) - Number(financial.savings_target_monthly || 0));
    const avgBoughtPrice = bought.length ? bought.reduce((s: number, r: any) => s + Number(r.observed_price || 0), 0) / bought.length : 0;
    const pressure = disposable > 0 ? avgBoughtPrice / disposable : null;
    financialFit = { monthlyIncome, disposable, avgBoughtPrice, pressure, currency: financial.currency || "GBP" };
    if (pressure != null && bought.length) {
      if (pressure < 0.25) observations.push("Your typical purchase is light relative to your monthly free cash, so affordability pressure is usually low.");
      else if (pressure < 0.75) observations.push("Your typical purchase is noticeable but usually contained within one month of free cash.");
      else observations.push("Your typical purchase absorbs a large share of monthly free cash, so timing and waiting periods matter more for you than the score alone.");
    }
  }

  return json({premium:true, teaser:{headline:teaserHeadline}, profile:{wants:archetype(consideredMotive),real:archetype(boughtMotive),considerations:rows.length,purchases:bought.length,conversionRate:Math.round(conversion*100),consideredAverageScore:consideredAvg,purchasedAverageScore:boughtAvg,observations,financialFit}});
});
