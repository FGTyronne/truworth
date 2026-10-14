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
        ['≈2 min', 'Typical check', 'Quick to complete'],
        ['0–100', 'Clear score', 'Easy to compare'],
        ['Saved', 'Your account', 'Keep your assessments in one place']
      ];
    }
    return [
      [String(records.length), 'Assessments', 'Purchases you have assessed'],
      [String(purchasedCount), 'Purchased', 'Items you have bought'],
      [String(avg), 'Average score', 'Across your saved assessments']
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
      ['🎮', 'Gaming', 'game controller']
    ];
    layout('', '', `
      <section class="tw-home-hero">
        <div class="tw-home-copy">
          <span class="tw-eyebrow">Check before you spend</span>
          <h1>Before you buy,<br><span>check if it’s worth it.</span></h1>
          <p>Check products like headphones, phones, trainers, bags, skincare and home tech. Add the details, get a score, and see whether the purchase makes sense for you.</p>
          <div class="tw-home-actions">
            <a class="primary-button tw-big-cta" href="assess.html">Start assessment <span aria-hidden="true">→</span></a>
            <a class="secondary-button tw-example-cta" href="assess.html?q=headphones">Browse an example</a>
          </div>
          <div class="tw-home-trust"><span>✓ Saved to your account</span><span>✓ About 2 minutes</span><span>✓ Clear 0–100 score</span></div>
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
        <div class="tw-section-heading"><div><span>How it works</span><h2>Three quick steps.</h2></div></div>
        <div class="tw-step-grid">
          <a href="assess.html" class="tw-step-card mint"><span>1</span><div class="tw-step-icon">＋</div><strong>Add the product</strong><small>Type the product and what it costs.</small></a>
          <article class="tw-step-card lilac"><span>2</span><div class="tw-step-icon">◎</div><strong>Answer a few questions</strong><small>Tell us how often you will use it, how much you want it and what alternatives you have.</small></article>
          <article class="tw-step-card peach"><span>3</span><div class="tw-step-icon">💡</div><strong>See your result</strong><small>Get a score and the main reasons behind it.</small></article>
        </div>
      </section>

      <section class="tw-home-section tw-category-section">
        <div class="tw-section-heading"><div><span>Popular categories</span><h2>Popular purchase types</h2></div><a href="assess.html">See all</a></div>
        <div class="tw-category-grid">
          ${categories.map(([emoji, label, query], i) => `<a class="tw-category-card c${i + 1}" href="assess.html?q=${encodeURIComponent(query)}"><span>${emoji}</span><strong>${label}</strong></a>`).join('')}
        </div>
      </section>

      <section class="tw-home-section tw-recent-section">
        <div class="tw-section-heading"><div><span>${records.length ? 'Your activity' : 'Start somewhere real'}</span><h2>${records.length ? 'Recent considerations' : 'What are you tempted by right now?'}</h2></div>${records.length ? '<a href="watchlist.html">View library</a>' : ''}</div>
        ${records.length ? `<div class="product-list tw-home-products">${ranked.map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="tw-empty-play"><div class="tw-empty-bubbles"><span>🎧 Headphones</span><span>📱 New phone</span><span>☕ Coffee machine</span><span>👜 Bag</span><span>🎮 Game controller</span></div><p>Use something you genuinely want. The result is more useful when the temptation is real.</p><a class="primary-button" href="assess.html">Assess my first purchase</a></div>`}
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
    setIntro('What are you thinking of buying?', 'Add the real-world details and TruWorth will break the purchase down.');
    const form = $('assessment');
    if (!form || form.dataset.twEnhanced) return;
    form.dataset.twEnhanced = '1';

    const example = document.createElement('section');
    example.className = 'tw-assess-examples';
    example.innerHTML = `<div><span>Examples</span><strong>Headphones, trainers, skincare, coffee machine, handbag, game controller</strong></div><img src="${collageSrc}" alt="Examples of everyday purchases">`;
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
      submit.insertAdjacentHTML('beforebegin', '<aside class="tw-reflection-tip"><span>💡</span><div><strong>Quick check</strong><small>Would you still want this in 30 days? Be realistic about how much you will actually use it.</small></div></aside>');
    }
  }

  function verdictForScore(score) {
    if (score >= 80) return ['Worth it', 'This looks like a strong purchase for the way you expect to use it.', 'great'];
    if (score >= 68) return ['Looks worth it', 'It scores well overall, with a few things worth checking.', 'good'];
    if (score >= 55) return ['Promising', 'There is value here, but compare or wait before rushing.', 'mixed'];
    if (score >= 42) return ['Think twice', 'The purchase is more tempting than convincing right now.', 'warn'];
    return ['Skip for now', 'This purchase does not score well based on the details you entered.', 'stop'];
  }

  function enhanceResult() {
    if (page() !== 'result') return;
    markPage();
    const record = typeof findRecord === 'function' ? findRecord() : null;
    const layoutNode = document.querySelector('.result-layout');
    if (!record || !layoutNode || layoutNode.dataset.twEnhanced) return;
    layoutNode.dataset.twEnhanced = '1';
    setIntro('Your result', 'See your score and the main reasons behind it.');
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
      actions.innerHTML = `<div class="tw-section-heading"><div><span>Before you buy</span><h2>Three useful checks</h2></div></div><div class="tw-check-list"><div><span>↔</span><strong>Compare one alternative</strong><small>Check one similar option before deciding.</small></div><div><span>⏳</span><strong>Give it 24 hours</strong><small>If you no longer want it tomorrow, you may not need it today.</small></div><div><span>♻</span><strong>Check used or refurbished</strong><small>Buying used or refurbished may give you better value.</small></div></div>`;
      details.parentElement?.insertBefore(actions, details);
    }
  }

  function enhanceLibrary() {
    if (page() !== 'watchlist') return;
    markPage();
    setIntro('My library', 'Every purchase you have saved, in one place.');
    const kicker = document.querySelector('.page-intro .kicker');
    if (kicker) kicker.textContent = 'Saved purchases';
  }

  function enhanceInsights() {
    if (page() !== 'insights') return;
    markPage();
    setIntro('Your insights', 'Spot the patterns behind what catches your eye and what you actually buy.');
  }

  function enhanceAccount() {
    if (page() !== 'account') return;
    markPage();
    setIntro('Account', user ? 'Your TruWorth membership, preferences and private financial context.' : 'Create an account or sign in to use TruWorth and keep your assessments saved.');
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

  function settleExperience() {
    init();
    setTimeout(init, 450);
    setTimeout(init, 1100);
  }

  window.addEventListener('truworth:release-ready', settleExperience, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) settleExperience();
})();