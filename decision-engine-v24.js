(() => {
  'use strict';

  const PLUS_ACTIVE = () => Boolean(user && subscription?.tier === 'plus' && ['active', 'trialing'].includes(subscription?.status));
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, Number(n) || 0));
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const PROFILE_KEY = 'decision_profile';
  let profileCache = null;
  let financialCache = null;

  function addDecisionStyles() {
    if (document.getElementById('decisionEngineV24Styles')) return;
    const style = document.createElement('style');
    style.id = 'decisionEngineV24Styles';
    style.textContent = `
      .tw-decision-shell{margin-top:24px;display:grid;gap:16px}
      .tw-decision-hero{border:1px solid rgba(23,24,32,.12);border-radius:24px;padding:24px;background:linear-gradient(135deg,#171820 0%,#232633 100%);color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;box-shadow:0 18px 50px rgba(23,24,32,.12)}
      .tw-decision-hero h2{font-size:clamp(1.5rem,4vw,2.35rem);line-height:1.05;margin:6px 0 10px}.tw-decision-hero p{margin:0;color:rgba(255,255,255,.74);max-width:700px}.tw-decision-hero .kicker{color:#d8fa69}
      .tw-decision-badge{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;border:10px solid rgba(216,250,105,.22);background:#d8fa69;color:#171820;text-align:center}.tw-decision-badge strong{font-size:2rem;line-height:1}.tw-decision-badge small{display:block;font-size:.7rem;margin-top:3px}
      .tw-decision-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.tw-decision-actions .tw-pill{display:inline-flex;align-items:center;padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.1);font-size:.78rem;font-weight:700}
      .tw-factor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tw-factor{border:1px solid rgba(23,24,32,.1);background:#fff;border-radius:18px;padding:14px}.tw-factor span{display:block;font-size:.76rem;color:#6d7080}.tw-factor strong{font-size:1.05rem}.tw-factor-bar{height:6px;border-radius:999px;background:#eceef2;margin-top:9px;overflow:hidden}.tw-factor-bar i{display:block;height:100%;background:#171820;border-radius:inherit}
      .tw-recommendation-lock{border:1px dashed rgba(23,24,32,.25);border-radius:22px;padding:22px;background:#fafaf7}.tw-recommendation-lock h3{margin:4px 0 8px}.tw-recommendation-lock p{margin:0 0 14px;color:#646875}.tw-profile-meter{height:8px;background:#e8e9e3;border-radius:999px;overflow:hidden;margin:10px 0 14px}.tw-profile-meter span{display:block;height:100%;background:#171820;border-radius:inherit}
      .tw-profile-card{margin-top:20px;border:1px solid rgba(23,24,32,.1);border-radius:24px;padding:22px;background:#fff}.tw-profile-card header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.tw-profile-card h2{margin:4px 0 8px}.tw-profile-card p{margin:0;color:#646875}.tw-profile-badge{background:#eef8c9;color:#283006;border-radius:999px;padding:8px 12px;font-size:.78rem;font-weight:800;white-space:nowrap}
      .tw-discipline{margin:22px 0}.tw-discipline-head{display:flex;justify-content:space-between;gap:16px;align-items:end}.tw-discipline-head strong{font-size:1.35rem}.tw-discipline input[type=range]{width:100%;accent-color:#171820}.tw-scale-copy{display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:.76rem;color:#777b87}.tw-scale-copy span:last-child{text-align:right}
      .tw-behaviour-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.tw-behaviour-grid label{display:grid;gap:6px}.tw-behaviour-grid label>span{font-size:.8rem;font-weight:750}.tw-behaviour-grid output{font-size:.8rem;color:#777b87}.tw-behaviour-grid input[type=range]{width:100%;accent-color:#171820}
      .tw-profile-save{display:flex;align-items:center;gap:12px;margin-top:18px;flex-wrap:wrap}.tw-profile-note{font-size:.78rem;color:#777b87}
      .tw-math-note{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;background:#f5f5f1;border-radius:14px;padding:12px;margin-top:14px;color:#4f5260;overflow:auto}
      .tw-price-missing{margin-top:10px;padding:10px 12px;border-radius:12px;background:#fff7dd;color:#6c5614;font-size:.82rem}.tw-price-missing strong{display:block;color:#4c3c0c}
      .tw-compare-intro{margin:14px 0 4px;padding:14px 16px;border-radius:16px;background:#f5f5f1;color:#555963;font-size:.86rem}
      @media(max-width:800px){.tw-decision-hero{grid-template-columns:1fr}.tw-decision-badge{width:88px;height:88px}.tw-factor-grid{grid-template-columns:repeat(2,1fr)}.tw-behaviour-grid{grid-template-columns:1fr}.tw-profile-card header{display:grid}.tw-scale-copy{font-size:.7rem}}
    `;
    document.head.appendChild(style);
  }

  async function loadDecisionProfile(force = false) {
    if (!user || !supabaseClient) return { settings: {}, decision: {}, financial: null };
    if (!force && profileCache) return { settings: profileCache.settings || {}, decision: profileCache.decision || {}, financial: financialCache };
    const [{ data: settingsRow }, { data: financial }] = await Promise.all([
      supabaseClient.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
      supabaseClient.from('financial_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    const settings = settingsRow?.settings && typeof settingsRow.settings === 'object' ? settingsRow.settings : {};
    const decision = settings[PROFILE_KEY] && typeof settings[PROFILE_KEY] === 'object' ? settings[PROFILE_KEY] : {};
    profileCache = { settings, decision };
    financialCache = financial || null;
    return { settings, decision, financial: financial || null };
  }

  function profileCompleteness(decision, financial) {
    const requiredBehaviour = ['discipline','impulse','remorse','upgrade','status','quality','goalFocus'];
    const behaviourDone = requiredBehaviour.filter((k) => Number.isFinite(Number(decision?.[k]))).length;
    const financialDone = [financial?.income_amount, financial?.essential_outgoings_monthly, financial?.debt_commitments_monthly, financial?.savings_target_monthly].filter((v) => v !== null && v !== undefined && v !== '').length;
    const total = requiredBehaviour.length + 4;
    return { complete: behaviourDone + financialDone, total, percent: Math.round(((behaviourDone + financialDone) / total) * 100), ready: behaviourDone === requiredBehaviour.length && financialDone === 4 };
  }

  function monthlyFreeCash(fin) {
    if (!fin || fin.income_amount == null) return null;
    const income = fin.income_period === 'annual' ? num(fin.income_amount) / 12 : num(fin.income_amount);
    return income - num(fin.essential_outgoings_monthly) - num(fin.debt_commitments_monthly) - num(fin.savings_target_monthly);
  }

  function affordabilityScore(record, fin) {
    const free = monthlyFreeCash(fin);
    const cost = num(record.observed_price) + num(record.inputs?.upkeep);
    if (free == null) return 50;
    if (free <= 0) return cost <= 0 ? 50 : 0;
    const ratio = cost / free;
    if (ratio <= .10) return 100;
    if (ratio <= .25) return 92;
    if (ratio <= .50) return 78;
    if (ratio <= .75) return 62;
    if (ratio <= 1) return 45;
    if (ratio <= 1.5) return 25;
    return 8;
  }

  function factorScores(record, decision, fin) {
    const price = Math.max(0, num(record.observed_price));
    const upkeep = Math.max(0, num(record.inputs?.upkeep));
    const total = price + upkeep;
    const uses = Math.max(1, num(record.inputs?.uses, 1));
    const joy = clamp(num(record.inputs?.joy, 5) * 10);
    const effort = Math.max(0, num(record.inputs?.effort));
    const minutes = Math.max(0, num(record.inputs?.minutes));
    const hourValue = Math.max(0, num(record.inputs?.hourValue));
    const motive = record.inputs?.motive || 'need';
    const hasAlternative = Boolean(String(record.inputs?.alternative || '').trim());
    const perUse = total / uses;

    const A = affordabilityScore(record, fin);
    const U = clamp(28 + Math.log2(uses + 1) * 11 + Math.min(18, (minutes * uses / 60 * hourValue) / Math.max(1, total) * 24) - Math.min(20, effort / uses * 5));
    const G = clamp((motive === 'need' ? 82 : motive === 'joy' ? 64 : 36) + (num(decision.goalFocus, 5) - 5) * (motive === 'image' ? -4 : 2) - (hasAlternative ? 4 : 0));
    const L = clamp(42 + Math.log2(uses + 1) * 9 + (motive === 'need' ? 14 : motive === 'joy' ? 8 : -6) - Math.min(16, effort / Math.max(1, uses) * 4));
    const V = clamp(100 / (1 + perUse / 15) + Math.min(18, Math.log2(uses + 1) * 2.2));
    const S = clamp(joy - num(decision.remorse, 5) * 1.8 + (motive === 'joy' ? 8 : 0));
    const Q = clamp(48 + num(decision.quality, 5) * 4 + Math.min(18, Math.log2(uses + 1) * 2.4) - Math.min(15, effort / Math.max(1, uses) * 4));
    const R = clamp(18 + num(decision.impulse, 5) * 4.6 + num(decision.status, 5) * 2.8 + num(decision.upgrade, 5) * 2.4 + (motive === 'image' ? 18 : 0) + (hasAlternative ? 8 : 0) - num(decision.goalFocus, 5) * 2.2);
    return { A, U, G, L, V, S, Q, R };
  }

  function weightsForDiscipline(d) {
    const t = (clamp(d, 1, 10) - 1) / 9;
    const raw = {
      A: 0.10 + 0.13 * t,
      U: 0.18 - 0.02 * t,
      G: 0.09 + 0.09 * t,
      L: 0.18 - 0.07 * t,
      V: 0.13 + 0.09 * t,
      S: 0.19 - 0.10 * t,
      Q: 0.13 + 0.02 * t,
      R: 0.09 + 0.12 * t,
    };
    const positiveTotal = raw.A + raw.U + raw.G + raw.L + raw.V + raw.S + raw.Q;
    return { ...raw, positiveTotal };
  }

  function recommendationFor(record, decision, fin) {
    const f = factorScores(record, decision, fin);
    const discipline = clamp(num(decision.discipline, 5), 1, 10);
    const w = weightsForDiscipline(discipline);
    const positive = (f.A*w.A + f.U*w.U + f.G*w.G + f.L*w.L + f.V*w.V + f.S*w.S + f.Q*w.Q) / w.positiveTotal;
    const riskPenalty = f.R * w.R * 0.62;
    const legacyAnchor = clamp(record.score) * 0.12;
    const tw = clamp(positive * 0.88 + legacyAnchor - riskPenalty);
    const free = monthlyFreeCash(fin);
    const financialRatio = free && free > 0 ? (num(record.observed_price) + num(record.inputs?.upkeep)) / free : null;
    let decisionLabel = 'WAIT';
    if (tw >= 74 && !(financialRatio != null && financialRatio > 1.25)) decisionLabel = 'BUY';
    else if (tw < 52 || (financialRatio != null && financialRatio > 1.75)) decisionLabel = 'SKIP';
    const completeness = profileCompleteness(decision, fin).percent;
    const confidence = clamp(55 + completeness * .28 + Math.abs(tw - 63) * .55, 58, 94);
    return { score: Math.round(tw), confidence: Math.round(confidence), decision: decisionLabel, factors: f, discipline, ratio: financialRatio };
  }

  function winnerCopy(left, right, lr, rr) {
    if (lr.decision === 'SKIP' && rr.decision === 'SKIP') return { label: 'NEITHER', record: null, score: Math.max(lr.score, rr.score), text: 'Neither option clears your current TruWorth threshold. Keeping the money is the stronger decision for now.' };
    if (lr.decision === 'WAIT' && rr.decision === 'WAIT' && Math.abs(lr.score - rr.score) < 5) return { label: 'WAIT', record: null, score: Math.max(lr.score, rr.score), text: 'The difference is too small to justify a confident purchase. Waiting gives you a better decision than forcing a winner.' };
    const pickLeft = lr.score >= rr.score;
    const winner = pickLeft ? left : right;
    const result = pickLeft ? lr : rr;
    const other = pickLeft ? rr : lr;
    const gap = Math.abs(lr.score - rr.score);
    const strength = gap >= 15 ? 'strongly' : gap >= 8 ? 'clearly' : 'slightly';
    const decisionText = result.decision === 'BUY' ? `TruWorth ${strength} prefers ${winner.title} for you.` : result.decision === 'WAIT' ? `${winner.title} leads, but your profile says wait rather than rush.` : `${winner.title} scores higher, but neither product earns a purchase recommendation yet.`;
    return { label: result.decision === 'BUY' ? 'BUY' : result.decision, record: winner, score: result.score, text: decisionText, otherScore: other.score };
  }

  function factorCard(label, key, result) {
    const value = Math.round(result.factors[key]);
    return `<div class="tw-factor"><span>${esc(label)}</span><strong>${value}/100</strong><div class="tw-factor-bar"><i style="width:${value}%"></i></div></div>`;
  }

  function renderDecisionMount(left, right) {
    const mount = document.getElementById('twDecisionMount');
    if (!mount) return;
    if (!user) {
      mount.innerHTML = `<section class="tw-recommendation-lock"><p class="kicker">Personal decision</p><h3>Sign in to move from comparison to recommendation.</h3><p>TruWorth can compare the products for everyone. A personal recommendation needs your saved profile and purchase history.</p><a class="primary-button" href="account.html">Sign in</a></section>`;
      return;
    }
    if (!PLUS_ACTIVE()) {
      mount.innerHTML = `<section class="tw-recommendation-lock"><p class="kicker">TruWorth+ recommendation</p><h3>Which one should you actually buy?</h3><p>Upgrade to use your financial position, buying habits and Decision Discipline setting to get a formal Buy / Wait / Skip / Neither recommendation.</p><a class="primary-button" href="plans.html">Unlock TruWorth+</a><div class="tw-math-note">TW = wAA·A + wUU·U + wGG·G + wLL·L + wVV·V + wSS·S + wQQ·Q − wRR·R</div></section>`;
      return;
    }
    mount.innerHTML = `<section class="tw-recommendation-lock"><p class="kicker">TruWorth+ recommendation</p><h3>Calculating your personal decision…</h3><p>Applying your financial profile, behaviour and Decision Discipline setting.</p></section>`;
    loadDecisionProfile().then(({ decision, financial }) => {
      const completion = profileCompleteness(decision, financial);
      if (!completion.ready) {
        mount.innerHTML = `<section class="tw-recommendation-lock"><p class="kicker">Recommendation readiness</p><h3>Complete your profile to unlock a personal recommendation.</h3><p>We have ${completion.percent}% of the information required. TruWorth will not pretend to know what is right for you without the financial and behavioural inputs behind the formula.</p><div class="tw-profile-meter"><span style="width:${completion.percent}%"></span></div><a class="primary-button" href="account.html#decision-profile">Complete my profile</a></section>`;
        return;
      }
      const lr = recommendationFor(left, decision, financial);
      const rr = recommendationFor(right, decision, financial);
      const verdict = winnerCopy(left, right, lr, rr);
      const winningResult = verdict.record?.id === left.id ? lr : verdict.record?.id === right.id ? rr : (lr.score >= rr.score ? lr : rr);
      const title = verdict.label === 'NEITHER' ? 'Neither earns your money right now.' : verdict.label === 'WAIT' && !verdict.record ? 'Wait. There is no strong winner yet.' : verdict.text;
      const body = verdict.record ? `${verdict.record.title} scores ${winningResult.score}/100 against your personal decision model. Your Decision Discipline is ${winningResult.discipline}/10 and the model is ${winningResult.confidence}% confident given the profile data available.` : `${verdict.text} The stronger of the two currently scores ${verdict.score}/100.`;
      mount.innerHTML = `<div class="tw-decision-shell">
        <section class="tw-decision-hero"><div><p class="kicker">Your TruWorth Decision</p><h2>${esc(title)}</h2><p>${esc(body)}</p><div class="tw-decision-actions"><span class="tw-pill">${esc(verdict.label)}</span><span class="tw-pill">Confidence ${winningResult.confidence}%</span><span class="tw-pill">Discipline ${winningResult.discipline}/10</span>${winningResult.ratio != null ? `<span class="tw-pill">Cost / free cash ${Math.round(winningResult.ratio*100)}%</span>` : ''}</div></div><div class="tw-decision-badge"><div><strong>${verdict.score}</strong><small>TW score</small></div></div></section>
        <section class="tw-factor-grid">${factorCard('Affordability','A',winningResult)}${factorCard('Utility','U',winningResult)}${factorCard('Goal alignment','G',winningResult)}${factorCard('Lifestyle fit','L',winningResult)}${factorCard('Value','V',winningResult)}${factorCard('Satisfaction','S',winningResult)}${factorCard('Quality / longevity','Q',winningResult)}${factorCard('Purchase risk','R',winningResult)}</section>
        <div class="tw-math-note">TW = wAA·A + wUU·U + wGG·G + wLL·L + wVV·V + wSS·S + wQQ·Q − wRR·R · weights adjusted by Decision Discipline ${winningResult.discipline}/10</div>
      </div>`;
    }).catch((error) => {
      console.error('TruWorth decision engine', error);
      mount.innerHTML = `<section class="tw-recommendation-lock"><h3>We could not load your personal recommendation.</h3><p>Your product comparison is still available above. Try refreshing before making a decision.</p></section>`;
    });
  }

  const baseComparePage = comparePage;
  comparePage = function() {
    if (records.length < 2) return baseComparePage();
    const ranked = sortedRecords();
    layout('Compare products', 'Compare the products — then let TruWorth decide which choice fits you.', `<section class="compare-controls"><label class="field"><span>First product</span><select id="compareLeft">${ranked.map((r) => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}</select></label><label class="field"><span>Second product</span><select id="compareRight">${ranked.map((r, i) => `<option value="${esc(r.id)}" ${i === 1 ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label></section><div class="tw-compare-intro">A product can be better on paper and still be the worse decision for you. TruWorth+ applies your financial position, behaviour and Decision Discipline after the side-by-side comparison.</div><div id="comparison"></div><div id="twDecisionMount"></div>`, { kicker: 'Comparison' });
    $('compareLeft').addEventListener('change', renderComparison);
    $('compareRight').addEventListener('change', renderComparison);
    renderComparison();
  };

  const baseRenderComparison = renderComparison;
  renderComparison = function() {
    baseRenderComparison();
    const left = records.find((r) => r.id === $('compareLeft')?.value);
    const right = records.find((r) => r.id === $('compareRight')?.value);
    if (!left || !right) return;
    const cards = document.querySelectorAll('.comparison-card');
    [left, right].forEach((r, i) => {
      if (r.observed_price == null || Number(r.observed_price) <= 0) {
        cards[i]?.insertAdjacentHTML('beforeend', `<div class="tw-price-missing"><strong>Price not verified</strong>TruWorth found the product but not a reliable cash price. Add the current price before relying on value or affordability results.</div>`);
      }
    });
    renderDecisionMount(left, right);
  };

  function profileRange(id, label, copy, value) {
    return `<label><span>${esc(label)}</span><small>${esc(copy)}</small><input id="${id}" type="range" min="1" max="10" step="1" value="${value}"><output id="${id}Out">${value}/10</output></label>`;
  }

  function renderDecisionProfileCard(decision = {}, financial = null) {
    if (!user) return;
    const anchor = document.querySelector('.account-sections,.account-list,.account-page,main .content,main') || document.querySelector('main');
    if (!anchor || document.getElementById('decision-profile')) return;
    const completion = profileCompleteness(decision, financial);
    const values = {
      discipline: clamp(num(decision.discipline, 5),1,10), impulse: clamp(num(decision.impulse,5),1,10), remorse: clamp(num(decision.remorse,5),1,10), upgrade: clamp(num(decision.upgrade,5),1,10), status: clamp(num(decision.status,5),1,10), quality: clamp(num(decision.quality,5),1,10), goalFocus: clamp(num(decision.goalFocus,5),1,10),
    };
    const card = document.createElement('section');
    card.className = 'tw-profile-card';
    card.id = 'decision-profile';
    card.innerHTML = `<header><div><p class="kicker">TruWorth Decision Profile</p><h2>How strongly should TruWorth challenge your spending?</h2><p>Your recommendation formula uses this behavioural profile alongside your financial position. It does not change product facts — it changes how strictly TruWorth weighs them for you.</p></div><span class="tw-profile-badge">${completion.percent}% ready</span></header>
      <div class="tw-discipline"><div class="tw-discipline-head"><div><strong>Decision Discipline</strong><p id="disciplineCopy"></p></div><strong id="disciplineOut">${values.discipline}/10</strong></div><input id="discipline" type="range" min="1" max="10" step="1" value="${values.discipline}"><div class="tw-scale-copy"><span>1 — Second opinion, lifestyle-led</span><span>10 — Challenge me, wealth-building bias</span></div></div>
      <div class="tw-behaviour-grid">
        ${profileRange('impulse','Impulse tendency','How often excitement drives a purchase.',values.impulse)}
        ${profileRange('remorse','Buyer’s remorse','How often you later question discretionary purchases.',values.remorse)}
        ${profileRange('upgrade','Early-upgrade tendency','How readily you replace products before they need replacing.',values.upgrade)}
        ${profileRange('status','Status / brand pull','How much image, status or brand prestige matters.',values.status)}
        ${profileRange('quality','Quality preference','How strongly you value quality and longevity over lowest price.',values.quality)}
        ${profileRange('goalFocus','Financial goal focus','How strongly current financial goals should constrain purchases.',values.goalFocus)}
      </div>
      <div class="tw-profile-save"><button class="primary-button" id="saveDecisionProfile" type="button">Save decision profile</button><span class="tw-profile-note" id="decisionProfileStatus">${PLUS_ACTIVE() ? 'Required for TruWorth+ personal recommendations.' : 'Set this now; personal recommendations unlock with TruWorth+.'}</span></div>
      <div class="tw-math-note">TW = wAA·A + wUU·U + wGG·G + wLL·L + wVV·V + wSS·S + wQQ·Q − wRR·R</div>`;
    anchor.appendChild(card);

    const disciplineCopy = () => {
      const d = num(document.getElementById('discipline')?.value,5);
      const copy = d <= 2 ? 'Prioritise fit, satisfaction and lifestyle. Flag major affordability problems, but do not lecture me.' : d <= 4 ? 'Lean toward enjoyment while still testing value and affordability.' : d <= 6 ? 'Balance enjoyment, value, goals and affordability.' : d <= 8 ? 'Require stronger justification and give opportunity cost more weight.' : 'Actively challenge unnecessary spending and favour long-term financial resilience.';
      document.getElementById('disciplineCopy').textContent = copy;
      document.getElementById('disciplineOut').textContent = `${d}/10`;
    };
    disciplineCopy();
    ['discipline','impulse','remorse','upgrade','status','quality','goalFocus'].forEach((id) => document.getElementById(id)?.addEventListener('input', (e) => { if (id === 'discipline') disciplineCopy(); const out = document.getElementById(`${id}Out`); if (out) out.textContent = `${e.target.value}/10`; }));
    document.getElementById('saveDecisionProfile')?.addEventListener('click', saveDecisionProfile);
  }

  async function saveDecisionProfile() {
    const status = document.getElementById('decisionProfileStatus');
    const button = document.getElementById('saveDecisionProfile');
    if (!user || !supabaseClient || !button) return;
    button.disabled = true;
    if (status) status.textContent = 'Saving…';
    try {
      const { settings } = await loadDecisionProfile(true);
      const decision = Object.fromEntries(['discipline','impulse','remorse','upgrade','status','quality','goalFocus'].map((id) => [id, num(document.getElementById(id)?.value,5)]));
      const merged = { ...settings, [PROFILE_KEY]: decision };
      const { error } = await supabaseClient.from('user_settings').upsert({ user_id: user.id, settings: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      profileCache = { settings: merged, decision };
      if (status) status.textContent = 'Decision profile saved.';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'We could not save your decision profile.';
    } finally { button.disabled = false; }
  }

  function enhanceImportFeedback() {
    const status = document.getElementById('importStatus');
    const price = document.getElementById('price');
    if (!status || !price || !user || status.dataset.decisionObserver) return;
    status.dataset.decisionObserver = '1';
    const observer = new MutationObserver(() => {
      if (/Details imported/i.test(status.textContent || '') && (!price.value || Number(price.value) <= 0)) {
        status.innerHTML = '<strong>Product found, price still missing.</strong> This retailer page may be a marketing page rather than a purchase page. TruWorth has tried the official buy-page fallback; enter the current cash price manually if the retailer still does not expose one.';
      }
    });
    observer.observe(status, { childList: true, subtree: true, characterData: true });
  }

  async function injectDecisionProfile() {
    if (page() !== 'account' || !user) return;
    try {
      const { decision, financial } = await loadDecisionProfile();
      renderDecisionProfileCard(decision, financial);
      if (location.hash === '#decision-profile') setTimeout(() => document.getElementById('decision-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) { console.error('Decision profile load failed', error); }
  }

  addDecisionStyles();
  window.addEventListener('truworth:routed', () => {
    enhanceImportFeedback();
    injectDecisionProfile();
  });
  setTimeout(() => {
    if (window.__TRUWORTH_ROUTED__) {
      enhanceImportFeedback();
      injectDecisionProfile();
    }
  }, 0);
})();
