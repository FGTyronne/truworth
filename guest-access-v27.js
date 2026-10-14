(() => {
  'use strict';

  const GUEST_DAILY_LIMIT = 3;
  const FREE_SAVED_LIMIT = 5;
  const TRANSIENT_KEY = 'truworth_transient_assessment_v1';
  const protectedGuestPages = new Set(['compare', 'watchlist', 'owned', 'insights', 'settings']);
  let routed = false;

  const plusActive = () => Boolean(user && subscription?.tier === 'plus' && ['active', 'trialing'].includes(subscription?.status));
  const freeAccount = () => Boolean(user && !plusActive());

  function addStyles() {
    if (document.getElementById('guestAccessV27Styles')) return;
    const style = document.createElement('style');
    style.id = 'guestAccessV27Styles';
    style.textContent = `
      .tw-access-note{margin:0 0 18px;padding:14px 16px;border:1px solid rgba(16,27,77,.12);border-radius:16px;background:#fffdf8;color:#4f566d;font-size:.88rem;line-height:1.45}.tw-access-note strong{color:#101b4d}.tw-access-note a{font-weight:800;color:#101b4d}.tw-unsaved-result{margin:0 0 18px;padding:18px;border:1px solid rgba(180,120,30,.24);border-radius:18px;background:#fff8e7}.tw-unsaved-result h2{margin:4px 0 8px;font-size:1.15rem}.tw-unsaved-result p{margin:0;color:#665a3d}.tw-unsaved-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.tw-limit-modal-backdrop{position:fixed;inset:0;background:rgba(16,27,77,.38);display:grid;place-items:center;padding:20px;z-index:10050}.tw-limit-modal{width:min(520px,100%);background:#fff;border-radius:24px;padding:24px;box-shadow:0 24px 80px rgba(16,27,77,.22)}.tw-limit-modal h2{margin:4px 0 10px}.tw-limit-modal p{color:#626a80;line-height:1.55}.tw-limit-modal-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}`;
    document.head.appendChild(style);
  }

  function transientRecord() {
    try {
      const raw = sessionStorage.getItem(TRANSIENT_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && record.id ? record : null;
    } catch {
      return null;
    }
  }

  function putTransient(record) {
    sessionStorage.setItem(TRANSIENT_KEY, JSON.stringify({ ...record, _transient: true }));
  }

  function hydrateTransientForResult() {
    if (page() !== 'result') return;
    const id = new URLSearchParams(location.search).get('id');
    const record = transientRecord();
    if (!record || record.id !== id || records.some((item) => item.id === id)) return;
    records.push(record);
  }

  function makeRecord(inputs, result, transient = false) {
    return {
      id: `${transient ? 'temp' : 'guest'}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      created_at: new Date().toISOString(),
      title: inputs.item,
      brand: inputs.brand,
      retailer: inputs.retailer,
      source_url: inputs.source_url,
      canonical_url: inputs.canonical_url,
      image_url: inputs.image_url,
      observed_price: inputs.price,
      currency: inputs.currency,
      score: result.score,
      score_version: result.version,
      inputs,
      status: 'considering',
      _transient: transient
    };
  }

  async function consumeGuestAllowance() {
    if (!supabaseClient) throw new Error('Guest allowance could not be verified.');
    const { data, error } = await supabaseClient.functions.invoke('guest-assessment-quota', { body: {} });
    if (error) throw error;
    if (!data || typeof data.allowed !== 'boolean') throw new Error('Guest allowance could not be verified.');
    return data;
  }

  function showGuestLimitGate() {
    document.getElementById('twGuestLimitGate')?.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'twGuestLimitGate';
    backdrop.className = 'tw-limit-modal-backdrop';
    backdrop.innerHTML = `<section class="tw-limit-modal" role="dialog" aria-modal="true" aria-labelledby="twGuestLimitTitle"><p class="kicker">Guest limit reached</p><h2 id="twGuestLimitTitle">You have used today’s ${GUEST_DAILY_LIMIT} guest assessments.</h2><p>Create a free TruWorth account for unlimited product assessments. Free accounts can keep up to ${FREE_SAVED_LIMIT} products saved at a time.</p><div class="tw-limit-modal-actions"><a class="primary-button" href="account.html">Create free account</a><a class="secondary-button" href="account.html">Sign in</a></div></section>`;
    document.body.appendChild(backdrop);
  }

  function guestInfoCopy() {
    if (!user) return `<strong>${GUEST_DAILY_LIMIT} assessments per day without an account.</strong> Create a free account for unlimited product assessments and up to ${FREE_SAVED_LIMIT} saved products.`;
    if (plusActive()) return '<strong>TruWorth+:</strong> unlimited product assessments and unlimited saved history.';
    return `<strong>Free account:</strong> unlimited product assessments and up to ${FREE_SAVED_LIMIT} saved products.`;
  }

  async function saveSignedInAssessment(inputs, result) {
    if (freeAccount() && records.length >= FREE_SAVED_LIMIT) {
      const record = makeRecord(inputs, result, true);
      putTransient(record);
      location.href = `result.html?id=${encodeURIComponent(record.id)}`;
      return;
    }

    const { data, error } = await supabaseClient.from('assessments').insert({
      user_id: user.id,
      title: inputs.item,
      brand: inputs.brand || null,
      retailer: inputs.retailer || null,
      source_url: inputs.source_url || null,
      canonical_url: inputs.canonical_url || null,
      image_url: inputs.image_url || null,
      observed_price: inputs.price,
      currency: inputs.currency,
      score: result.score,
      score_version: result.version,
      inputs,
      status: 'considering'
    }).select('*').single();

    if (error) {
      if (freeAccount() && /saved product limit/i.test(String(error.message || ''))) {
        const record = makeRecord(inputs, result, true);
        putTransient(record);
        location.href = `result.html?id=${encodeURIComponent(record.id)}`;
        return;
      }
      throw error;
    }
    location.href = `result.html?id=${encodeURIComponent(data.id)}`;
  }

  saveAssessment = async function saveAssessmentV27(event) {
    event.preventDefault();
    const form = $('assessment');
    const errorBox = $('formError');
    if (!form.reportValidity()) return;
    errorBox.textContent = '';
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const inputs = formValues();
      const result = score(inputs);

      if (user && supabaseClient) {
        await saveSignedInAssessment(inputs, result);
        return;
      }

      const allowance = await consumeGuestAllowance();
      if (!allowance.allowed) {
        showGuestLimitGate();
        button.disabled = false;
        return;
      }

      const record = makeRecord(inputs, result, false);
      records.push(record);
      saveLocal();
      location.href = `result.html?id=${encodeURIComponent(record.id)}`;
    } catch (error) {
      console.error('Assessment save failed', error);
      errorBox.textContent = !user
        ? 'We could not verify today’s guest allowance. Create a free account to continue with unlimited assessments, or try again.'
        : (error?.message || 'We could not complete this assessment.');
      button.disabled = false;
    }
  };

  syncGuestRecords = async function syncGuestRecordsV27() {
    if (!supabaseClient || !local.records?.length) return;
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const currentUser = sessionData.session?.user;
    if (!currentUser) return;

    const [{ data: existing, error: existingError }, { data: plan, error: planError }] = await Promise.all([
      supabaseClient.from('assessments').select('id', { count: 'exact' }).eq('user_id', currentUser.id),
      supabaseClient.from('subscriptions').select('tier,status').eq('user_id', currentUser.id).maybeSingle()
    ]);
    if (existingError) throw existingError;
    if (planError) throw planError;

    const isPlus = plan?.tier === 'plus' && ['active', 'trialing'].includes(plan?.status);
    const existingCount = Array.isArray(existing) ? existing.length : 0;
    const capacity = isPlus ? Number.POSITIVE_INFINITY : Math.max(0, FREE_SAVED_LIMIT - existingCount);
    const guestRecords = local.records
      .map(normaliseGuestRecord)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, Number.isFinite(capacity) ? capacity : undefined);

    for (const record of guestRecords) {
      const inputs = { ...record.inputs, item: record.title };
      const metrics = score(inputs);
      const { error } = await supabaseClient.from('assessments').insert({
        user_id: currentUser.id,
        title: record.title,
        brand: record.brand || null,
        retailer: record.retailer || null,
        source_url: record.source_url || null,
        canonical_url: record.canonical_url || null,
        image_url: record.image_url || null,
        observed_price: record.observed_price,
        currency: record.currency || 'GBP',
        score: record.score ?? metrics.score,
        score_version: record.score_version || metrics.version,
        inputs,
        status: record.status || 'considering'
      });
      if (error && /saved product limit/i.test(String(error.message || ''))) break;
      if (error) throw error;
    }

    local = { records: [], owned: {}, settings: local.settings || { motion: true } };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  };

  const baseAssessPage = assessPage;
  assessPage = function assessPageV27() {
    baseAssessPage();
    const layoutNode = document.querySelector('.assessment-layout');
    if (layoutNode && !document.getElementById('twAssessmentAccessNote')) {
      const note = document.createElement('div');
      note.id = 'twAssessmentAccessNote';
      note.className = 'tw-access-note';
      note.innerHTML = guestInfoCopy();
      layoutNode.parentNode.insertBefore(note, layoutNode);
    }
  };

  const baseResultPage = resultPage;
  resultPage = function resultPageV27() {
    baseResultPage();
    const record = findRecord();
    if (!record?._transient) return;
    document.getElementById('markBought')?.remove();
    document.querySelector('.page-intro a[href="compare.html"]')?.remove();
    const target = document.querySelector('.result-layout');
    if (target && !document.getElementById('twUnsavedResult')) {
      const notice = document.createElement('section');
      notice.id = 'twUnsavedResult';
      notice.className = 'tw-unsaved-result';
      notice.innerHTML = `<p class="kicker">Assessment complete · not saved</p><h2>Your Free library already has ${FREE_SAVED_LIMIT} saved products.</h2><p>You can assess as many products as you like on Free. This result is temporary because only ${FREE_SAVED_LIMIT} products can be kept in your library at one time.</p><div class="tw-unsaved-actions"><a class="secondary-button" href="watchlist.html">Manage saved products</a><a class="primary-button" href="plans.html">Get unlimited saved history</a></div>`;
      target.parentNode.insertBefore(notice, target);
    }
  };

  const baseSavedPage = savedPage;
  savedPage = function savedPageV27() {
    baseSavedPage();
    if (freeAccount()) {
      const labels = document.querySelectorAll('.library-meta span');
      if (labels[1]) labels[1].textContent = `${records.length} of ${FREE_SAVED_LIMIT} saved on Free`;
    }
  };

  const basePlansPage = plansPage;
  plansPage = function plansPageV27() {
    basePlansPage();
    const freeRow = [...document.querySelectorAll('.membership-row')].find((row) => row.querySelector('.membership-name span')?.textContent?.trim() === 'Free');
    if (freeRow && !freeRow.querySelector('.tw-access-note')) {
      const note = document.createElement('div');
      note.className = 'tw-access-note';
      note.innerHTML = `<strong>Unlimited product assessments.</strong> Keep up to ${FREE_SAVED_LIMIT} products saved at a time.`;
      freeRow.querySelector('.membership-copy')?.appendChild(note);
    }
  };

  const baseSignedInAccountPage = signedInAccountPage;
  signedInAccountPage = function signedInAccountPageV27() {
    baseSignedInAccountPage();
    if (!freeAccount()) return;
    const storage = [...document.querySelectorAll('.account-stats > div')].find((node) => /storage/i.test(node.querySelector('span')?.textContent || ''));
    if (storage?.querySelector('strong')) storage.querySelector('strong').textContent = `${records.length} of ${FREE_SAVED_LIMIT} products saved`;
  };

  route = function routeV27() {
    if (!window.__TRUWORTH_RELEASE_READY__ || !window.__TRUWORTH_DATA_READY__) return;
    if (routed) return;

    if (!user && protectedGuestPages.has(page())) {
      const file = location.pathname.split('/').pop() || 'index.html';
      sessionStorage.setItem('truworth-return-to', `${file}${location.search || ''}`);
      location.href = 'account.html';
      return;
    }

    hydrateTransientForResult();
    routed = true;
    const routes = {
      home: homePage,
      assess: assessPage,
      result: resultPage,
      compare: comparePage,
      watchlist: savedPage,
      owned: ownedPage,
      insights: insightsPage,
      plans: plansPage,
      account: accountPage,
      settings: settingsPage
    };
    (routes[page()] || homePage)();
    window.__TRUWORTH_ROUTED__ = true;
    window.dispatchEvent(new CustomEvent('truworth:routed'));
  };

  addStyles();
})();
