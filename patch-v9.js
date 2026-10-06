(() => {
  const CURRENCIES = ['GBP','USD','EUR','CHF','CAD','AUD','NZD','ZAR','AED','SGD','JPY','HKD'];
  let preferredCurrencyCache = null;
  let financialProfileCache = null;
  let enhanceTimer = null;

  const html = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validCurrency = (value) => CURRENCIES.includes(String(value || '').toUpperCase()) ? String(value).toUpperCase() : null;
  const signedIn = () => typeof user !== 'undefined' && Boolean(user) && typeof supabaseClient !== 'undefined' && Boolean(supabaseClient);
  const currentLocal = () => (typeof local !== 'undefined' && local) ? local : null;
  const currencySymbol = (code) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === 'currency')?.value || code;
    } catch { return code; }
  };
  const formatMoney = (value, code) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value || 0)); }
    catch { return `${code} ${Number(value || 0).toFixed(2)}`; }
  };
  const currencyOptions = (selected) => CURRENCIES.map((code) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${code} · ${html(currencySymbol(code))}</option>`).join('');

  async function preferredCurrency(force = false) {
    if (!force && preferredCurrencyCache) return preferredCurrencyCache;
    let code = validCurrency(currentLocal()?.settings?.preferred_currency);
    if (signedIn()) {
      try {
        const [{ data: settingsRow }, { data: financial }] = await Promise.all([
          supabaseClient.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
          supabaseClient.from('financial_profiles').select('currency').eq('user_id', user.id).maybeSingle(),
        ]);
        code = validCurrency(settingsRow?.settings?.preferred_currency) || code || validCurrency(financial?.currency);
        financialProfileCache = financialProfileCache || financial || null;
      } catch (error) { console.debug('Currency preference lookup skipped', error); }
    }
    code = code || 'GBP';
    preferredCurrencyCache = code;
    return code;
  }

  async function savePreferredCurrency(code) {
    code = validCurrency(code) || 'GBP';
    preferredCurrencyCache = code;
    if (currentLocal()) {
      local.settings = local.settings || {};
      local.settings.preferred_currency = code;
      try { saveLocal(); } catch {}
    }
    if (!signedIn()) return;
    try {
      const { data } = await supabaseClient.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle();
      const settings = { ...(data?.settings || {}), preferred_currency: code };
      await supabaseClient.from('user_settings').upsert({ user_id: user.id, settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      await supabaseClient.from('financial_profiles').update({ currency: code, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      if (financialProfileCache) financialProfileCache.currency = code;
    } catch (error) { console.warn('Could not save preferred currency', error); }
  }

  function setMoneySymbols(code, root = document) {
    const symbol = currencySymbol(code);
    root.querySelectorAll('.money-input > span:first-child').forEach((node) => { node.textContent = symbol; });
  }

  function setAssessmentCurrency(code, { accepted = false } = {}) {
    code = validCurrency(code) || 'GBP';
    const hidden = document.getElementById('currency');
    const select = document.getElementById('assessmentCurrencySelect');
    if (hidden) hidden.value = code;
    if (select) select.value = code;
    const form = document.getElementById('assessment');
    if (form) {
      setMoneySymbols(code, form);
      if (accepted) form.dataset.currencyAccepted = `${code}|${document.getElementById('price')?.value || ''}`;
    }
  }

  async function enhanceAssessmentCurrency() {
    const form = document.getElementById('assessment');
    const price = document.getElementById('price');
    const hidden = document.getElementById('currency');
    if (!form || !price || !hidden) return;
    const pref = await preferredCurrency();
    if (!price.value && (!hidden.value || hidden.value === 'GBP')) hidden.value = pref;
    const current = validCurrency(hidden.value) || pref;
    if (!document.getElementById('assessmentCurrencySelect')) {
      const select = document.createElement('select');
      select.id = 'assessmentCurrencySelect';
      select.className = 'currency-mini-select';
      select.setAttribute('aria-label', 'Assessment currency');
      select.innerHTML = currencyOptions(current);
      price.parentElement?.appendChild(select);
      select.addEventListener('change', () => {
        form.dataset.currencyUnconfirmed = '';
        form.dataset.currencyAccepted = `${select.value}|${price.value || ''}`;
        setAssessmentLocked(false);
        clearCurrencyMismatch();
        setAssessmentCurrency(select.value, { accepted: true });
      });
    }
    setAssessmentCurrency(current);
    checkCurrencyMismatch();
  }

  function setAssessmentLocked(locked) {
    const submit = document.querySelector('#assessment button[type="submit"]');
    if (submit) submit.disabled = Boolean(locked);
  }

  function clearCurrencyMismatch() {
    document.getElementById('currencyMismatch')?.remove();
    const form = document.getElementById('assessment');
    if (form) form.dataset.currencyUnconfirmed = '';
  }

  async function showCurrencyMismatch(importedCode, preferredCode) {
    const form = document.getElementById('assessment');
    const price = document.getElementById('price');
    const status = document.getElementById('importStatus');
    if (!form || !price || !status) return;
    const pair = `${importedCode}|${preferredCode}|${price.value || ''}`;
    if (form.dataset.currencyAcceptedPair === pair) return;
    let box = document.getElementById('currencyMismatch');
    if (!box) {
      box = document.createElement('div');
      box.id = 'currencyMismatch';
      box.className = 'currency-mismatch';
      status.insertAdjacentElement('afterend', box);
    }
    form.dataset.currencyUnconfirmed = '1';
    setAssessmentLocked(true);
    box.innerHTML = `<strong>Currency check</strong><p>The seller price is in <b>${html(importedCode)}</b>, while your preferred currency is <b>${html(preferredCode)}</b>. TruWorth will not relabel the number or guess an exchange rate.</p><div><button type="button" class="secondary-button" data-currency-keep>Keep ${html(importedCode)}</button><button type="button" class="primary-button" data-currency-enter>Enter ${html(preferredCode)} price</button></div>`;
    box.querySelector('[data-currency-keep]').addEventListener('click', () => {
      form.dataset.currencyAcceptedPair = pair;
      setAssessmentCurrency(importedCode, { accepted: true });
      clearCurrencyMismatch();
      setAssessmentLocked(false);
      status.textContent = `Using ${importedCode} for this assessment. Your profile preference remains ${preferredCode}. Financial-fit guidance will pause until currencies match.`;
    });
    box.querySelector('[data-currency-enter]').addEventListener('click', () => {
      form.dataset.currencyAcceptedPair = '';
      setAssessmentCurrency(preferredCode, { accepted: true });
      price.value = '';
      clearCurrencyMismatch();
      setAssessmentLocked(false);
      status.textContent = `Enter the equivalent price in ${preferredCode}, then continue.`;
      price.focus();
    });
  }

  async function checkCurrencyMismatch() {
    const form = document.getElementById('assessment');
    const price = document.getElementById('price');
    const hidden = document.getElementById('currency');
    const source = document.getElementById('productUrl');
    if (!form || !price || !hidden || !price.value || !source?.value) return;
    const pref = await preferredCurrency();
    const imported = validCurrency(hidden.value);
    if (imported && imported !== pref) await showCurrencyMismatch(imported, pref);
  }

  function enhanceSearchWording() {
    const button = document.getElementById('searchGoogle');
    if (button) button.textContent = 'Search';
    const note = document.getElementById('discoveryStatus');
    if (note && /Google/i.test(note.textContent || '')) note.innerHTML = '<strong>How it works:</strong> Search opens in a new tab. Choose the exact result you want, copy its link and paste it into TruWorth below.';
    document.querySelectorAll('.snap-selected p').forEach((p) => {
      if (/Google Maps/i.test(p.textContent || '')) p.textContent = 'Nearby results are location-based and do not confirm store stock.';
    });
  }

  function runSearch() {
    const field = document.getElementById('discoveryQuery');
    const status = document.getElementById('discoveryStatus');
    const query = field?.value.trim() || '';
    if (!query) { if (status) status.textContent = 'Type what you want to find first.'; return; }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    if (status) status.innerHTML = '<strong>Search results are open.</strong> Choose the exact product or service, copy its page link, then paste it below.';
  }

  async function importProduct() {
    const status = document.getElementById('importStatus');
    const button = document.getElementById('importProduct');
    const url = document.getElementById('productUrl')?.value.trim() || '';
    if (!status || !button) return;
    if (!url) { status.textContent = 'Paste a product or service link first.'; return; }
    if (!signedIn()) { status.innerHTML = 'Sign in to import details automatically. <a href="account.html">Sign in</a>'; return; }
    const pref = await preferredCurrency();
    clearCurrencyMismatch();
    const form = document.getElementById('assessment');
    if (form) { form.dataset.currencyAcceptedPair = ''; form.dataset.currencyUnconfirmed = ''; }
    status.textContent = 'Importing page details…';
    button.disabled = true;
    try {
      const { data, error } = await supabaseClient.functions.invoke('import-product', { body: { url } });
      if (error) throw error;
      if (data?.title) document.getElementById('item').value = data.title;
      if (data?.brand) document.getElementById('brand').value = data.brand;
      if (data?.retailer) document.getElementById('retailer').value = data.retailer;
      if (data?.price != null) document.getElementById('price').value = data.price;
      if (data?.image_url) document.getElementById('imageUrl').value = data.image_url;
      if (data?.canonical_url) document.getElementById('canonicalUrl').value = data.canonical_url;
      const imported = validCurrency(data?.currency) || pref;
      setAssessmentCurrency(imported);
      status.textContent = data?.title ? 'Details imported. Check them before scoring.' : 'We reached the page but could not identify enough structured data. Add the missing details manually.';
      if (data?.price != null && imported !== pref) await showCurrencyMismatch(imported, pref);
    } catch (error) {
      console.error(error);
      status.textContent = 'We could not import that page. You can still complete the assessment manually.';
    } finally { button.disabled = false; }
  }

  function enhanceSnapRecovery() {
    document.querySelectorAll('.snap-status').forEach((status) => {
      if (!/No confident product match|could not identify enough|need a clearer label/i.test(status.textContent || '')) return;
      const card = status.closest('[data-snap-card]');
      const mount = card?.querySelector('.snap-candidates');
      if (!mount || mount.querySelector('.snap-recovery-panel')) return;
      mount.innerHTML = `<div class="snap-recovery-panel"><strong>Not confident enough to guess.</strong><p>Try another photo showing the barcode or model label, or type the product name yourself.</p><form class="snap-manual-search"><input type="search" placeholder="e.g. Pepsi Max 2L or Sony WH-1000XM6" aria-label="Product name"><button class="secondary-button" type="submit">Search</button></form></div>`;
    });
  }

  async function injectPreferredCurrencyControl() {
    if (!signedIn()) return;
    const form = document.querySelector('#financial-profile .financial-form');
    if (!form || document.getElementById('preferredCurrencySelect')) return;
    const code = await preferredCurrency(true);
    const block = document.createElement('div');
    block.className = 'preferred-currency-block';
    block.innerHTML = `<label class="field"><span>Preferred currency</span><select id="preferredCurrencySelect">${currencyOptions(code)}</select><small>Used as your default across TruWorth. Imported prices keep their real source currency until you confirm them.</small></label><span id="preferredCurrencyStatus" role="status"></span>`;
    form.prepend(block);
    setMoneySymbols(code, form);
    renderFinancialPreview(code);
    const select = block.querySelector('#preferredCurrencySelect');
    select.addEventListener('change', async () => {
      const next = select.value;
      await savePreferredCurrency(next);
      setMoneySymbols(next, form);
      renderFinancialPreview(next);
      const status = document.getElementById('preferredCurrencyStatus');
      if (status) status.textContent = `Default changed to ${next}.`;
    });
  }

  function renderFinancialPreview(code) {
    const mount = document.getElementById('financialPreview');
    const amountField = document.getElementById('incomeAmount');
    if (!mount || !amountField) return;
    const amount = Number(amountField.value || 0);
    if (!amount) { mount.innerHTML = '<span>Add your income to calculate monthly free cash.</span>'; return; }
    const period = document.getElementById('incomePeriod')?.value || 'monthly';
    const monthly = period === 'annual' ? amount / 12 : amount;
    const free = Math.max(0, monthly - Number(document.getElementById('essentialOutgoings')?.value || 0) - Number(document.getElementById('debtCommitments')?.value || 0) - Number(document.getElementById('savingsTarget')?.value || 0));
    mount.innerHTML = `<span>Estimated monthly free cash</span><strong>${html(formatMoney(free, code))}</strong><small>After the commitments you entered</small>`;
  }

  async function saveFinancialProfile(event) {
    if (!signedIn()) return;
    const select = document.getElementById('preferredCurrencySelect');
    const code = validCurrency(select?.value) || await preferredCurrency();
    const status = document.getElementById('financialStatus');
    const valueOrNull = (id) => {
      const value = document.getElementById(id)?.value;
      return value === '' || value == null ? null : Number(value);
    };
    const payload = {
      user_id: user.id,
      currency: code,
      income_amount: valueOrNull('incomeAmount'),
      income_period: document.getElementById('incomePeriod')?.value || 'monthly',
      essential_outgoings_monthly: valueOrNull('essentialOutgoings'),
      debt_commitments_monthly: valueOrNull('debtCommitments'),
      savings_target_monthly: valueOrNull('savingsTarget'),
      updated_at: new Date().toISOString(),
    };
    try {
      if (status) status.textContent = 'Saving…';
      const { error } = await supabaseClient.from('financial_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      financialProfileCache = payload;
      await savePreferredCurrency(code);
      renderFinancialPreview(code);
      if (status) { status.textContent = 'Private financial context saved.'; status.className = 'form-message success'; }
    } catch (error) {
      console.error(error);
      if (status) { status.textContent = 'We could not save your financial context.'; status.className = 'form-message error'; }
    }
  }

  async function financialCurrency() {
    if (financialProfileCache?.currency) return validCurrency(financialProfileCache.currency);
    if (!signedIn()) return null;
    try {
      const { data } = await supabaseClient.from('financial_profiles').select('currency,income_amount').eq('user_id', user.id).maybeSingle();
      financialProfileCache = data || null;
      return validCurrency(data?.currency);
    } catch { return null; }
  }

  async function guardResultCurrency() {
    if (typeof page !== 'function' || page() !== 'result' || !signedIn() || typeof findRecord !== 'function') return;
    const record = findRecord();
    if (!record) return;
    const purchaseCurrency = validCurrency(record.currency || record.inputs?.currency);
    const profileCurrency = await financialCurrency() || await preferredCurrency();
    if (!purchaseCurrency || !profileCurrency || purchaseCurrency === profileCurrency) return;
    const copy = `<div class="currency-fit-mismatch"><strong>Confirm currency before financial guidance</strong><span>This assessment is ${html(purchaseCurrency)}, while your financial profile is ${html(profileCurrency)}. TruWorth will not compare those numbers without a confirmed conversion.</span><a href="assess.html">Reassess in ${html(profileCurrency)}</a></div>`;
    const financial = document.getElementById('financialFitMount');
    if (financial && !financial.querySelector('.currency-fit-mismatch')) financial.innerHTML = copy;
    const vote = document.getElementById('purchaseVoteMount');
    if (vote && !vote.querySelector('.currency-fit-mismatch')) vote.innerHTML = copy;
  }

  function enhanceAll() {
    enhanceSearchWording();
    enhanceSnapRecovery();
    enhanceAssessmentCurrency();
    injectPreferredCurrencyControl();
    guardResultCurrency();
  }

  document.addEventListener('click', (event) => {
    const search = event.target.closest?.('#searchGoogle');
    if (search) { event.preventDefault(); event.stopImmediatePropagation(); runSearch(); return; }
    const importer = event.target.closest?.('#importProduct');
    if (importer) { event.preventDefault(); event.stopImmediatePropagation(); importProduct(); return; }
    const quickVote = event.target.closest?.('.snap-quick-vote');
    if (quickVote) {
      const hidden = document.getElementById('currency');
      preferredCurrency().then((pref) => {
        const current = validCurrency(hidden?.value);
        if (current && current !== pref) {
          event.preventDefault(); event.stopImmediatePropagation();
          const mount = quickVote.closest('.snap-candidates') || quickVote.parentElement;
          mount?.insertAdjacentHTML('beforeend', `<div class="quick-vote-note"><strong>Confirm the price in ${html(pref)} first</strong><span>This product is currently priced in ${html(current)}. TruWorth+ will not compare it with a ${html(pref)} financial profile until you confirm the equivalent price.</span></div>`);
        }
      });
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.target?.id === 'discoveryQuery' && event.key === 'Enter') {
      event.preventDefault(); event.stopImmediatePropagation(); runSearch();
    }
  }, true);

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'financialForm') {
      event.preventDefault(); event.stopImmediatePropagation(); saveFinancialProfile(event); return;
    }
    if (event.target?.id === 'assessment' && event.target.dataset.currencyUnconfirmed === '1') {
      event.preventDefault(); event.stopImmediatePropagation();
      const error = document.getElementById('formError');
      if (error) error.textContent = 'Confirm which currency this price uses before calculating the score.';
      document.getElementById('currencyMismatch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (event.target?.classList?.contains('snap-manual-search')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const query = event.target.querySelector('input')?.value.trim() || '';
      if (!query) return;
      const discovery = document.getElementById('discoveryQuery');
      if (discovery) { discovery.value = query; discovery.scrollIntoView({ behavior: 'smooth', block: 'center' }); discovery.focus(); }
      else location.href = `assess.html?q=${encodeURIComponent(query)}`;
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target?.closest?.('#financialForm')) {
      const code = validCurrency(document.getElementById('preferredCurrencySelect')?.value) || preferredCurrencyCache || 'GBP';
      renderFinancialPreview(code);
    }
  });

  const observer = new MutationObserver(() => {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceAll, 40);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });

  enhanceAll();
  [350, 900, 1800, 3200, 5200].forEach((ms) => setTimeout(() => { preferredCurrencyCache = null; enhanceAll(); }, ms));
})();
