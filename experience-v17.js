(() => {
  const collageSrc = 'assets/hero-collage.svg?v=20261009b';

  function markPage() {
    document.body.classList.add('tw17', `tw-page-${page()}`);
  }

  function decorateWordmark() {
    document.querySelectorAll('.wordmark').forEach((node) => {
      if (node.dataset.twDecorated) return;
      node.dataset.twDecorated = '1';
      node.innerHTML = '<span>Tru</span><strong>Worth</strong><i aria-hidden="true">✦</i>';
    });
  }

  function moderniseBottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const current = page() === 'watchlist' ? 'saved' : page();
    const items = [
      ['home', 'Home', 'index.html', 'home'],
      ['assess', 'Assess', 'assess.html', 'assess'],
      ['saved', 'Library', 'watchlist.html', 'saved'],
      ['insights', 'Insights', 'insights.html', 'insights'],
      ['account', 'Account', 'account.html', 'account']
    ];
    nav.innerHTML = items.map(([key, label, href, iconName]) => `<a class="${current === key ? 'active' : ''}" href="${href}" ${current === key ? 'aria-current="page"' : ''}>${icon(iconName)}<span>${label}</span></a>`).join('');
  }

  function homeStats() {
    const purchasedCount = records.filter((r) => r.status === 'purchased' || purchases[r.id]).length;
    const avg = records.length ? Math.round(records.reduce((sum, r) => sum + Number(r.score || 0), 0) / records.length) : 0;
    if (!records.length) {
      return [
        ['≈2 min', 'Typical check', 'Fast enough to use before checkout'],
        ['0–100', 'Clear score', 'A consistent reality check'],
        ['No login', 'Try it first', 'Save later if you want']
      ];
    }
    return [
      [String(records.length), 'Assessments', 'Decisions you have pressure-tested'],
      [String(purchasedCount), 'Purchased', 'Items you chose to buy'],
      [String(avg), 'Average score', 'Across your saved decisions']
    ];
  }

  function renderHome() {
    if (page() !== 'home') return;
    const ranked = sortedRecords().slice(0, 4);
    const stats = homeStats();
    const categories = [
      ['🎧', 'Tech', 'headphones'],
      ['👟', 'Fashion', 'trainers'],
      ['☕', 'Home', 'coffee machine'],
      ['🧴', 'Beauty', 'skincare'],
      ['🏋️', 'Fitness', 'fitness equipment'],
      ['✈️', 'Travel', 'holiday']
    ];
    layout('', '', `
      <section class="tw-home-hero">
        <div class="tw-home-copy">
          <span class="tw-eyebrow">A smarter reality-check before checkout</span>
          <h1>Before you buy,<br><span>check if it’s worth it.</span></h1>
          <p>Pressure-test anything from headphones and holidays to subscriptions and home upgrades. TruWorth turns the decision into something you can actually compare.</p>
          <div class="tw-home-actions">
            <a class="primary-button tw-big-cta" href="assess.html">Start assessment <span aria-hidden="true">→</span></a>
            <a class="secondary-button tw-example-cta" href="assess.html?q=headphones">Browse an example</a>
          </div>
          <div class="tw-home-trust"><span>✓ No account needed</span><span>✓ About 2 minutes</span><span>✓ No ads steering the answer</span></div>
        </div>
        <div class="tw-collage-card">
          <span class="tw-sticker tw-sticker-a">Useful?</span>
          <span class="tw-sticker tw-sticker-b">Worth the price?</span>
          <img src="${collageSrc}" alt="Headphones, trainers, a handbag, skincare, a smartwatch, a game controller and a coffee machine">
        </div>
      </section>

      <section class="tw-stat-strip" aria-label="TruWorth at a glance">
        ${stats.map(([value, label, note]) => `<article><span class="tw-stat-icon">${label === 'Average score' || label === 'Clear score' ? '◎' : label === 'Purchased' ? '✓' : '↗'}</span><strong>${esc(value)}</strong><b>${esc(label)}</b><small>${esc(note)}</small></article>`).join('')}
      </section>

      <section class="tw-home-section tw-how-section">
        <div class="tw-section-heading"><div><span>How it works</span><h2>Three quick steps. No spreadsheet energy.</h2></div></div>
        <div class="tw-step-grid">
          <a href="assess.html" class="tw-step-card mint"><span>1</span><div class="tw-step-icon">＋</div><strong>Add what you want</strong><small>Type the item, service or subscription and what it costs.</small></a>
          <article class="tw-step-card lilac"><span>2</span><div class="tw-step-icon">◎</div><strong>Reality-check it</strong><small>Use, enjoyment, effort and alternatives become one consistent score.</small></article>
          <article class="tw-step-card peach"><span>3</span><div class="tw-step-icon">💡</div><strong>Decide smarter</strong><small>See what is helping or hurting the case before you spend.</small></article>
        </div>
      </section>

      <section class="tw-home-section tw-category-section">
        <div class="tw-section-heading"><div><span>Try anything</span><h2>Popular purchase types</h2></div><a href="assess.html">See all</a></div>
        <div class="tw-category-grid">
          ${categories.map(([emoji, label, query], i) => `<a class="tw-category-card c${i + 1}" href="assess.html?q=${encodeURIComponent(query)}"><span>${emoji}</span><strong>${label}</strong></a>`).join('')}
        </div>
      </section>

      <section class="tw-home-section tw-recent-section">
        <div class="tw-section-heading"><div><span>${records.length ? 'Your activity' : 'Start somewhere real'}</span><h2>${records.length ? 'Recent considerations' : 'What are you tempted by right now?'}</h2></div>${records.length ? '<a href="watchlist.html">View library</a>' : ''}</div>
        ${records.length ? `<div class="product-list tw-home-products">${ranked.map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="tw-empty-play"><div class="tw-empty-bubbles"><span>🎧 Headphones</span><span>🏖️ Holiday</span><span>📱 New phone</span><span>☕ Coffee machine</span><span>👜 Bag</span></div><p>Use something you genuinely want. The result is more useful when the temptation is real.</p><a class="primary-button" href="assess.html">Assess my first purchase</a></div>`}
      </section>
    `, { compact: true });
    markPage();
  }

  function setIntro(title, subtitle) {
    const intro = document.querySelector('.page-intro');
    if (!intro) return;
    const h1 = intro.querySelector('h1');
    const p = intro.querySelector('div > p:last-child');
    if (h1) h1.textContent = title;
    if (p && subtitle) p.textContent = subtitle;
  }

  function enhanceAssess() {
    if (page() !== 'assess') return;
    markPage();
    setIntro('What are you thinking of buying?', 'Add the real-world details and TruWorth will break the decision down.');
    const form = $('assessment');
    if (!form || form.dataset.twEnhanced) return;
    form.dataset.twEnhanced = '1';

    const example = document.createElement('section');
    example.className = 'tw-assess-examples';
    example.innerHTML = `<div><span>Examples</span><strong>Headphones, trainers, skincare, coffee machine, holiday, gym membership</strong></div><img src="${collageSrc}" alt="Examples of everyday purchases">`;
    form.parentElement?.insertBefore(example, form);

    const discovery = form.querySelector('.discovery-card');
    const importCard = form.querySelector('.import-card');
    if (discovery && importCard) {
      const details = document.createElement('details');
      details.className = 'tw-source-drawer';
      details.innerHTML = '<summary><span>Already have a link or need to find the item?</span><small>Optional shortcut</small></summary>';
      form.insertBefore(details, discovery);
      details.append(discovery, importCard);
      const params = new URLSearchParams(location.search);
      details.open = Boolean(params.get('url') || params.get('q'));
    }

    form.querySelectorAll('.form-section-heading').forEach((heading, index) => {
      if (!heading.querySelector('.tw-step-number')) heading.insertAdjacentHTML('afterbegin', `<span class="tw-step-number">${index + 1}</span>`);
    });

    const submit = form.querySelector('.submit-button');
    if (submit) submit.innerHTML = 'See my result <span aria-hidden="true">→</span>';

    if (submit && !form.querySelector('.tw-reflection-tip')) {
      submit.insertAdjacentHTML('beforebegin', '<aside class="tw-reflection-tip"><span>💡</span><div><strong>Quick check</strong><small>Would you still want this in 30 days? Give the boring answer, not the checkout answer.</small></div></aside>');
    }
  }

  function verdictForScore(score) {
    if (score >= 80) return ['Worth it', 'This looks like a strong purchase for the way you expect to use it.', 'great'];
    if (score >= 68) return ['Looks worth it', 'The case is solid, with a few assumptions worth checking.', 'good'];
    if (score >= 55) return ['Promising', 'There is value here, but compare or wait before rushing.', 'mixed'];
    if (score >= 42) return ['Think twice', 'The purchase is more tempting than convincing right now.', 'warn'];
    return ['Skip for now', 'Your current assumptions do not make a strong case for spending the money.', 'stop'];
  }

  function enhanceResult() {
    if (page() !== 'result') return;
    markPage();
    const record = typeof findRecord === 'function' ? findRecord() : null;
    const layoutNode = document.querySelector('.result-layout');
    if (!record || !layoutNode || layoutNode.dataset.twEnhanced) return;
    layoutNode.dataset.twEnhanced = '1';
    setIntro('Your result', 'Here is what is helping — and hurting — the case for this purchase.');
    const [label, copy, tone] = verdictForScore(Number(record.score || 0));
    const hero = document.createElement('section');
    hero.className = `tw-result-hero ${tone}`;
    hero.innerHTML = `<div class="tw-score-ring" style="--tw-score:${Math.max(0, Math.min(100, Number(record.score || 0)))}"><div><strong>${Number(record.score || 0)}</strong><span>/ 100</span></div></div><div class="tw-result-verdict"><span>Your TruWorth verdict</span><h2>${label}</h2><p>${copy}</p><small>${esc(record.title || '')}</small></div><div class="tw-result-product">${productImage(record, 'hero')}</div>`;
    layoutNode.insertBefore(hero, layoutNode.firstChild);

    const oldDecision = layoutNode.querySelector('.decision-verdict');
    if (oldDecision) oldDecision.classList.add('tw-hide-legacy-verdict');

    const details = layoutNode.querySelector('.decision-details');
    if (details && !layoutNode.querySelector('.tw-before-buy')) {
      const actions = document.createElement('section');
      actions.className = 'tw-before-buy';
      actions.innerHTML = `<div class="tw-section-heading"><div><span>Before you buy</span><h2>Three useful checks</h2></div></div><div class="tw-check-list"><div><span>↔</span><strong>Compare one alternative</strong><small>Make sure this is the best way to get the outcome.</small></div><div><span>⏳</span><strong>Give it 24 hours</strong><small>If the urge disappears, the purchase answered itself.</small></div><div><span>♻</span><strong>Check used or refurbished</strong><small>Same utility can change the value case dramatically.</small></div></div>`;
      details.parentElement?.insertBefore(actions, details);
    }
  }

  function enhanceLibrary() {
    if (page() !== 'watchlist') return;
    markPage();
    setIntro('My library', 'Every purchase you have pressure-tested, in one place.');
    const kicker = document.querySelector('.page-intro .kicker');
    if (kicker) kicker.textContent = 'Saved decisions';
  }

  function enhanceInsights() {
    if (page() !== 'insights') return;
    markPage();
    setIntro('Your insights', 'Spot the patterns behind what catches your eye and what actually earns its place.');
  }

  function enhanceAccount() {
    if (page() !== 'account') return;
    markPage();
    setIntro('Account', user ? 'Your TruWorth membership, preferences and private financial context.' : 'Sign in when you want your decisions available across devices.');
  }

  function enhanceGeneric() {
    markPage();
  }

  function finishShell() {
    decorateWordmark();
    moderniseBottomNav();
    const footer = document.querySelector('.site-footer');
    if (footer && !footer.querySelector('.tw-footer-note')) footer.insertAdjacentHTML('afterbegin', '<span class="tw-footer-note">TruWorth · Buy with your eyes open.</span>');
  }

  function init() {
    if (page() === 'home') renderHome();
    else if (page() === 'assess') enhanceAssess();
    else if (page() === 'result') enhanceResult();
    else if (page() === 'watchlist') enhanceLibrary();
    else if (page() === 'insights') enhanceInsights();
    else if (page() === 'account') enhanceAccount();
    else enhanceGeneric();
    finishShell();
  }

  window.addEventListener('truworth:release-ready', init, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) init();
})();