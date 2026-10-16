(() => {
  'use strict';

  const plusActive = () => Boolean(user && subscription?.tier === 'plus' && ['active', 'trialing'].includes(String(subscription?.status || '')));
  const boughtRecords = () => records.filter((record) => record.status === 'purchased' || purchases?.[record.id]);
  const average = (items, selector) => items.length ? items.reduce((sum, item) => sum + Number(selector(item) || 0), 0) / items.length : 0;

  function motiveLabel(motive) {
    if (motive === 'need') return 'Practical';
    if (motive === 'joy') return 'Enjoyment-led';
    if (motive === 'image') return 'Impulse / image-led';
    return 'Mixed';
  }

  function dominantMotive(items) {
    const counts = items.reduce((acc, record) => {
      const key = record.inputs?.motive || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  function evidence(count) {
    if (count < 3) return { label: 'Just getting started', copy: 'A few more real decisions will make this more useful.' };
    if (count < 8) return { label: 'Early pattern', copy: 'There is enough history to spot a few tendencies.' };
    if (count < 15) return { label: 'Useful history', copy: 'Your patterns are becoming easier to trust.' };
    return { label: 'Strong history', copy: 'You have enough recorded decisions for repeated patterns to matter more.' };
  }

  function stressDrop(record) {
    try {
      const inputs = record.inputs || {};
      const cautious = score({
        ...inputs,
        item: record.title || inputs.item || 'Product',
        uses: Math.max(1, Math.round(Number(inputs.uses || 1) / 2)),
        joy: Math.max(1, Number(inputs.joy || 1) - 2)
      });
      return Math.max(0, Number(record.score || 0) - Number(cautious.score || 0));
    } catch {
      return null;
    }
  }

  function joyGap(bought) {
    const checks = bought.map((record) => {
      const actual = Number(purchases?.[record.id]?.actual_joy);
      const expected = Number(record.inputs?.joy);
      if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(expected) || expected <= 0) return null;
      return actual - expected;
    }).filter((value) => Number.isFinite(value));
    return checks.length ? Number(average(checks, (value) => value).toFixed(1)) : null;
  }

  function buyRateCopy(rate, count) {
    if (count < 3) return 'Too early to call a pattern yet.';
    if (rate <= 30) return 'Most things you check do not become purchases. You are using TruWorth as a filter.';
    if (rate >= 70) return 'Most things you check become purchases. A pause on mixed results may be useful.';
    return 'You are leaving a healthy gap between considering something and actually buying it.';
  }

  function scoreGapCopy(gap, boughtCount) {
    if (!boughtCount) return 'Mark purchases as bought to compare what you considered with what you actually chose.';
    if (gap >= 5) return 'The things you buy tend to score better than the wider set of things you consider.';
    if (gap <= -5) return 'Your purchases are scoring lower than the wider set of things you consider. That is worth looking at.';
    return 'The things you buy currently score about the same as the things you consider overall.';
  }

  function nextActions({ rate, stress, joy, boughtCount }) {
    const actions = [];
    if (records.length < 5) actions.push('Build the history: use TruWorth on a few more real purchases.');
    if (rate >= 70 && records.length >= 3) actions.push('When a result is mixed, wait a day before buying and see if you still feel the same.');
    if (stress != null && stress > 15) actions.push('Be tougher on your use estimate. Your scores move a lot when expected use is cut back.');
    if (joy != null && joy <= -0.7) actions.push('Lower your enjoyment estimate slightly next time. Your purchases are landing below what you expected.');
    if (boughtCount && joy == null) actions.push('Update one thing you bought with how much you actually enjoy it.');
    if (!actions.length) actions.push('Keep recording what you buy. The next useful change will come from more real outcomes.');
    return actions.slice(0, 2);
  }

  async function loadFinancialFit(bought) {
    const mount = document.getElementById('tw36FinancialPressure');
    if (!mount || !plusActive() || !user || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('financial_profiles')
        .select('currency,income_amount,income_period,essential_outgoings_monthly,debt_commitments_monthly,savings_target_monthly')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;

      if (!data?.income_amount) {
        mount.innerHTML = '<span>Financial fit</span><strong>Add your money context</strong><p>Complete your financial profile to see how purchases sit against your usual monthly free cash.</p><a href="account.html#financial-profile">Add financial profile →</a>';
        return;
      }

      const currency = String(data.currency || 'GBP').toUpperCase();
      const income = data.income_period === 'annual' ? Number(data.income_amount) / 12 : Number(data.income_amount);
      const freeCash = Math.max(0, income - Number(data.essential_outgoings_monthly || 0) - Number(data.debt_commitments_monthly || 0) - Number(data.savings_target_monthly || 0));
      const sameCurrency = bought.filter((record) => String(record.currency || record.inputs?.currency || 'GBP').toUpperCase() === currency && Number(record.observed_price || 0) > 0);

      if (!sameCurrency.length) {
        mount.innerHTML = `<span>Financial fit</span><strong>No ${currency} purchases to compare yet</strong><p>Once you record purchases in the same currency as your profile, TruWorth can show how heavy they are on your monthly free cash.</p>`;
        return;
      }

      const typical = average(sameCurrency, (record) => record.observed_price);
      const ratio = freeCash > 0 ? typical / freeCash : Infinity;
      let label = 'Heavy';
      if (ratio <= 0.25) label = 'Usually light';
      else if (ratio <= 0.6) label = 'Noticeable';
      else if (ratio <= 1) label = 'A stretch';

      const copy = freeCash > 0
        ? `Your typical recorded ${currency} purchase is about ${Math.round(ratio * 100)}% of one month’s free cash.`
        : 'Your current profile leaves no positive monthly free cash after commitments and your savings target.';
      mount.innerHTML = `<span>Financial fit</span><strong>${esc(label)}</strong><p>${esc(copy)}</p>`;
    } catch (error) {
      console.error('Could not load financial fit insight', error);
      mount.innerHTML = '<span>Financial fit</span><strong>Unavailable right now</strong><p>Your other Insights are still available.</p>';
    }
  }

  insightsPage = function insightsPageV36() {
    const bought = boughtRecords();
    const rate = records.length ? Math.round((bought.length / records.length) * 100) : 0;
    const allAverage = records.length ? Math.round(average(records, (record) => record.score)) : 0;
    const boughtAverage = bought.length ? Math.round(average(bought, (record) => record.score)) : 0;
    const scoreGap = bought.length ? boughtAverage - allAverage : 0;
    const motive = dominantMotive(records);
    const stressValues = records.map(stressDrop).filter((value) => Number.isFinite(value));
    const stress = stressValues.length ? Math.round(average(stressValues, (value) => value)) : null;
    const joy = joyGap(bought);
    const history = evidence(records.length);
    const plus = plusActive();
    const actions = nextActions({ rate, stress, joy, boughtCount: bought.length });

    layout('Insights', 'Your purchase history should make the next decision easier.', `
      <section class="tw36-insights-hero">
        <div>
          <p class="kicker">Your Insights</p>
          <h2>What your buying history is starting to show.</h2>
          <p>TruWorth compares what you consider, what you buy and, when you check back in, whether it lived up to expectations.</p>
        </div>
        <div class="tw36-evidence">
          <span>History so far</span>
          <strong>${esc(history.label)}</strong>
          <small>${esc(history.copy)}</small>
        </div>
      </section>

      <section class="tw36-snapshot" aria-label="Buying history summary">
        <article><span>Checked</span><strong>${records.length}</strong><small>Purchases you have assessed</small></article>
        <article><span>Bought</span><strong>${bought.length}</strong><small>Marked as purchased</small></article>
        <article><span>Check → buy</span><strong>${rate}%</strong><small>How often a check became a purchase</small></article>
        <article><span>Average score</span><strong>${records.length ? allAverage : '—'}</strong><small>${bought.length ? `Bought average: ${boughtAverage}` : 'Builds as your history grows'}</small></article>
      </section>

      <section class="tw36-section">
        <div class="tw36-section-head">
          <div><p class="kicker">The useful bit</p><h2>Your current patterns</h2></div>
          <p>Short, practical signals from the decisions you have actually recorded.</p>
        </div>
        <div class="tw36-signal-grid">
          <article class="tw36-signal"><span>How often you buy</span><strong>${rate}%</strong><p>${esc(buyRateCopy(rate, records.length))}</p></article>
          <article class="tw36-signal"><span>What gets your attention</span><strong>${esc(motive ? motiveLabel(motive) : 'Still forming')}</strong><p>${records.length ? 'This is the most common reason behind the purchases you have checked so far.' : 'Complete a few checks and this will start to take shape.'}</p></article>
          <article class="tw36-signal"><span>Do stronger scores win?</span><strong>${bought.length ? `${scoreGap >= 0 ? '+' : ''}${scoreGap} pts` : '—'}</strong><p>${esc(scoreGapCopy(scoreGap, bought.length))}</p></article>
        </div>
      </section>

      <section class="tw36-section tw36-premium-zone ${plus ? 'unlocked' : 'locked'}">
        <div class="tw36-section-head">
          <div><p class="kicker">TruWorth+</p><h2>Go a level deeper</h2></div>
          <span class="tw36-plan-pill">${plus ? 'Unlocked' : 'Plus'}</span>
        </div>
        ${plus ? `
          <div class="tw36-deep-grid">
            <article class="tw36-signal"><span>Reality check</span><strong>${stress == null ? '—' : `−${stress} pts`}</strong><p>${stress == null ? 'Complete a few more checks to build this view.' : stress > 15 ? 'Your scores move quite a lot when expected use and enjoyment are cut back.' : 'Your scores are holding up reasonably well when assumptions are made more cautious.'}</p></article>
            <article class="tw36-signal"><span>Did it live up to expectations?</span><strong>${joy == null ? '—' : `${joy >= 0 ? '+' : ''}${joy}`}</strong><p>${joy == null ? 'Update something you bought with how much you actually enjoy it.' : joy <= -0.7 ? 'Actual enjoyment is landing below what you expected before buying.' : joy >= 0.7 ? 'Your purchases are doing better than you expected.' : 'Your expectations and actual enjoyment are fairly close.'}</p></article>
            <article id="tw36FinancialPressure" class="tw36-signal financial"><span>Financial fit</span><strong>Loading…</strong><p>Comparing purchase size with the financial context you chose to add.</p></article>
          </div>
          <div class="tw36-actions-panel">
            <div><p class="kicker">Try next</p><h3>One or two things worth changing</h3></div>
            <ol>${actions.map((action) => `<li>${esc(action)}</li>`).join('')}</ol>
          </div>` : `
          <div class="tw36-unlock">
            <div><strong>Turn separate checks into a clearer buying history.</strong><span>Plus adds assumption checks, post-purchase patterns and financial context.</span></div>
            <a class="primary-button" href="plans.html">See TruWorth+</a>
          </div>`}
      </section>

      <section class="tw36-method-note"><strong>Keep it real.</strong><span>Insights become more useful when you assess things you genuinely might buy and update what actually happened.</span></section>
    `, { kicker: 'Your history' });

    if (plus) loadFinancialFit(bought);
  };
})();
