(() => {
  const heroSrc = 'assets/hero-products.webp?v=20261009h';

  function plainFooterLinks() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;
    const expected = 'tw21';
    if (footer.dataset.footerVersion === expected) return;
    footer.dataset.footerVersion = expected;
    footer.innerHTML = [
      ['Privacy', 'privacy.html'],
      ['Terms', 'terms.html'],
      ['How TruWorth works', 'decision-support.html'],
      ['Membership', 'plans.html'],
      ['Settings', 'settings.html']
    ].map(([label, href]) => `<a href="${href}">${label}</a>`).join('');
    footer.style.pointerEvents = 'auto';
    footer.querySelectorAll('a').forEach((link) => {
      link.style.pointerEvents = 'auto';
      link.style.position = 'relative';
      link.style.zIndex = '2';
    });
  }

  function replaceHeroArtwork() {
    const homeImage = document.querySelector('.tw-collage-card img');
    if (homeImage) {
      homeImage.src = heroSrc;
      homeImage.alt = 'Examples of purchases including headphones, trainers, a handbag, skincare, a smartwatch, a game controller and a coffee machine';
      homeImage.loading = 'eager';
      homeImage.decoding = 'async';
      try { homeImage.fetchPriority = 'high'; } catch {}
      document.querySelectorAll('.tw-collage-card .tw-sticker').forEach((node) => node.remove());
    }
    const assessImage = document.querySelector('.tw-assess-examples img');
    if (assessImage) {
      assessImage.src = heroSrc;
      assessImage.alt = 'Examples of everyday purchases';
      assessImage.loading = 'lazy';
      assessImage.decoding = 'async';
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function cleanHomeCopy() {
    if (typeof page !== 'function' || page() !== 'home') return;
    setText('.tw-eyebrow', 'A quick check before you buy');
    setText('.tw-home-copy > p', 'Check anything from headphones and holidays to subscriptions and home upgrades. TruWorth gives you a clear score based on the details you enter.');

    const trust = document.querySelector('.tw-home-trust');
    if (trust) trust.innerHTML = '<span><b>✓</b>No account needed</span><span><b>✓</b>About 2 minutes</span><span><b>✓</b>Clear 0–100 score</span>';

    document.querySelectorAll('.tw-stat-strip article').forEach((card) => {
      const label = card.querySelector('b')?.textContent?.trim();
      const note = card.querySelector('small');
      if (!note) return;
      if (label === 'Assessments') note.textContent = 'Purchases you have assessed';
      if (label === 'Typical check') note.textContent = 'Quick enough to use before checkout';
      if (label === 'Clear score') note.textContent = 'One result you can compare with another';
    });

    document.querySelectorAll('.tw-section-heading h2').forEach((heading) => {
      if (/spreadsheet|three quick steps/i.test(heading.textContent || '')) heading.textContent = 'Three quick steps. One clear result.';
    });

    document.querySelectorAll('.tw-step-card').forEach((card) => {
      const title = card.querySelector('strong');
      const copy = card.querySelector('small');
      if (!title) return;
      if (/reality-check/i.test(title.textContent || '')) {
        title.textContent = 'Check the value';
        if (copy) copy.textContent = 'Price, expected use, enjoyment and effort become one score.';
      }
      if (/decide smarter/i.test(title.textContent || '')) {
        title.textContent = 'See your result';
        if (copy) copy.textContent = 'See the main reasons behind your score before you spend.';
      }
    });
  }

  function cleanAssessmentCopy() {
    const tip = document.querySelector('.tw-reflection-tip small');
    if (tip) tip.textContent = 'Would you still want this in 30 days?';
  }

  function cleanLibraryCopy() {
    if (typeof page !== 'function' || page() !== 'watchlist') return;
    const intro = document.querySelector('.page-intro div > p:last-child');
    if (intro) intro.textContent = 'Every purchase you have assessed, in one place.';
  }

  function cleanResultCopy() {
    if (typeof page !== 'function' || page() !== 'result') return;
    const intro = document.querySelector('.page-intro div > p:last-child');
    if (intro && /helping|hurting|case/i.test(intro.textContent || '')) intro.textContent = 'See the score and the main reasons behind it.';
  }

  function ensureDecisionLinks() {
    document.querySelectorAll('a').forEach((link) => {
      const label = (link.textContent || '').trim();
      if (/^How TruWorth (decides|works)$/i.test(label) || /^How the recommendation works$/i.test(label)) {
        link.setAttribute('href', 'decision-support.html');
        link.style.pointerEvents = 'auto';
      }
    });
  }

  function apply() {
    plainFooterLinks();
    replaceHeroArtwork();
    cleanHomeCopy();
    cleanAssessmentCopy();
    cleanLibraryCopy();
    cleanResultCopy();
    ensureDecisionLinks();
  }

  window.addEventListener('truworth:release-ready', () => {
    apply();
    [120, 650, 1300, 1900].forEach((delay) => setTimeout(apply, delay));
  }, { once: true });

  if (window.__TRUWORTH_RELEASE_READY__) {
    apply();
    [120, 650, 1300].forEach((delay) => setTimeout(apply, delay));
  }
})();