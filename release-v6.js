(() => {
  const originalAssessmentForm = assessmentForm;

  help = function(text) {
    return `<span class="help-wrap help-orange" tabindex="0" aria-label="${esc(text)}"><span class="help-star" aria-hidden="true">*</span><span class="help-tooltip" role="tooltip">${esc(text)}</span></span>`;
  };

  assessmentForm = function() {
    return originalAssessmentForm().replace('Setup & upkeep hours', 'Time & hassle involved');
  };

  const motiveLabel = (m) => m === 'need' ? 'Practical' : m === 'joy' ? 'Joy-led' : m === 'image' ? 'Impulse-led' : 'Exploring';
  const average = (items, selector) => items.length ? items.reduce((sum, item) => sum + Number(selector(item) || 0), 0) / items.length : 0;
  const purchasedRecords = () => records.filter((r) => r.status === 'purchased' || purchases[r.id]);
  const dominantMotive = (items) => {
    const counts = items.reduce((acc, r) => { const m = r.inputs?.motive || 'unknown'; acc[m] = (acc[m] || 0) + 1; return acc; }, {});
    return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
  };
  const buyerSnapshot = () => {
    const bought = purchasedRecords();
    const wantMotive = dominantMotive(records);
    const realMotive = dominantMotive(bought);
    const conversion = records.length ? Math.round((bought.length / records.length) * 100) : 0;
    return {
      wants: motiveLabel(wantMotive),
      real: bought.length ? motiveLabel(realMotive) : 'Still learning',
      conversion,
      consideredAverage: Math.round(average(records, (r) => r.score)),
      boughtAverage: Math.round(average(bought, (r) => r.score)),
      boughtCount: bought.length,
    };
  };

  homePage = function() {
    const ranked = sortedRecords().slice(0, 4);
    const snapshot = buyerSnapshot();
    layout('', '', `
      <section class="home-stage">
        <div class="home-copy">
          <span class="home-pill">A smarter gut-check for spending</span>
          <h1>Want it? <em>Worth it?</em><br>Let’s find out.</h1>
          <p>TruWorth helps you pressure-test a purchase before the excitement makes the decision for you.</p>
          <div class="home-primary-actions">
            <a class="primary-button hero-action" href="assess.html">Start a quick assessment</a>
            <a class="secondary-button" href="assess.html?q=">Find a product or service</a>
          </div>
          <div class="home-trust"><span>No account needed to try it</span><span>About 2 minutes</span><span>Save later if you want</span></div>
        </div>
        <div class="home-play-card" aria-hidden="true">
          <div class="play-orbit orbit-one"></div><div class="play-orbit orbit-two"></div>
          <div class="play-score"><span>TruWorth</span><strong>82</strong><small>Looks strong</small></div>
          <div class="play-chip chip-one">Use it loads?</div>
          <div class="play-chip chip-two">Still want it next month?</div>
          <div class="play-chip chip-three">Fits your real life?</div>
        </div>
      </section>

      <section class="home-paths">
        <a href="assess.html" class="home-path path-assess"><span>01</span><strong>Assess from scratch</strong><small>Already know what you’re considering? Start with the decision itself.</small></a>
        <a href="assess.html?q=" class="home-path path-search"><span>02</span><strong>Search for it</strong><small>Look for a product first, then bring the link back into TruWorth.</small></a>
        <a href="assess.html?mode=link" class="home-path path-link"><span>03</span><strong>Already have a link?</strong><small>Paste it into the assessor. Sign in only if you want automatic page import and cloud saving.</small></a>
      </section>

      ${records.length ? `<section class="buyer-teaser"><div><p class="kicker">Your buyer profile</p><h2>${snapshot.wants} wants. ${snapshot.real} reality.</h2><p>TruWorth is starting to learn the difference between what catches your eye and what you actually buy.</p></div><a class="secondary-button" href="insights.html">See my patterns</a></section>` : `<section class="buyer-teaser empty-profile"><div><p class="kicker">Built around you</p><h2>Your “Wants Me” and “Real Buyer Me” won’t always be the same.</h2><p>Use TruWorth a few times and the app will start showing the gap between what tempts you, what you buy and what actually fits.</p></div></section>`}

      <section class="home-library">
        <div class="home-library-head"><h2>${records.length ? 'Recent considerations' : 'Start with something you’re tempted by'}</h2>${records.length ? '<a href="watchlist.html">View all</a>' : ''}</div>
        ${records.length ? `<div class="product-list">${ranked.map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="home-empty"><p>Headphones. A holiday. A new phone. A gym membership. A ridiculously expensive coffee machine. Anything works.</p><a class="text-button" href="assess.html">Try your first one →</a></div>`}
      </section>`, { compact: true });
  };

  const verdictFor = (record, metrics, cautious) => {
    const delta = Number(record.score) - Number(cautious.score);
    const usageHeavy = Number(record.inputs?.uses || 0) >= 40;
    const joy = Number(record.inputs?.joy || 0);
    if (record.score >= 80) return {
      tone: cautious.score >= 65 ? 'green' : 'amber',
      eyebrow: cautious.score >= 65 ? 'Green light' : 'Strong, but assumption-sensitive',
      title: cautious.score >= 65 ? 'This looks like a genuinely strong buy for you.' : 'This looks good, but only if your assumptions hold up.',
      body: cautious.score >= 65
        ? `Even when we cut your expected usage in half and reduce enjoyment by two points, the score still lands at ${cautious.score}. That makes this decision fairly resilient rather than dependent on best-case thinking.`
        : `The headline score is strong, but the cautious scenario falls to ${cautious.score}. The purchase works best if you really use it as often as you expect.`,
      confidence: cautious.score >= 65 ? 'High confidence' : 'Medium confidence'
    };
    if (record.score >= 68) return { tone:'green', eyebrow:'Probably worth it', title:'The case is good, with one watch-out.', body:`The overall fit is strong. Under a more cautious scenario the score becomes ${cautious.score}, so check the assumption doing the most work before you buy.`, confidence: delta <= 12 ? 'Good confidence' : 'Medium confidence' };
    if (record.score >= 55) return { tone:'amber', eyebrow:'Pause and compare', title:'There is value here, but not enough to rush.', body:`Your current assumptions produce a ${record.score}, while a more cautious view lands at ${cautious.score}. Compare an alternative or wait a day before deciding.`, confidence:'Mixed confidence' };
    if (record.score >= 42) return { tone:'orange', eyebrow:'Think twice', title:'This is more tempting than convincing.', body:`The purchase is not clearly earning its place yet. A lower-cost alternative, higher expected use or stronger long-term enjoyment would improve the case.`, confidence:'Low confidence' };
    return { tone:'red', eyebrow:'Probably skip', title:'The numbers are fighting the purchase.', body:`Right now the cost, expected use and lasting enjoyment do not support the decision. Unless something important is missing from the assessment, keeping the money is the stronger choice.`, confidence:'Low confidence' };
  };

  async function injectFinancialFit(record) {
    const mount = $('financialFitMount');
    if (!mount || !user || !supabaseClient) return;
    const { data } = await supabaseClient.from('financial_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (!data || data.income_amount == null) {
      mount.innerHTML = `<div class="financial-fit-empty"><strong>Add financial context</strong><span>Tell TruWorth about your usual income and commitments to see how this purchase fits your real month.</span><a href="account.html#financial-profile">Add in profile</a></div>`;
      return;
    }
    const monthlyIncome = data.income_period === 'annual' ? Number(data.income_amount) / 12 : Number(data.income_amount);
    const freeCash = Math.max(0, monthlyIncome - Number(data.essential_outgoings_monthly || 0) - Number(data.debt_commitments_monthly || 0) - Number(data.savings_target_monthly || 0));
    const cost = Number(record.observed_price || 0);
    const ratio = freeCash > 0 ? cost / freeCash : Infinity;
    let label = 'Heavy', tone = 'red', copy = 'This purchase is larger than your usual monthly free cash.';
    if (ratio <= .25) { label='Comfortable'; tone='green'; copy=`About ${Math.round(ratio*100)}% of one month’s free cash.`; }
    else if (ratio <= .6) { label='Noticeable'; tone='amber'; copy=`About ${Math.round(ratio*100)}% of one month’s free cash.`; }
    else if (ratio <= 1) { label='Stretch'; tone='orange'; copy=`About ${Math.round(ratio*100)}% of one month’s free cash.`; }
    else if (Number.isFinite(ratio)) copy=`Roughly ${ratio.toFixed(1)} months of your usual free cash.`;
    mount.innerHTML = `<div class="financial-fit-row ${tone}"><span>Financial fit</span><strong>${label}</strong><small>${copy}</small></div>`;
  }

  resultPage = function() {
    const record = findRecord();
    if (!record) {
      layout('Product not found', 'It may have been removed or saved under another account.', `<div class="empty-state"><h3>No assessment here</h3><p>Return to your saved products or start a new assessment.</p><a class="secondary-button" href="watchlist.html">View saved products</a></div>`, { kicker: 'Assessment' });
      return;
    }
    const metrics = score({ ...record.inputs, item: record.title });
    const cautious = score({ ...record.inputs, item: record.title, uses: Math.max(1, Math.round(Number(record.inputs.uses) / 2)), joy: Math.max(1, Number(record.inputs.joy) - 2) });
    const verdict = verdictFor(record, metrics, cautious);
    const bought = record.status === 'purchased' || Boolean(purchases[record.id]);
    const watchouts = [];
    if (Number(record.inputs.joy) >= 8) watchouts.push('Your enjoyment estimate is doing meaningful work in this result.');
    if (Number(record.inputs.uses) >= 50) watchouts.push(`The value case assumes you reach roughly ${Number(record.inputs.uses).toLocaleString('en-GB')} uses.`);
    if (record.inputs.motive === 'image') watchouts.push('You marked the motivation as impulse/status-led, so TruWorth has deliberately penalised the score.');
    if (!record.inputs.alternative) watchouts.push('You did not record an existing alternative, so there may still be a cheaper way to get the same outcome.');
    layout(record.title, [record.brand, record.retailer].filter(Boolean).join(' · ') || 'Saved assessment', `
      <section class="result-layout result-v6">
        <section class="decision-verdict ${verdict.tone}"><div><span>${verdict.eyebrow}</span><h2>${verdict.title}</h2><p>${verdict.body}</p></div><div class="confidence-pill">${verdict.confidence}</div></section>
        <div class="product-result-card">
          ${productImage(record, 'hero')}
          <div class="product-result-copy">
            <div class="result-score"><span>TruWorth score</span><strong>${record.score}</strong><small>${labelForScore(record.score)}</small></div>
            <div class="result-metrics"><div><span>Cost per use</span><strong>${money(metrics.perUse, record.currency || 'GBP')}</strong></div><div><span>Estimated total</span><strong>${money(metrics.total, record.currency || 'GBP')}</strong></div><div><span>Planned uses</span><strong>${Number(record.inputs.uses).toLocaleString('en-GB')}</strong></div><div><span>Enjoyment</span><strong>${record.inputs.joy}/10</strong></div></div>
            <div class="result-actions">${record.source_url ? `<a class="primary-button" href="${esc(record.source_url)}" target="_blank" rel="noopener noreferrer">View product ${icon('external')}</a>` : ''}${bought ? `<a class="secondary-button" href="owned.html?id=${encodeURIComponent(record.id)}">Update actual use</a>` : `<button class="secondary-button" id="markBought" type="button">I bought it</button>`}</div>
          </div>
        </div>
        <section id="financialFitMount" class="financial-fit-mount"></section>
        <div class="decision-details">
          <section><p class="kicker">Stress test</p><h2>Does the decision survive reality?</h2><p>Half the expected usage and two points less enjoyment would move the score from <strong>${record.score}</strong> to <strong>${cautious.score}</strong>.</p><div class="stress-bar"><span style="width:${Math.max(4,cautious.score)}%"></span></div></section>
          <section><p class="kicker">What to watch</p><h2>${watchouts.length ? 'Before you press buy' : 'Nothing obvious is undermining this one'}</h2>${watchouts.length ? `<div class="watchout-list">${watchouts.map((x) => `<p>${esc(x)}</p>`).join('')}</div>` : '<p>Your assumptions are reasonably balanced. The main question is whether the purchase still feels worthwhile after the initial excitement fades.</p>'}</section>
          <section><p class="kicker">Why you want it</p><h2>${record.inputs.motive === 'need' ? 'Primarily useful' : record.inputs.motive === 'joy' ? 'Primarily for enjoyment' : 'Impulse or image led'}</h2><p>${record.inputs.alternative ? `You compared it with ${esc(record.inputs.alternative)}.` : 'No alternative was recorded.'}</p></section>
        </div>
      </section>`, { kicker: 'Assessment result', action: `<a class="text-button" href="compare.html">Compare with another</a>` });
    if ($('markBought')) $('markBought').addEventListener('click', () => markPurchased(record));
    injectFinancialFit(record);
  };

  function buyerHeadline(snapshot) {
    if (!records.length) return 'Your buyer profile starts with your first assessment.';
    if (!snapshot.boughtCount) return `Your Wants Self currently looks ${snapshot.wants.toLowerCase()}. We need a purchase or two to meet your Real Buyer.`;
    if (snapshot.wants !== snapshot.real) return `You browse like a ${snapshot.wants.toLowerCase()} buyer, but spend like a ${snapshot.real.toLowerCase()} one.`;
    return `What tempts you and what you actually buy are currently telling the same ${snapshot.wants.toLowerCase()} story.`;
  }

  async function loadPremiumInsights() {
    const mount = $('premiumInsightsMount');
    if (!mount || !user || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient.functions.invoke('buyer-insights', { body: {} });
      if (error) throw error;
      const headline = $('buyerHeadline');
      if (headline && data?.teaser?.headline) headline.textContent = data.teaser.headline;
      if (!data?.premium) return;
      const p = data.profile;
      mount.classList.remove('premium-locked');
      mount.innerHTML = `<div class="premium-unlocked-head"><span>TruWorth+ Buyer Profile</span><strong>${esc(p.wants)} Wants You · ${esc(p.real)} Real Buyer</strong></div><div class="premium-metrics"><div><span>Conversion</span><strong>${p.conversionRate}%</strong></div><div><span>Average considered</span><strong>${p.consideredAverageScore}</strong></div><div><span>Average purchased</span><strong>${p.purchasedAverageScore || '—'}</strong></div></div><div class="premium-observations">${(p.observations || []).map((x) => `<p>${esc(x)}</p>`).join('') || '<p>Your deeper patterns will sharpen as your history grows.</p>'}</div>`;
    } catch (error) {
      console.error('Buyer insights unavailable', error);
    }
  }

  insightsPage = function() {
    const snapshot = buyerSnapshot();
    const bought = purchasedRecords();
    const avgScore = records.length ? Math.round(average(records, r => r.score)) : 0;
    const totalConsidered = records.reduce((sum, r) => sum + Number(r.observed_price || 0), 0);
    const plus = subscription.tier === 'plus' && ['active','trialing'].includes(subscription.status);
    layout('Your Buyer Profile', 'The gap between what catches your eye and what actually earns your money.', `
      <section class="buyer-profile-hero">
        <p class="kicker">Wants You vs Real Buyer You</p>
        <h2 id="buyerHeadline">${esc(buyerHeadline(snapshot))}</h2>
        <div class="buyer-identities"><div class="identity-bubble wants"><span>Wants You</span><strong>${esc(snapshot.wants)}</strong><small>Based on what you consider</small></div><div class="identity-bridge">vs</div><div class="identity-bubble real"><span>Real Buyer You</span><strong>${esc(snapshot.real)}</strong><small>Based on what you actually buy</small></div></div>
      </section>
      <section class="insight-cards"><article><span>Average score</span><strong>${records.length ? avgScore : '—'}</strong><small>${records.length} consideration${records.length === 1 ? '' : 's'}</small></article><article><span>Converted to purchase</span><strong>${snapshot.conversion}%</strong><small>${bought.length} purchase${bought.length === 1 ? '' : 's'}</small></article><article><span>Value considered</span><strong>${money(totalConsidered)}</strong><small>Total listed price reviewed</small></article></section>
      <section id="premiumInsightsMount" class="premium-insights ${plus ? '' : 'premium-locked'}">
        ${plus ? '<div class="premium-loading">Building your deeper Buyer Profile…</div>' : `<div class="steam-content" aria-hidden="true"><div class="steam-card"><span>Where temptation wins</span><strong>Premium tech & lifestyle</strong><p>Your strongest recurring behavioural pattern appears here.</p></div><div class="steam-card"><span>Financial comfort pattern</span><strong>0.6 months free cash</strong><p>See where your real purchases usually land.</p></div><div class="steam-card"><span>Decision coaching</span><strong>Wait, compare, or go</strong><p>Personal guidance based on your own behaviour.</p></div></div><div class="steam-overlay"><div class="steam-drop"></div><p>There’s more of you behind the glass.</p><h3>Unlock your full Buyer Profile</h3><span>See deeper financial habits, temptation patterns, conversion behaviour and personalised guidance.</span><a class="primary-button" href="plans.html">Subscribe now</a></div>`}
      </section>`, { kicker: 'Insights' });
    loadPremiumInsights();
  };

  async function loadFinancialProfileIntoForm() {
    if (!user || !supabaseClient || !$('financialForm')) return;
    const { data } = await supabaseClient.from('financial_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      $('incomeAmount').value = data.income_amount ?? '';
      $('incomePeriod').value = data.income_period || 'monthly';
      $('essentialOutgoings').value = data.essential_outgoings_monthly ?? '';
      $('debtCommitments').value = data.debt_commitments_monthly ?? '';
      $('savingsTarget').value = data.savings_target_monthly ?? '';
    }
    recalcFinancialPreview();
  }

  function recalcFinancialPreview() {
    const mount = $('financialPreview');
    if (!mount) return;
    const amount = Number($('incomeAmount')?.value || 0);
    const monthly = $('incomePeriod')?.value === 'annual' ? amount / 12 : amount;
    const free = Math.max(0, monthly - Number($('essentialOutgoings')?.value || 0) - Number($('debtCommitments')?.value || 0) - Number($('savingsTarget')?.value || 0));
    mount.innerHTML = amount ? `<span>Estimated monthly free cash</span><strong>${money(free)}</strong><small>After the commitments you entered</small>` : '<span>Add your income to calculate monthly free cash.</span>';
  }

  async function saveFinancialProfile(event) {
    event.preventDefault();
    const status = $('financialStatus');
    const payload = {
      user_id: user.id,
      currency: 'GBP',
      income_amount: $('incomeAmount').value ? Number($('incomeAmount').value) : null,
      income_period: $('incomePeriod').value,
      essential_outgoings_monthly: $('essentialOutgoings').value ? Number($('essentialOutgoings').value) : null,
      debt_commitments_monthly: $('debtCommitments').value ? Number($('debtCommitments').value) : null,
      savings_target_monthly: $('savingsTarget').value ? Number($('savingsTarget').value) : null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient.from('financial_profiles').upsert(payload, { onConflict: 'user_id' });
    status.textContent = error ? 'We could not save your financial context.' : 'Financial context saved.';
    status.className = `form-message ${error ? 'error' : 'success'}`;
    if (!error) recalcFinancialPreview();
  }

  signedInAccountPage = function() {
    const limit = subscription.tier === 'plus' ? 'Unlimited saved products' : `${records.length} of 10 products saved`;
    const snapshot = buyerSnapshot();
    layout('Your profile', user.email, `
      <section class="account-overview profile-v6"><div class="account-profile"><div class="avatar">${esc((user.email || 'T').charAt(0).toUpperCase())}</div><div><span>Email</span><strong>${esc(user.email)}</strong></div></div><div class="account-stats"><div><span>Plan</span><strong>${subscription.tier === 'plus' ? 'TruWorth+' : 'Free'}</strong></div><div><span>Storage</span><strong>${limit}</strong></div></div><div class="account-actions"><a class="secondary-button" href="plans.html">Membership</a><button id="signOut" class="text-button" type="button">Sign out</button></div></section>
      <section class="profile-personality"><div><p class="kicker">Me as a buyer</p><h2>${esc(snapshot.wants)} Wants You. ${esc(snapshot.real)} Real Buyer.</h2><p>${esc(buyerHeadline(snapshot))}</p></div><a class="secondary-button" href="insights.html">Open Buyer Profile</a></section>
      <section id="financial-profile" class="financial-profile-card"><div class="financial-profile-copy"><p class="kicker">Optional financial context</p><h2>Help TruWorth understand your real-life comfort zone.</h2><p>This stays private to your account. It lets TruWorth separate “good value” from “good value for your actual month”.</p></div><form id="financialForm" class="financial-form"><div class="form-grid two"><label class="field"><span>Take-home income</span><div class="money-input"><span>£</span><input id="incomeAmount" type="number" min="0" step="0.01" placeholder="e.g. 3500"></div></label><label class="field"><span>Income period</span><select id="incomePeriod"><option value="monthly">Per month</option><option value="annual">Per year</option></select></label><label class="field"><span>Essential outgoings / month</span><div class="money-input"><span>£</span><input id="essentialOutgoings" type="number" min="0" step="0.01" placeholder="Rent, bills, food"></div></label><label class="field"><span>Debt & fixed commitments / month</span><div class="money-input"><span>£</span><input id="debtCommitments" type="number" min="0" step="0.01" placeholder="Loans, finance, contracts"></div></label><label class="field span-2"><span>Savings target / month</span><div class="money-input"><span>£</span><input id="savingsTarget" type="number" min="0" step="0.01" placeholder="Optional"></div></label></div><div id="financialPreview" class="financial-preview"><span>Add your income to calculate monthly free cash.</span></div><p id="financialStatus" class="form-message" role="status"></p><button class="primary-button" type="submit">Save financial context</button></form></section>`, { kicker: 'Account' });
    $('signOut').addEventListener('click', async () => { await supabaseClient.auth.signOut(); location.href = 'index.html'; });
    $('financialForm').addEventListener('submit', saveFinancialProfile);
    ['incomeAmount','incomePeriod','essentialOutgoings','debtCommitments','savingsTarget'].forEach((id) => $(id).addEventListener('input', recalcFinancialPreview));
    loadFinancialProfileIntoForm();
  };

  plansPage = function() {
    const isPlus = subscription.tier === 'plus' && ['active','trialing'].includes(subscription.status);
    layout('Membership', 'Free helps you make the decision. TruWorth+ helps you understand the person making it.', `<section class="membership-sheet membership-v6">
      <article class="membership-row"><div class="membership-name"><span>Free</span><strong>£0</strong></div><div class="membership-copy"><h2>Score the decision</h2><p>Core assessments, basic verdicts, saved history, comparisons and a simple Buyer Profile headline.</p></div><span class="plan-status">${!isPlus ? 'Current plan' : 'Included'}</span></article>
      <article class="membership-row plus-row"><div class="membership-name"><span>TruWorth+</span><strong>Deeper</strong></div><div class="membership-copy"><h2>Understand your behaviour</h2><p>Full Wants You vs Real Buyer analysis, financial-fit habits, recurring temptation patterns, behaviour over time, personalised warnings and unlimited saved history.</p><div class="plus-tags"><span>Buyer personality</span><span>Financial patterns</span><span>Personal guidance</span><span>Unlimited history</span></div></div>${isPlus ? '<span class="plan-status">Current plan</span>' : '<button class="primary-button" id="subscribeNow" type="button">Subscribe now</button>'}</article>
    </section><p id="billingNotice" class="form-message billing-notice" role="status"></p>`, { kicker: 'TruWorth+' });
    if ($('subscribeNow')) $('subscribeNow').addEventListener('click', () => { $('billingNotice').textContent = 'Secure checkout is the final connection still required for TruWorth+. Your premium entitlement and insight engine are already in place.'; $('billingNotice').className='form-message billing-notice success'; });
  };

  setTimeout(() => { try { route(); } catch (error) { console.error('TruWorth v6 rerender failed', error); } }, 60);
})();
