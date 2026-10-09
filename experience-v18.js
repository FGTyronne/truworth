(() => {
  const safe = (value = '') => typeof esc === 'function' ? esc(String(value)) : String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isPlus = () => subscription?.tier === 'plus' && ['active','trialing'].includes(String(subscription?.status || ''));
  const isTrial = () => String(subscription?.status || '') === 'trialing';
  const trialEligible = () => !isPlus() && !subscription?.provider_customer_id && !subscription?.provider_subscription_id;

  function improveHomeCopy() {
    if (page() !== 'home') return;
    const eyebrow = document.querySelector('.tw-eyebrow');
    if (eyebrow) eyebrow.textContent = 'A smarter check before checkout';
    const lead = document.querySelector('.tw-home-copy > p');
    if (lead) lead.textContent = 'Check products like headphones, phones, trainers, bags, skincare and home tech. TruWorth gives you a clear score based on the details you enter.';

    const trust = document.querySelector('.tw-home-trust');
    if (trust) trust.innerHTML = '<span><b>✓</b>No account needed</span><span><b>✓</b>About 2 minutes</span><span><b>✓</b>0–100 result</span>';

    document.querySelectorAll('.tw-stat-strip article').forEach((card) => {
      const label = card.querySelector('b')?.textContent?.trim();
      const note = card.querySelector('small');
      if (!note) return;
      if (label === 'Assessments') note.textContent = 'Purchases you have checked before buying';
      if (label === 'Typical check') note.textContent = 'Quick enough to use before checkout';
      if (label === 'Clear score') note.textContent = 'One consistent result you can compare';
    });

    document.querySelectorAll('.tw-step-card').forEach((card) => {
      const title = card.querySelector('strong')?.textContent?.trim();
      const copy = card.querySelector('small');
      if (title === 'Decide smarter' && copy) copy.textContent = 'See the main reasons behind your result before you spend.';
    });

    document.querySelectorAll('.tw-section-heading h2').forEach((heading) => {
      if (heading.textContent.includes('No spreadsheet energy')) heading.textContent = 'Three quick steps. One clear result.';
    });
  }

  function makeFooterReliable() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;
    footer.innerHTML = [
      ['Privacy', 'privacy.html'],
      ['Terms', 'terms.html'],
      ['How TruWorth works', 'decision-support.html'],
      ['Membership', 'plans.html'],
      ['Settings', 'settings.html']
    ].map(([label, href]) => `<a data-tw-footer-link href="${href}">${label}</a>`).join('');

    footer.querySelectorAll('[data-tw-footer-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        window.location.assign(link.getAttribute('href'));
      });
    });
  }

  function decorateAccount() {
    if (page() !== 'account' || !user) return;
    const overview = document.querySelector('.account-overview');
    if (!overview || overview.dataset.twV18 === '1') return;
    overview.dataset.twV18 = '1';

    const intro = document.querySelector('.page-intro');
    if (intro) {
      const title = intro.querySelector('h1');
      const subtitle = intro.querySelector('div > p:last-child');
      if (title) title.textContent = 'Your account';
      if (subtitle) subtitle.textContent = 'Your membership, saved decisions and account controls in one place.';
    }

    const plus = isPlus();
    const trial = isTrial();
    const canTrial = trialEligible();
    const purchasedCount = records.filter((r) => r.status === 'purchased' || purchases[r.id]).length;
    const averageScore = records.length ? Math.round(records.reduce((sum, r) => sum + Number(r.score || 0), 0) / records.length) : null;
    const savedCount = records.length;
    const memberSince = user.created_at ? new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric' }).format(new Date(user.created_at)) : '';

    const profile = overview.querySelector('.account-profile');
    if (profile) {
      profile.innerHTML = `<div class="avatar">${safe((user.email || 'T').charAt(0).toUpperCase())}</div><div><span>Signed in as</span><strong>${safe(user.email || '')}</strong>${memberSince ? `<small>Member since ${safe(memberSince)}</small>` : ''}</div><div class="tw-account-plan-badge">${trial ? '3-day trial' : plus ? 'TruWorth+' : 'Free account'}</div>`;
    }

    const stats = overview.querySelector('.account-stats');
    if (stats) stats.innerHTML = `<div><span>Saved</span><strong>${savedCount}</strong></div><div><span>Bought</span><strong>${purchasedCount}</strong></div><div><span>Avg score</span><strong>${averageScore == null ? '—' : averageScore}</strong></div>`;

    const plan = document.createElement('section');
    plan.className = 'tw-account-plan';
    if (plus) {
      plan.innerHTML = `<div class="tw-account-plan-head"><div><span>Your plan</span><h2>${trial ? 'TruWorth+ trial' : 'TruWorth+'}</h2><p>${trial ? 'Your 3-day trial is active. You can use all TruWorth+ features now and cancel before the trial ends to avoid the first charge.' : 'Unlimited saved history, full Buyer Profile and BUY / DON’T BUY guidance are active on this account.'}</p></div></div><div class="tw-account-features"><div><b>✓</b><span>Unlimited saved assessments</span></div><div><b>✓</b><span>Full Buyer Profile</span></div><div><b>✓</b><span>BUY / DON’T BUY guidance</span></div><div><b>✓</b><span>Purchase tracking and comparisons</span></div></div>`;
    } else {
      const limit = 10;
      const used = Math.min(limit, savedCount);
      const width = Math.max(4, Math.min(100, Math.round((used / limit) * 100)));
      const remaining = Math.max(0, limit - used);
      plan.innerHTML = `<div class="tw-account-plan-head"><div><span>Your plan</span><h2>Free account</h2><p>Your assessments sync to your account and you can compare and track purchases.</p></div></div><div class="tw-account-meter"><span style="width:${width}%"></span></div><div class="tw-account-meter-copy"><span>${used} of ${limit} saved</span><span>${remaining} slot${remaining === 1 ? '' : 's'} left</span></div><div class="tw-account-features"><div><b>✓</b><span>Up to 10 saved assessments</span></div><div><b>✓</b><span>Cloud sync across signed-in devices</span></div><div><b>✓</b><span>Compare saved purchases</span></div><div><b>✓</b><span>Track what you actually buy</span></div></div><div class="tw-account-upgrade"><div><strong>${canTrial ? 'Try TruWorth+ free for 3 days' : 'Want the full TruWorth+ tools?'}</strong><small>${canTrial ? 'Get unlimited history, the full Buyer Profile and BUY / DON’T BUY guidance. Cancel before the trial ends to avoid a charge.' : 'TruWorth+ adds unlimited history, the full Buyer Profile and BUY / DON’T BUY guidance.'}</small></div><a class="primary-button" href="plans.html">${canTrial ? 'Start free trial' : 'See TruWorth+'}</a></div>`;
    }
    stats?.insertAdjacentElement('afterend', plan);

    const shortcuts = document.createElement('nav');
    shortcuts.className = 'tw-account-shortcuts';
    shortcuts.setAttribute('aria-label', 'Account shortcuts');
    shortcuts.innerHTML = `<a href="watchlist.html"><span>▤</span><strong>My library</strong><small>Saved assessments</small></a><a href="settings.html"><span>⚙</span><strong>Settings</strong><small>Preferences & data</small></a><a href="privacy.html"><span>◉</span><strong>Privacy</strong><small>How data is handled</small></a><a href="terms.html"><span>§</span><strong>Terms</strong><small>Service terms</small></a>`;
    plan.insertAdjacentElement('afterend', shortcuts);

    const subscriptionNote = Array.from(overview.children).find((node) => node.tagName === 'P' && !node.id);
    if (subscriptionNote) subscriptionNote.classList.add('tw-subscription-note');
  }

  const previousAccountRenderer = typeof signedInAccountPage === 'function' ? signedInAccountPage : null;
  if (previousAccountRenderer) {
    signedInAccountPage = function signedInAccountPageV18() {
      previousAccountRenderer();
      decorateAccount();
      makeFooterReliable();
    };
  }

  function apply() {
    improveHomeCopy();
    decorateAccount();
    makeFooterReliable();
  }

  window.addEventListener('truworth:release-ready', () => {
    apply();
    setTimeout(apply, 80);
    setTimeout(apply, 450);
  }, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) apply();
})();