(() => {
  const plusActive = () => subscription?.tier === 'plus' && ['active','trialing'].includes(String(subscription?.status || ''));
  const trialActive = () => String(subscription?.status || '') === 'trialing';
  const firstTrialEligible = () => !plusActive() && !subscription?.provider_customer_id && !subscription?.provider_subscription_id;
  const escBilling = (value) => typeof esc === 'function' ? esc(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function invokeBilling(name, body = {}) {
    if (!user || !supabaseClient) throw new Error('Sign in to continue.');
    const { data, error } = await supabaseClient.functions.invoke(name, { body });
    if (error) throw error;
    return data || {};
  }

  async function startCheckout(plan, button) {
    if (!user) { location.href = 'account.html'; return; }
    const original = button?.textContent || 'Choose plan';
    if (button) { button.disabled = true; button.textContent = 'Opening secure checkout…'; }
    try {
      const data = await invokeBilling('stripe-checkout', { plan });
      if (data.already_plus) { location.href = 'account.html'; return; }
      if (!data.url || !/^https:\/\/checkout\.stripe\.com\//i.test(data.url)) throw new Error('Checkout did not return a secure Stripe link.');
      location.assign(data.url);
    } catch (error) {
      console.error(error);
      const status = document.getElementById('billingStatus');
      if (status) { status.textContent = 'We could not open checkout. Please try again.'; status.className = 'form-message error'; }
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  async function openPortal(button) {
    const original = button?.textContent || 'Manage subscription';
    if (button) { button.disabled = true; button.textContent = 'Opening Stripe…'; }
    try {
      const data = await invokeBilling('stripe-portal');
      if (!data.url || !/^https:\/\/billing\.stripe\.com\//i.test(data.url)) throw new Error('Portal did not return a secure Stripe link.');
      location.assign(data.url);
    } catch (error) {
      console.error(error);
      const status = document.getElementById('billingStatus');
      if (status) { status.textContent = 'We could not open subscription management. Please try again.'; status.className = 'form-message error'; }
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  plansPage = function plansPageWithBilling() {
    const isPlus = plusActive();
    const inTrial = trialActive();
    const trialEligible = firstTrialEligible();
    const monthlyButton = trialEligible ? 'Start 3-day free trial' : 'Choose monthly';
    const annualButton = trialEligible ? 'Start 3-day free trial' : 'Choose annual';
    const intro = trialEligible
      ? 'Try TruWorth+ free for 3 days. Choose monthly or annual billing for after the trial.'
      : 'Use TruWorth for free, or upgrade to TruWorth+ for the full set of tools.';
    layout('Membership', intro, `<section class="membership-sheet">
      <article class="membership-row"><div class="membership-name"><span>Free</span><strong>£0</strong></div><div class="membership-copy"><h2>For everyday purchase checks</h2><p>Save up to 10 assessments, compare saved items and track what you eventually buy.</p></div><span class="plan-status">${!isPlus ? 'Current plan' : 'Included'}</span></article>
      <article class="membership-row"><div class="membership-name"><span>TruWorth+</span><strong>£5.99 <small>/ month</small></strong></div><div class="membership-copy"><h2>Monthly</h2><p>Unlimited saved history, the full Buyer Profile and BUY / DON’T BUY guidance.</p>${trialEligible ? '<small>3 days free, then £5.99 per month.</small>' : ''}</div>${isPlus ? `<span class="plan-status">${inTrial ? 'Trial active' : 'Included'}</span>` : `<button class="primary-button billing-checkout" data-plan="monthly" type="button">${monthlyButton}</button>`}</article>
      <article class="membership-row"><div class="membership-name"><span>TruWorth+ Annual</span><strong>£59.99 <small>/ year</small></strong></div><div class="membership-copy"><h2>Annual</h2><p>The same TruWorth+ features with one annual payment.</p>${trialEligible ? '<small>3 days free, then £59.99 per year.</small>' : ''}</div>${isPlus ? '<button class="secondary-button billing-portal" type="button">Manage subscription</button>' : `<button class="secondary-button billing-checkout" data-plan="annual" type="button">${annualButton}</button>`}</article>
    </section><p id="billingStatus" class="form-message" role="status"></p><p class="legal-note">${trialEligible ? 'The 3-day free trial is available once per account. A payment method is required. Cancel before the trial ends to avoid the first charge. ' : ''}Paid subscriptions renew automatically until cancelled. Manage or cancel through Stripe from your TruWorth account. <a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a></p>`, { kicker: 'Plans' });
    document.querySelectorAll('.billing-checkout').forEach(button => button.addEventListener('click', () => startCheckout(button.dataset.plan, button)));
    document.querySelector('.billing-portal')?.addEventListener('click', event => openPortal(event.currentTarget));
  };

  signedInAccountPage = function signedInAccountPageWithBilling() {
    const isPlus = plusActive();
    const inTrial = trialActive();
    const limit = isPlus ? 'Unlimited saved products' : `${records.length} of 10 products saved`;
    const q = new URLSearchParams(location.search);
    const billing = q.get('billing');
    const billingNotice = billing === 'success' ? `<div class="account-deleted-banner"><strong>${inTrial ? 'Trial started.' : 'Checkout complete.'}</strong><span>${inTrial ? 'TruWorth+ is active for your 3-day trial.' : 'Your membership will update as soon as Stripe confirms the subscription.'}</span></div>` : billing === 'cancelled' ? '<div class="account-deleted-banner"><strong>Checkout closed.</strong><span>No change was made to your membership.</span></div>' : '';
    const period = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '';
    const subscriptionCopy = inTrial
      ? `3-day trial active${period ? `. Trial ends ${escBilling(period)}` : ''}. Cancel before the trial ends to avoid the first charge.`
      : isPlus
        ? `${subscription?.cancel_at_period_end ? 'Access ends' : 'Renews'}${period ? ` ${escBilling(period)}` : ''}`
        : 'Free account. Upgrade whenever you want the full TruWorth+ features.';
    layout('Your account', user.email, `${billingNotice}<section class="account-overview"><div class="account-profile"><div class="avatar">${escBilling((user.email || 'T').charAt(0).toUpperCase())}</div><div><span>Email</span><strong>${escBilling(user.email)}</strong></div></div><div class="account-stats"><div><span>Plan</span><strong>${inTrial ? 'TruWorth+ trial' : isPlus ? 'TruWorth+' : 'Free'}</strong></div><div><span>Storage</span><strong>${escBilling(limit)}</strong></div></div><p>${subscriptionCopy}</p><div class="account-actions"><a class="secondary-button" href="plans.html">Membership</a>${isPlus ? '<button id="manageSubscription" class="secondary-button" type="button">Manage subscription</button>' : ''}<button id="signOut" class="text-button" type="button">Sign out</button></div><p id="billingStatus" class="form-message" role="status"></p></section>`, { kicker: 'Account' });
    document.getElementById('manageSubscription')?.addEventListener('click', event => openPortal(event.currentTarget));
    document.getElementById('signOut')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); location.href = 'index.html'; });
    if (billing === 'success' && !isPlus && !sessionStorage.getItem('truworth-billing-refresh')) {
      sessionStorage.setItem('truworth-billing-refresh','1');
      setTimeout(() => location.reload(), 1800);
    } else if (billing !== 'success') sessionStorage.removeItem('truworth-billing-refresh');
  };
})();