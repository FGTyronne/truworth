(() => {
  'use strict';

  const SUPABASE_URL = 'https://npfdkbqjoxolxxtmprmr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
  const ENDPOINT = `${SUPABASE_URL}/functions/v1/newsletter-unsubscribe`;
  const token = new URLSearchParams(location.search).get('t') || '';
  const form = document.getElementById('unsubscribeForm');
  const status = document.getElementById('unsubscribeStatus');
  const confirmButton = document.getElementById('unsubscribeConfirm');
  const card = document.getElementById('unsubscribeCard');

  async function call(body) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new Error(data?.error || 'Request failed.');
    return data;
  }

  function invalid(message) {
    form.hidden = true;
    status.textContent = '';
    const p = card.querySelector(':scope > p:nth-of-type(2)');
    if (p) p.textContent = message;
  }

  async function init() {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      invalid('This unsubscribe link is invalid or incomplete.');
      return;
    }
    try {
      const data = await call({ action: 'status', token });
      if (!data.active) {
        form.hidden = true;
        card.insertAdjacentHTML('beforeend', '<div class="tw-unsubscribe-success"><strong>You are already unsubscribed.</strong><span>You will not receive TruWorth newsletter updates unless you choose to subscribe again later.</span></div>');
      }
    } catch (error) {
      invalid(error instanceof Error ? error.message : 'We could not check this subscription.');
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = form.querySelector('input[name="reason"]:checked')?.value || '';
    const detail = String(document.getElementById('unsubscribeDetail')?.value || '').trim();
    if (!reason) {
      status.textContent = 'Choose a reason before confirming.';
      return;
    }
    confirmButton.disabled = true;
    confirmButton.textContent = 'Unsubscribing…';
    status.textContent = '';
    try {
      const data = await call({ action: 'unsubscribe', token, reason, detail });
      form.hidden = true;
      card.insertAdjacentHTML('beforeend', `<div class="tw-unsubscribe-success"><strong>You’re unsubscribed.</strong><span>${String(data.message || 'You will no longer receive TruWorth newsletter updates.').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span></div>`);
      try {
        localStorage.removeItem('truworth_newsletter_subscribed_v1');
        localStorage.setItem('truworth_newsletter_dismissed_v1', String(Date.now()));
      } catch {}
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not unsubscribe. Please try again.';
      confirmButton.disabled = false;
      confirmButton.textContent = 'Confirm unsubscribe';
    }
  });

  init();
})();
