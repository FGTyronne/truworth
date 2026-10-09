(() => {
  const DAY = 24 * 60 * 60 * 1000;
  const safeTrial = (value = '') => typeof esc === 'function' ? esc(String(value)) : String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trialEndValue = () => subscription?.trial_end || (String(subscription?.status || '') === 'trialing' ? subscription?.current_period_end : null);
  const trialEndDate = () => { const value = trialEndValue(); if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
  const planPrice = () => String(subscription?.plan_interval || '').toLowerCase() === 'year' ? '£59.99 per year' : '£5.99 per month';
  const dateLabel = (date) => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);

  function dueForReview() {
    if (!user || String(subscription?.status || '') !== 'trialing') return false;
    if (subscription?.cancel_at_period_end || subscription?.trial_notice_acknowledged_at) return false;
    const end = trialEndDate();
    if (!end) return false;
    const remaining = end.getTime() - Date.now();
    return remaining > 0 && remaining <= DAY;
  }

  async function trialAction(action) {
    if (!supabaseClient || !user) throw new Error('Sign in to continue.');
    const { data, error } = await supabaseClient.functions.invoke('trial-action', { body: { action } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Could not update trial.');
    return data;
  }

  function removeNotice() { document.getElementById('twTrialNotice')?.remove(); }
  function closeReview() { document.getElementById('twTrialReview')?.remove(); document.body.classList.remove('tw-trial-modal-open'); }

  function decorateCancelledTrial() {
    if (String(subscription?.status || '') !== 'trialing' || !subscription?.cancel_at_period_end) return;
    const end = trialEndDate();
    const endText = end ? dateLabel(end) : 'the end of the trial';
    const badge = document.querySelector('.tw-account-plan-badge');
    if (badge) badge.textContent = 'Trial ending';
    const accountPlan = document.querySelector('.tw-account-plan-head p');
    if (accountPlan) accountPlan.textContent = `Cancellation is scheduled. TruWorth+ stays active until ${endText}, and no first subscription payment will be taken.`;
    document.querySelectorAll('.plan-status').forEach((status) => {
      if (/trial active/i.test(status.textContent || '')) status.textContent = 'Cancels at trial end';
    });
    const subscriptionNote = document.querySelector('.tw-subscription-note');
    if (subscriptionNote) subscriptionNote.textContent = `Trial cancellation scheduled. Access ends ${endText}. No first subscription payment will be taken.`;
  }

  function showCancelled(review, accessEnd) {
    const end = accessEnd ? new Date(accessEnd) : trialEndDate();
    decorateCancelledTrial();
    review.querySelector('.tw-trial-dialog').innerHTML = `<div class="tw-trial-success"><span>✓</span><h2>Trial cancellation confirmed</h2><p>You can keep using TruWorth+ until ${safeTrial(end ? dateLabel(end) : 'the end of your trial')}. No subscription payment will be taken when the trial ends.</p><small>A confirmation email is being sent to your account email address.</small><button class="primary-button" type="button" data-trial-done>Done</button></div>`;
    review.querySelector('[data-trial-done]')?.addEventListener('click', closeReview);
  }

  function showCancelConfirmation(review) {
    const end = trialEndDate();
    const dialog = review.querySelector('.tw-trial-dialog');
    dialog.innerHTML = `<div class="tw-trial-dialog-head"><span>Cancel trial</span><h2>Cancel TruWorth+ before billing starts?</h2><p>You will keep TruWorth+ until ${safeTrial(end ? dateLabel(end) : 'the end of the trial')}. After that, the account returns to Free and no first subscription payment is taken.</p></div><div class="tw-trial-actions"><button class="secondary-button" type="button" data-trial-back>Go back</button><button class="danger-button" type="button" data-trial-confirm-cancel>Confirm cancellation</button></div><p class="form-message" data-trial-status role="status"></p>`;
    dialog.querySelector('[data-trial-back]')?.addEventListener('click', () => openReview());
    dialog.querySelector('[data-trial-confirm-cancel]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const status = dialog.querySelector('[data-trial-status]');
      button.disabled = true; button.textContent = 'Cancelling…';
      try {
        const data = await trialAction('cancel');
        subscription.cancel_at_period_end = true;
        subscription.trial_notice_acknowledged_at = new Date().toISOString();
        if (data.access_end) subscription.trial_end = data.access_end;
        removeNotice();
        showCancelled(review, data.access_end);
      } catch (error) {
        console.error(error);
        status.textContent = 'We could not cancel the trial. Please try again.';
        status.className = 'form-message error';
        button.disabled = false; button.textContent = 'Confirm cancellation';
      }
    });
  }

  function openReview() {
    if (!dueForReview()) return;
    let layer = document.getElementById('twTrialReview');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'twTrialReview';
      layer.className = 'tw-trial-layer';
      layer.innerHTML = '<button class="tw-trial-backdrop" type="button" aria-label="Close trial review"></button><section class="tw-trial-dialog" role="dialog" aria-modal="true" aria-labelledby="twTrialTitle"></section>';
      document.body.appendChild(layer);
      document.body.classList.add('tw-trial-modal-open');
      layer.querySelector('.tw-trial-backdrop')?.addEventListener('click', closeReview);
    }
    const end = trialEndDate();
    const dialog = layer.querySelector('.tw-trial-dialog');
    dialog.innerHTML = `<div class="tw-trial-dialog-head"><span>Trial reminder</span><h2 id="twTrialTitle">Your 3-day trial ends tomorrow</h2><p>Your ${safeTrial(planPrice())} subscription is due to start on ${safeTrial(end ? dateLabel(end) : 'the trial end date')}.</p></div><div class="tw-trial-payment"><span>Next payment</span><strong>${safeTrial(planPrice())}</strong><small>${safeTrial(end ? dateLabel(end) : '')}</small></div><p class="tw-trial-explain">Choose whether to keep TruWorth+ or cancel before billing starts.</p><div class="tw-trial-actions"><button class="secondary-button" type="button" data-trial-cancel>Cancel trial</button><button class="primary-button" type="button" data-trial-keep>Keep TruWorth+</button></div><button class="text-button tw-trial-later" type="button" data-trial-later>Not now</button><p class="form-message" data-trial-status role="status"></p>`;
    dialog.querySelector('[data-trial-later]')?.addEventListener('click', closeReview);
    dialog.querySelector('[data-trial-cancel]')?.addEventListener('click', () => showCancelConfirmation(layer));
    dialog.querySelector('[data-trial-keep]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const status = dialog.querySelector('[data-trial-status]');
      button.disabled = true; button.textContent = 'Saving…';
      try {
        const data = await trialAction('acknowledge');
        subscription.trial_notice_acknowledged_at = data.acknowledged_at || new Date().toISOString();
        removeNotice(); closeReview();
      } catch (error) {
        console.error(error);
        status.textContent = 'We could not save your choice. Please try again.';
        status.className = 'form-message error';
        button.disabled = false; button.textContent = 'Keep TruWorth+';
      }
    });
  }

  function renderTrialNotice() {
    removeNotice();
    if (!dueForReview()) return;
    const end = trialEndDate();
    const notice = document.createElement('aside');
    notice.id = 'twTrialNotice';
    notice.className = 'tw-trial-notice';
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `<div class="tw-trial-notice-icon">!</div><div class="tw-trial-notice-copy"><strong>Your trial ends tomorrow</strong><span>${safeTrial(planPrice())} is due to start ${safeTrial(end ? dateLabel(end) : '')}. Please review your trial before it ends.</span></div><button class="primary-button" type="button" data-trial-review>Review trial</button>`;
    const target = document.querySelector('.main-content') || document.querySelector('main') || document.body;
    target.prepend(notice);
    notice.querySelector('[data-trial-review]')?.addEventListener('click', openReview);
  }

  function applyTrialLifecycle() { decorateCancelledTrial(); renderTrialNotice(); }
  window.addEventListener('truworth:release-ready', () => { applyTrialLifecycle(); setTimeout(applyTrialLifecycle, 250); setTimeout(applyTrialLifecycle, 900); }, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) applyTrialLifecycle();
})();