(() => {
  'use strict';

  const DISMISSED_KEY = 'truworth_newsletter_dismissed_v1';
  const SUBSCRIBED_KEY = 'truworth_newsletter_subscribed_v1';
  const DISMISS_DAYS = 14;
  const EXCLUDED = new Set([
    '/auth.html','/unsubscribe.html','/privacy.html','/terms.html','/cookies.html','/security.html','/commercial-disclosure.html','/partner-with-truworth.html','/admin-partners.html','/admin-vouchers.html'
  ]);

  function excludedPage() {
    return EXCLUDED.has(location.pathname) || location.pathname.startsWith('/admin-');
  }

  function recentlyDismissed() {
    try {
      const value = Number(localStorage.getItem(DISMISSED_KEY) || 0);
      return value > 0 && Date.now() - value < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch { return false; }
  }

  function alreadySubscribed() {
    try { return localStorage.getItem(SUBSCRIBED_KEY) === '1'; } catch { return false; }
  }

  function cookieUiOpen() {
    return Boolean(document.getElementById('twConsentBanner') || document.getElementById('twConsentModal'));
  }

  function dismiss(card) {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    card?.classList.add('is-closing');
    setTimeout(() => card?.remove(), 180);
  }

  async function submit(form, card) {
    const email = String(form.querySelector('[name="email"]')?.value || '').trim();
    const honeypot = String(form.querySelector('[name="company_website"]')?.value || '').trim();
    const status = card.querySelector('[data-newsletter-status]');
    const button = form.querySelector('button[type="submit"]');
    if (!email) {
      status.textContent = 'Enter your email address.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Subscribing…';
    status.textContent = '';

    try {
      if (!supabaseClient) throw new Error('Newsletter service is still loading.');
      const { data, error } = await supabaseClient.functions.invoke('newsletter-subscribe', {
        body: {
          email,
          consent: true,
          company_website: honeypot,
          source_page: `${location.pathname}${location.search}`.slice(0, 120),
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Could not subscribe.');
      try {
        localStorage.setItem(SUBSCRIBED_KEY, '1');
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}
      form.hidden = true;
      const copy = card.querySelector('[data-newsletter-copy]');
      if (copy) copy.innerHTML = '<strong>You’re on the list.</strong><span>We’ll email you when the TruWorth address changes, plus occasional worthwhile updates.</span>';
      status.textContent = '';
      setTimeout(() => {
        card.classList.add('is-closing');
        setTimeout(() => card.remove(), 180);
      }, 3200);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not subscribe. Please try again.';
      button.disabled = false;
      button.textContent = 'Subscribe';
    }
  }

  function render() {
    if (excludedPage() || alreadySubscribed() || recentlyDismissed() || cookieUiOpen() || document.getElementById('twNewsletterCard')) return false;

    const card = document.createElement('aside');
    card.id = 'twNewsletterCard';
    card.className = 'tw-newsletter-card';
    card.setAttribute('aria-label', 'TruWorth updates');
    card.innerHTML = `
      <button class="tw-newsletter-close" type="button" aria-label="Dismiss newsletter invitation">×</button>
      <div class="tw-newsletter-mark" aria-hidden="true">T</div>
      <div class="tw-newsletter-copy" data-newsletter-copy>
        <span class="tw-newsletter-kicker">Stay with TruWorth</span>
        <strong>Our web address will change in the coming months.</strong>
        <span>Subscribe and we’ll send you the new address, plus new benefits, specials, news and useful updates.</span>
      </div>
      <form class="tw-newsletter-form" novalidate>
        <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Email address" aria-label="Email address" required>
        <input class="tw-newsletter-hp" type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit">Subscribe</button>
      </form>
      <small>Occasional emails only. Unsubscribe whenever you want.</small>
      <p class="tw-newsletter-status" data-newsletter-status role="status" aria-live="polite"></p>
    `;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-visible'));
    card.querySelector('.tw-newsletter-close')?.addEventListener('click', () => dismiss(card));
    card.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(event.currentTarget, card);
    });
    return true;
  }

  function schedule() {
    if (excludedPage() || alreadySubscribed() || recentlyDismissed()) return;
    let attempts = 0;
    const tryShow = () => {
      attempts += 1;
      if (render() || attempts >= 18) return;
      setTimeout(tryShow, 1800);
    };
    setTimeout(tryShow, 3200);
  }

  window.addEventListener('truworth:release-ready', schedule, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) schedule();
})();
