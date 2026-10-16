(() => {
  'use strict';

  const isPlus = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(String(subscription?.status || '')));
  const purchasedRecords = () => records.filter((r) => r.status === 'purchased' || purchases?.[r.id]);
  const avg = (items, selector) => items.length ? items.reduce((sum, item) => sum + Number(selector(item) || 0), 0) / items.length : 0;
  const pct = (value) => `${Math.round(Number(value || 0))}%`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const motiveName = (motive) => motive === 'need' ? 'Practical' : motive === 'joy' ? 'Joy-led' : motive === 'image' ? 'Impulse / image-led' : 'Still forming';
  const motiveLower = (motive) => motiveName(motive).toLowerCase();

  function evidenceStrength(count) {
    if (count < 3) return { label: 'Early signal', tone: 'early', copy: 'A few more assessments are needed before TruWorth treats these patterns as meaningful.' };
    if (count < 8) return { label: 'Developing', tone: 'developing', copy: 'There is enough history to spot early tendencies, but one or two new decisions can still move the picture.' };
    if (count < 15) return { label: 'Useful pattern', tone: 'useful', copy: 'Your history is now large enough for recurring tendencies to be more informative.' };
    return { label: 'Stronger evidence', tone: 'strong', copy: 'Your history contains enough decisions for repeated patterns to carry more weight.' };
  }

  function currencyTotals(source) {
    const totals = new Map();
    source.forEach((r) => {
      const amount = Number(r.observed_price || r.inputs?.price || 0);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const currency = /^[A-Z]{3}$/i.test(String(r.currency || r.inputs?.currency || '')) ? String(r.currency || r.inputs?.currency).toUpperCase() : 'GBP';
      totals.set(currency, (totals.get(currency) || 0) + amount);
    });
    return totals;
  }

  function moneySummary(source) {
    const totals = currencyTotals(source);
    if (!totals.size) return { value: '—', note: 'Add prices to build this view.' };
    if (totals.size === 1) {
      const [currency, total] = [...totals.entries()][0];
      return { value: money(total, currency), note: `Total ${source === records ? 'value reviewed' : 'recorded purchase value'} in ${currency}.` };
    }
    return { value: `${totals.size} currencies`, note: 'Kept separate so different currencies are never added into a misleading total.' };
  }

  function dominantMotive(source) {
    const counts = source.reduce((acc, r) => {
      const motive = r.inputs?.motive || 'unknown';
      acc[motive] = (acc[motive] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  function motiveStats() {
    const boughtIds = new Set(purchasedRecords().map((r) => r.id));
    return ['need','joy','image'].map((motive) => {
      const considered = records.filter((r) => r.inputs?.motive === motive).length;
      const bought = records.filter((r) => r.inputs?.motive === motive && boughtIds.has(r.id)).length;
      return { motive, considered, bought, conversion: considered ? Math.round((bought / considered) * 100) : null };
    });
  }

  function stressGap(record) {
    try {
      const inputs = record.inputs || {};
      const uses = Math.max(1, Math.round(Number(inputs.uses || 1) / 2));
      const joy = Math.max(1, Number(inputs.joy || 1) - 2);
      const cautious = score({ ...inputs, item: record.title || inputs.item || 'Product', uses, joy });
      const headline = Number(record.score || 0);
      if (!Number.isFinite(headline) || !Number.isFinite(Number(cautious.score))) return null;
      return Math.max(0, headline - Number(cautious.score));
    } catch {
      return null;
    }
  }

  function insightModel() {
    const bought = purchasedRecords();
    const consideredAverage = records.length ? Math.round(avg(records, (r) => r.score)) : 0;
    const boughtAverage = bought.length ? Math.round(avg(bought, (r) => r.score)) : 0;
    const conversion = records.length ? Math.round((bought.length / records.length) * 100) : 0;
    const consideredMotive = dominantMotive(records);
    const boughtMotive = dominantMotive(bought);
    const impulseCount = records.filter((r) => r.inputs?.motive === 'image').length;
    const impulseShare = records.length ? Math.round((impulseCount / records.length) * 100) : 0;
    const weakPurchases = bought.filter((r) => Number(r.score || 0) < 55);
    const strongUnbought = records.filter((r) => !bought.some((b) => b.id === r.id) && Number(r.score || 0) >= 68);
    const gaps = records.map(stressGap).filter((x) => Number.isFinite(x));
    const averageStressGap = gaps.length ? Math.round(avg(gaps, (x) => x)) : null;
    const scoreDelta = bought.length ? boughtAverage - consideredAverage : null;
    const motives = motiveStats();
    const highestConversionMotive = motives.filter((x) => x.conversion != null && x.considered >= 2).sort((a,b) => b.conversion - a.conversion)[0] || null;

    const joyChecks = bought.map((r) => {
      const tracked = purchases?.[r.id];
      const actual = Number(tracked?.actual_joy);
      const planned = Number(r.inputs?.joy);
      if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(planned) || planned <= 0) return null;
      return { actual, planned, delta: actual - planned };
    }).filter(Boolean);
    const joyDelta = joyChecks.length ? Number(avg(joyChecks, (x) => x.delta).toFixed(1)) : null;

    return {
      bought, consideredAverage, boughtAverage, conversion, consideredMotive, boughtMotive,
      impulseShare, weakPurchases, strongUnbought, averageStressGap, scoreDelta,
      highestConversionMotive, joyChecks, joyDelta, evidence: evidenceStrength(records.length),
      reviewed: moneySummary(records), purchasedValue: moneySummary(bought)
    };
  }

  function selectivitySignal(model) {
    if (records.length < 3) return { label: 'Still learning', value: `${model.conversion}%`, copy: 'Complete a few more assessments before treating your purchase rate as a pattern.' };
    if (model.conversion <= 30) return { label: 'Selective buyer', value: `${model.conversion}%`, copy: 'Most things you assess do not become purchases. TruWorth is acting more like a filter than a shopping accelerator.' };
    if (model.conversion >= 70) return { label: 'High conversion', value: `${model.conversion}%`, copy: 'Most things you assess become purchases. When a result is mixed, adding a cooling-off period may create more separation between wanting and buying.' };
    return { label: 'Measured conversion', value: `${model.conversion}%`, copy: 'Your assessment history shows a meaningful gap between consideration and purchase, without most decisions automatically converting.' };
  }

  function scoreDisciplineSignal(model) {
    if (!model.bought.length) return { label: 'No purchase evidence yet', value: '—', copy: 'Record what you actually buy and TruWorth can compare your decisions with the wider set of things you considered.' };
    const delta = Number(model.scoreDelta || 0);
    if (delta >= 5) return { label: 'Stronger cases convert', value: `+${delta} pts`, copy: 'The things you record as purchased score higher than your wider consideration set. Your final filter appears to be improving decision quality.' };
    if (delta <= -5) return { label: 'Value leakage', value: `${delta} pts`, copy: 'Your recorded purchases score below the wider set of things you consider. Review what overrode the stronger value signal at the moment of purchase.' };
    return { label: 'Score-neutral buying', value: `${delta >= 0 ? '+' : ''}${delta} pts`, copy: 'Your purchases currently score about the same as the products you consider overall. The score is not yet clearly separating what you buy from what you leave.' };
  }

  function sensitivitySignal(model) {
    if (model.averageStressGap == null) return { label: 'Not enough inputs', value: '—', copy: 'Complete assessments with realistic use and enjoyment assumptions to unlock this signal.' };
    if (model.averageStressGap <= 10) return { label: 'More resilient', value: `−${model.averageStressGap} pts`, copy: 'On average, halving expected use and reducing enjoyment by two points does not destroy the case. Your assessments are less dependent on best-case assumptions.' };
    if (model.averageStressGap <= 20) return { label: 'Assumption-sensitive', value: `−${model.averageStressGap} pts`, copy: 'Your scores move materially when usage and enjoyment are stress-tested. Future decisions deserve a cautious second pass before purchase.' };
    return { label: 'Fragile assumptions', value: `−${model.averageStressGap} pts`, copy: 'Your average result is highly dependent on optimistic usage or enjoyment. Stress-testing before checkout could materially change the decision.' };
  }

  function satisfactionSignal(model) {
    if (!model.joyChecks.length) return { label: 'Build the feedback loop', value: '—', copy: 'After you buy something, update its actual enjoyment. TruWorth can then show whether your pre-purchase expectations are usually too optimistic or too cautious.' };
    if (model.joyDelta >= 0.7) return { label: 'Better than expected', value: `+${model.joyDelta}`, copy: 'Your recorded post-purchase enjoyment is running above what you expected before buying. Your pre-purchase estimates may be conservative.' };
    if (model.joyDelta <= -0.7) return { label: 'Expectation gap', value: `${model.joyDelta}`, copy: 'Actual enjoyment is running below your pre-purchase expectation. Consider shaving a point from future excitement-led estimates and see whether the decision still holds.' };
    return { label: 'Expectations are close', value: `${model.joyDelta >= 0 ? '+' : ''}${model.joyDelta}`, copy: 'Your recorded enjoyment after purchase is broadly matching what you expected beforehand.' };
  }

  function strongestPattern(model) {
    if (records.length < 3) return `TruWorth is still learning. Your next useful milestone is 3–5 properly completed assessments rather than more browsing.`;
    if (model.consideredMotive && model.boughtMotive && model.bought.length && model.consideredMotive !== model.boughtMotive) {
      return `What catches your eye leans ${motiveLower(model.consideredMotive)}, while what you actually buy leans ${motiveLower(model.boughtMotive)}. That gap is useful: temptation and action are not the same behaviour for you.`;
    }
    if (model.highestConversionMotive) return `${motiveName(model.highestConversionMotive.motive)} assessments currently have your highest purchase conversion at ${model.highestConversionMotive.conversion}%. That is the motive most likely to move from “considering” to “bought”.`;
    if (model.impulseShare >= 40) return `${model.impulseShare}% of your assessments are impulse or image-led. That does not make them wrong, but it means cooling-off time is especially valuable in your decision process.`;
    return `Your current history leans ${motiveLower(model.consideredMotive)}. As you record more purchases and post-purchase check-ins, TruWorth will separate what attracts you from what genuinely works for you.`;
  }

  function actionPlan(model) {
    const actions = [];
    if (records.length < 5) actions.push('Build the sample: complete at least five real purchase assessments before relying heavily on behavioural patterns.');
    if (model.conversion >= 70 && records.length >= 3) actions.push('Use a cooling-off rule when a result is mixed. Your current purchase conversion is high enough that assessment may be validating desire more often than filtering it.');
    if (model.impulseShare >= 35) actions.push('For impulse or image-led purchases, re-run the decision after 24 hours and compare the score with the original.');
    if (model.averageStressGap != null && model.averageStressGap > 15) actions.push('Stress-test expected usage before checkout. Halve your use estimate and reduce enjoyment by two points; if the decision collapses, it is assumption-sensitive.');
    if (model.weakPurchases.length) actions.push(`Review the ${model.weakPurchases.length} recorded purchase${model.weakPurchases.length === 1 ? '' : 's'} that scored below 55. The useful question is what overrode the weaker value case.`);
    if (model.joyDelta != null && model.joyDelta <= -0.7) actions.push('Calibrate excitement down slightly on future assessments. Your post-purchase enjoyment is currently landing below the expectation you entered before buying.');
    if (!model.joyChecks.length && model.bought.length) actions.push('Add a post-purchase enjoyment check-in to at least one owned item. That is how TruWorth learns whether your expectations are accurate.');
    if (!actions.length) actions.push('Keep recording what you buy and how it performs. Your current pattern is reasonably balanced; the next value comes from a longer feedback history.');
    return actions.slice(0, 4);
  }

  function basicPatternCard(title, value, copy, tone = '') {
    return `<article class="tw36-signal ${tone}"><span>${esc(title)}</span><strong>${esc(value)}</strong><p>${esc(copy)}</p></article>`;
  }

  async function loadFinancialPressure(model) {
    const mount = document.getElementById('tw36FinancialPressure');
    if (!mount || !isPlus() || !user || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient.from('financial_profiles').select('currency,income_amount,income_period,essential_outgoings_monthly,debt_commitments_monthly,savings_target_monthly').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data?.income_amount) {
        mount.innerHTML = `<span>Financial pressure</span><strong>Add your money context</strong><p>Complete the financial section of your Decision Profile and TruWorth can compare typical purchase size with the monthly cash you actually have available after commitments and your savings target.</p><a href="account.html#financial-profile">Complete financial profile →</a>`;
        return;
      }
      const currency = /^[A-Z]{3}$/i.test(String(data.currency || '')) ? String(data.currency).toUpperCase() : 'GBP';
      const monthlyIncome = data.income_period === 'annual' ? Number(data.income_amount) / 12 : Number(data.income_amount);
      const freeCash = Math.max(0, monthlyIncome - Number(data.essential_outgoings_monthly || 0) - Number(data.debt_commitments_monthly || 0) - Number(data.savings_target_monthly || 0));
      const sameCurrency = model.bought.filter((r) => String(r.currency || r.inputs?.currency || 'GBP').toUpperCase() === currency && Number(r.observed_price || 0) > 0);
      if (!sameCurrency.length) {
        mount.innerHTML = `<span>Financial pressure</span><strong>No comparable ${currency} purchases yet</strong><p>Your profile is in ${currency}. TruWorth will only compare purchase pressure where the purchase currency matches, rather than silently mixing currencies.</p>`;
        return;
      }
      const typical = avg(sameCurrency, (r) => r.observed_price);
      const ratio = freeCash > 0 ? typical / freeCash : Infinity;
      let label = 'Heavy relative to free cash';
      let copy = freeCash > 0 ? `Your typical recorded ${currency} purchase is about ${Math.round(ratio * 100)}% of one month’s free cash after commitments and your savings target.` : 'Your current profile leaves no positive monthly free cash after commitments and your savings target.';
      if (ratio <= .25) label = 'Usually light';
      else if (ratio <= .6) label = 'Noticeable but contained';
      else if (ratio <= 1) label = 'A meaningful monthly stretch';
      mount.innerHTML = `<span>Financial pressure</span><strong>${esc(label)}</strong><p>${esc(copy)}</p><small>Based on ${sameCurrency.length} recorded purchase${sameCurrency.length === 1 ? '' : 's'} in ${currency}; currencies are never silently combined.</small>`;
    } catch (error) {
      console.error('Could not load financial pressure insight', error);
      mount.innerHTML = `<span>Financial pressure</span><strong>Unavailable right now</strong><p>Your other insights are still available. TruWorth could not safely load the financial context for this view.</p>`;
    }
  }

  insightsPage = function insightsPageV36() {
    const model = insightModel();
    const selectivity = selectivitySignal(model);
    const discipline = scoreDisciplineSignal(model);
    const sensitivity = sensitivitySignal(model);
    const satisfaction = satisfactionSignal(model);
    const plus = isPlus();
    const best = sortedRecords()[0];

    layout('Insights', 'Your purchase history turned into evidence you can actually use on the next decision.', `
      <section class="tw36-insights-hero">
        <div><p class="kicker">Decision intelligence</p><h2>Not just what you bought. <em>How you decide.</em></h2><p>${esc(strongestPattern(model))}</p></div>
        <div class="tw36-evidence ${model.evidence.tone}"><span>Evidence strength</span><strong>${esc(model.evidence.label)}</strong><small>${esc(model.evidence.copy)}</small></div>
      </section>

      <section class="tw36-snapshot" aria-label="Decision snapshot">
        <article><span>Decisions assessed</span><strong>${records.length}</strong><small>${model.reviewed.note}</small></article>
        <article><span>Purchase conversion</span><strong>${model.conversion}%</strong><small>${model.bought.length} recorded purchase${model.bought.length === 1 ? '' : 's'} from ${records.length} assessment${records.length === 1 ? '' : 's'}</small></article>
        <article><span>Average TruWorth score</span><strong>${records.length ? model.consideredAverage : '—'}</strong><small>${model.bought.length ? `Purchased average: ${model.boughtAverage}` : 'Record a purchase to compare action with consideration'}</small></article>
        <article><span>Value reviewed</span><strong>${esc(model.reviewed.value)}</strong><small>${esc(model.reviewed.note)}</small></article>
      </section>

      <section class="tw36-section">
        <div class="tw36-section-head"><div><p class="kicker">What your history is saying</p><h2>Your strongest decision signals</h2></div><p>These are evidence-based summaries of the information you entered. They become more useful as your history grows.</p></div>
        <div class="tw36-signal-grid">
          ${basicPatternCard('Assessment → purchase', selectivity.value, `${selectivity.label}. ${selectivity.copy}`, model.conversion >= 70 ? 'watch' : '')}
          ${basicPatternCard('Motive mix', model.consideredMotive ? motiveName(model.consideredMotive) : 'Still forming', model.highestConversionMotive ? `${motiveName(model.highestConversionMotive.motive)} decisions currently convert most often (${model.highestConversionMotive.conversion}%).` : `${model.impulseShare}% of your assessments are impulse / image-led.`)}
          ${basicPatternCard('Strong candidates still unbought', String(model.strongUnbought.length), model.strongUnbought.length ? 'These scored 68+ but are not recorded as purchased. They are useful evidence that a good score does not automatically turn into spending.' : 'No strong-scoring unbought candidates yet. This signal will build as your history grows.')}
        </div>
      </section>

      <section class="tw36-section tw36-premium-zone ${plus ? 'unlocked' : 'locked'}">
        <div class="tw36-section-head"><div><p class="kicker">TruWorth+ Deep Buyer Profile</p><h2>The insight worth coming back for</h2></div><span class="tw36-plan-pill">${plus ? 'Unlocked' : 'TruWorth+ insight'}</span></div>
        ${plus ? `
          <div class="tw36-deep-grid">
            ${basicPatternCard('Score discipline', discipline.value, `${discipline.label}. ${discipline.copy}`, Number(model.scoreDelta || 0) <= -5 ? 'watch' : 'good')}
            ${basicPatternCard('Assumption sensitivity', sensitivity.value, `${sensitivity.label}. ${sensitivity.copy}`, Number(model.averageStressGap || 0) > 20 ? 'watch' : '')}
            ${basicPatternCard('Expectation calibration', satisfaction.value, `${satisfaction.label}. ${satisfaction.copy}`, Number(model.joyDelta || 0) <= -.7 ? 'watch' : '')}
            <article id="tw36FinancialPressure" class="tw36-signal financial"><span>Financial pressure</span><strong>Loading money context…</strong><p>Comparing purchase size with the financial profile you chose to give TruWorth.</p></article>
          </div>
          <div class="tw36-actions-panel"><div><p class="kicker">Next best move</p><h3>What to do differently on your next purchase</h3></div><ol>${actionPlan(model).map((item) => `<li>${esc(item)}</li>`).join('')}</ol></div>
        ` : `
          <div class="tw36-locked-preview" aria-hidden="true"><div><span>Score discipline</span><strong>Are your purchases better than your temptations?</strong></div><div><span>Assumption sensitivity</span><strong>Do your decisions survive a reality check?</strong></div><div><span>Expectation calibration</span><strong>Does post-purchase enjoyment match the promise?</strong></div><div><span>Financial pressure</span><strong>How large are purchases relative to real free cash?</strong></div></div>
          <div class="tw36-unlock"><div><strong>Turn history into a personal decision system.</strong><span>TruWorth+ connects purchase behaviour, stress-tested assumptions, post-purchase feedback and the financial context you choose to provide.</span></div><a class="primary-button" href="plans.html">Unlock deeper insights</a></div>
        `}
      </section>

      ${best ? `<section class="tw36-section"><div class="tw36-section-head"><div><p class="kicker">Reference point</p><h2>Your strongest recorded fit</h2></div><p>Useful as a benchmark when the next product feels exciting but less convincing.</p></div><div class="product-list">${productRow(best, 1)}</div></section>` : `<section class="tw36-empty"><h2>Your profile needs real decisions.</h2><p>Assess products you are genuinely considering, then record what you actually buy. That is what turns TruWorth from a calculator into a decision history.</p><a class="primary-button" href="assess.html">Assess a real purchase</a></section>`}

      <section class="tw36-method-note"><strong>No personality theatre.</strong><span>TruWorth only shows patterns supported by your recorded assessments, purchases and check-ins. Small samples are labelled as early signals, and different currencies are not added together.</span></section>
    `, { kicker: 'Your patterns' });

    if (plus) loadFinancialPressure(model);
  };

  function originalCard(title, tag, copy, bullets, locked) {
    return `<article class="tw36-benefit-card ${locked ? 'locked' : ''}"><div class="tw36-benefit-content"><span class="tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p><ul>${bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${locked ? `<div class="tw36-card-lock"><strong>TruWorth+ toolkit</strong><span>Preview visible. Full member tool unlocks with TruWorth+.</span></div>` : ''}</article>`;
  }

  function bookCard({ title, subtitle, focus, href, format }) {
    return `<article class="tw36-book-card"><div class="tw36-book-spine" aria-hidden="true"><span>THE FINANCIAL<br>EDUCATION SERIES</span><strong>${esc(title.split(':')[0])}</strong><small>Tyronne T Ramella</small></div><div class="tw36-book-copy"><span class="tag">Optional reading · ${esc(format)}</span><h3>${esc(title)}</h3><p>${esc(subtitle)}</p><strong>Why it belongs here</strong><p>${esc(focus)}</p><a class="secondary-button" href="${esc(href)}" target="_blank" rel="noopener noreferrer">View on Amazon UK ↗</a></div></article>`;
  }

  window.benefitsPage = function benefitsPageV36() {
    const plus = isPlus();
    layout('Member Benefits', 'Practical tools, optional learning and a partner-benefit catalogue designed to become more useful as TruWorth grows.', `
      <section class="tw36-benefits-hero">
        <div><p class="kicker">Member Benefits</p><h2>Your membership should become <em>more useful over time.</em></h2><p>Use TruWorth to make the decision first. Then use Originals, financial-literacy resources and verified partner benefits to improve what happens around that decision.</p></div>
        <span class="tw36-plan-pill">${plus ? 'TruWorth+ unlocked' : 'Preview mode'}</span>
      </section>

      <section class="tw36-return-callout"><div><span class="tw36-live-dot" aria-hidden="true"></span><div><strong>This is a living benefit hub. Check back regularly.</strong><p>New Partner Benefits will be added as partnerships are signed, verified and activated. TruWorth will not pad this page with pretend discounts just to make the catalogue look larger.</p></div></div><a href="#partner-benefits">See how partner benefits work ↓</a></section>

      <section class="tw36-section"><div class="tw36-section-head"><div><p class="kicker">TruWorth Originals</p><h2>Tools that make the next decision better</h2></div><p>Practical exercises built around purchase discipline, opportunity cost, value and the post-purchase feedback loop.</p></div><div class="tw36-benefit-grid">
        ${originalCard('24-hour Purchase Reset','Decision discipline','Use a cooling-off period when urgency, novelty or status is doing too much of the work.',['State the problem the purchase solves.','Write down the cheaper alternative.','Wait 24 hours for a discretionary purchase.','Re-run TruWorth and compare the result.'],!plus)}
        ${originalCard('Opportunity Cost Check','Financial literacy','Translate a purchase into the goal, flexibility or future cash it displaces.',['Compare price with monthly free cash.','Name the saving or debt goal delayed.','Ask whether the benefit still wins after the trade-off.'],!plus)}
        ${originalCard('The Upgrade Test','Better buying','Separate a real functional upgrade from replacing something because the market released a newer version.',['What is materially constrained today?','What measurable improvement will change your life or work?','How long will you realistically keep it?','Would you still upgrade without the status signal?'],!plus)}
        ${originalCard('Decision Discipline Playbook','Behaviour','Use your 1–10 Decision Discipline setting intentionally instead of changing it to get the answer you want.',['1–3 gives lifestyle and enjoyment more room.','4–7 balances value with restraint.','8–10 actively challenges avoidable spending.'],!plus)}
        ${originalCard('Value-For-Money Stress Test','Maths','Test whether the value case survives when your original assumptions are too optimistic.',['Estimate lifetime use.','Include upkeep and accessories.','Halve expected use.','Reduce expected enjoyment and re-check the result.'],!plus)}
        ${originalCard('Post-Purchase Review','Learning loop','Turn purchases into evidence so future decisions are based on what actually happened, not what you hoped would happen.',['Record actual use.','Update real enjoyment after novelty fades.','Note unexpected costs or friction.','Use the result to calibrate the next assessment.'],!plus)}
      </div></section>

      <section class="tw36-section tw36-books-section"><div class="tw36-section-head"><div><p class="kicker">Financial literacy shelf</p><h2>Optional reading from the founder</h2></div><p>These books are sold separately through Amazon for members who want to go deeper into the financial thinking behind better everyday decisions.</p></div>
        <div class="tw36-books-grid">
          ${bookCard({title:'Money Matters: The Financial Education You Should Have Been Taught',subtitle:'A practical foundation for understanding personal finance and becoming more deliberate about the decisions that shape your financial position.',focus:'TruWorth helps with the purchase in front of you. Money Matters steps back and looks at the wider financial habits and knowledge that sit behind those choices.',href:'https://www.amazon.co.uk/dp/B0HJNJSSWJ',format:'Kindle / Amazon'})}
          ${bookCard({title:'The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income',subtitle:'A practical guide to understanding what debt costs, choosing a repayment approach and creating more room in future income.',focus:'It extends TruWorth’s opportunity-cost thinking beyond one purchase and into the recurring commitments that can reduce financial choice month after month.',href:'https://www.amazon.co.uk/dp/B0HLDL4PVJ',format:'Amazon'})}
        </div>
        <div class="tw36-books-disclosure"><strong>Founder disclosure</strong><span>These titles are written by TruWorth founder Tyronne T Ramella. Buying a book is optional, is not part of TruWorth+ membership and can generate author royalties. A book purchase cannot change your TruWorth score, recommendation or access.</span></div>
      </section>

      <section id="partner-benefits" class="tw36-section tw36-partner-section"><div class="tw36-section-head"><div><p class="kicker">Partner Benefits</p><h2>A growing catalogue, not a fixed launch list</h2></div><p>New benefits will appear as partnerships become active. If nothing useful is live for you today, check back — the catalogue is designed to expand without changing the decision engine.</p></div>
        <div class="tw36-partner-state"><div><span class="tag">What a live benefit must show</span><h3>No mystery codes. No vague “up to” claims without terms.</h3><p>When a verified partner offer is active, its card should make the commercial value understandable before you leave TruWorth.</p><div class="tw36-benefit-standard"><div><strong>Exact benefit</strong><span>The discount, perk, extension or service enhancement.</span></div><div><strong>Who qualifies</strong><span>Free or TruWorth+, geography and any partner eligibility.</span></div><div><strong>Validity</strong><span>Start/end date or a clear statement if availability is open-ended.</span></div><div><strong>How to redeem</strong><span>Code, link or instructions without making you guess.</span></div><div><strong>Commercial relationship</strong><span>Affiliate, sponsored or other relationship disclosed clearly.</span></div><div><strong>Independent decision</strong><span>The benefit appears after or separately from the recommendation.</span></div></div></div>
          <aside class="tw36-checkback"><span>Check back</span><strong>Benefits will be added as and when partnerships activate.</strong><p>Your account is ${plus ? 'ready to use eligible member offers when they go live' : 'in preview mode; eligible Plus-only redemption will unlock with membership'}.</p><div class="tw36-partner-categories"><span>Technology</span><span>Repair & trade-in</span><span>Home</span><span>Travel</span><span>Fitness</span><span>Lifestyle</span><span>Learning</span></div>${plus ? '' : '<a class="primary-button" href="plans.html">See TruWorth+</a>'}</aside>
        </div>
      </section>

      <section class="tw36-independence"><div><strong>Decision → Education → Benefit.</strong><span>That order is deliberate. Partner status, sponsorship, affiliate economics, book royalties or a discount cannot increase a TruWorth score or turn WAIT/SKIP into BUY.</span></div><a href="commercial-disclosure.html">Read the commercial disclosure →</a></section>
    `, { kicker: 'TruWorth+' });
  };
})();
