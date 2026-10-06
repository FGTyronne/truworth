(() => {
  const CURRENCIES = ['GBP','USD','EUR','CHF','CAD','AUD','NZD','ZAR','AED','SGD','JPY','HKD'];
  let preferred = null;
  let financial = null;
  let loaded = false;
  let timer = null;

  const valid = (v) => CURRENCIES.includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : null;
  const signed = () => typeof user !== 'undefined' && user && typeof supabaseClient !== 'undefined' && supabaseClient;
  const symbol = (code) => {
    try { return new Intl.NumberFormat(undefined,{style:'currency',currency:code,currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).formatToParts(0).find((p)=>p.type==='currency')?.value || code; }
    catch { return code; }
  };
  const format = (n, code) => {
    try { return new Intl.NumberFormat(undefined,{style:'currency',currency:code,maximumFractionDigits:2}).format(Number(n||0)); }
    catch { return `${code} ${Number(n||0).toFixed(2)}`; }
  };

  async function load() {
    if (loaded) return;
    preferred = valid(typeof local !== 'undefined' ? local?.settings?.preferred_currency : null) || 'GBP';
    if (signed()) {
      try {
        const [{data:settingsRow},{data:fin}] = await Promise.all([
          supabaseClient.from('user_settings').select('settings').eq('user_id',user.id).maybeSingle(),
          supabaseClient.from('financial_profiles').select('currency,income_amount').eq('user_id',user.id).maybeSingle(),
        ]);
        preferred = valid(settingsRow?.settings?.preferred_currency) || preferred || valid(fin?.currency) || 'GBP';
        financial = valid(fin?.currency);
      } catch (error) { console.debug('Currency state load skipped', error); }
    }
    loaded = true;
  }

  async function savePreference(code) {
    code = valid(code) || 'GBP';
    preferred = code;
    if (typeof local !== 'undefined' && local) {
      local.settings = local.settings || {};
      local.settings.preferred_currency = code;
      try { saveLocal(); } catch {}
    }
    if (!signed()) return;
    try {
      const {data} = await supabaseClient.from('user_settings').select('settings').eq('user_id',user.id).maybeSingle();
      const settings = {...(data?.settings || {}), preferred_currency: code};
      await supabaseClient.from('user_settings').upsert({user_id:user.id,settings,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    } catch (error) { console.warn('Could not save currency preference', error); }
  }

  function moneySymbols(code, root) {
    root?.querySelectorAll('.money-input > span:first-child').forEach((node) => { node.textContent = symbol(code); });
  }

  function preview(code) {
    const mount = document.getElementById('financialPreview');
    const amountField = document.getElementById('incomeAmount');
    if (!mount || !amountField) return;
    const amount = Number(amountField.value || 0);
    if (!amount) { mount.innerHTML = '<span>Add your income to calculate monthly free cash.</span>'; return; }
    const period = document.getElementById('incomePeriod')?.value || 'monthly';
    const monthly = period === 'annual' ? amount / 12 : amount;
    const free = Math.max(0, monthly - Number(document.getElementById('essentialOutgoings')?.value || 0) - Number(document.getElementById('debtCommitments')?.value || 0) - Number(document.getElementById('savingsTarget')?.value || 0));
    mount.innerHTML = `<span>Estimated monthly free cash</span><strong>${format(free,code)}</strong><small>After the commitments you entered</small>`;
  }

  async function stabiliseProfileCurrency() {
    await load();
    const form = document.querySelector('#financial-profile .financial-form');
    const block = document.querySelector('.preferred-currency-block');
    const old = document.getElementById('preferredCurrencySelect');
    if (!form || !block || !old || document.getElementById('profilePreferredCurrencySelect')) return;

    const visible = old.cloneNode(true);
    visible.id = 'profilePreferredCurrencySelect';
    visible.value = preferred || 'GBP';
    old.replaceWith(visible);

    const financialCode = financial || preferred || 'GBP';
    const hidden = document.createElement('select');
    hidden.id = 'preferredCurrencySelect';
    hidden.hidden = true;
    hidden.innerHTML = `<option value="${financialCode}">${financialCode}</option>`;
    hidden.value = financialCode;
    block.appendChild(hidden);

    moneySymbols(financialCode, form);
    preview(financialCode);
    const status = document.getElementById('preferredCurrencyStatus');
    if (status && financial && financial !== preferred) status.textContent = `Shopping default: ${preferred}. Your existing financial figures remain ${financial}.`;

    visible.addEventListener('change', async () => {
      const next = valid(visible.value) || 'GBP';
      await savePreference(next);
      if (!financial) {
        hidden.innerHTML = `<option value="${next}">${next}</option>`;
        hidden.value = next;
        moneySymbols(next, form);
        preview(next);
      }
      const msg = document.getElementById('preferredCurrencyStatus');
      if (msg) msg.textContent = financial && financial !== next ? `Shopping default changed to ${next}. Your saved financial figures remain ${financial}.` : `Default changed to ${next}.`;
    });

    form.addEventListener('input', () => preview(financial || preferred || 'GBP'));
  }

  async function safeSaveFinancialProfile(event) {
    await load();
    if (!signed()) return;
    const status = document.getElementById('financialStatus');
    const code = financial || preferred || 'GBP';
    const numberOrNull = (id) => {
      const raw = document.getElementById(id)?.value;
      return raw === '' || raw == null ? null : Number(raw);
    };
    const payload = {
      user_id: user.id,
      currency: code,
      income_amount: numberOrNull('incomeAmount'),
      income_period: document.getElementById('incomePeriod')?.value || 'monthly',
      essential_outgoings_monthly: numberOrNull('essentialOutgoings'),
      debt_commitments_monthly: numberOrNull('debtCommitments'),
      savings_target_monthly: numberOrNull('savingsTarget'),
      updated_at: new Date().toISOString(),
    };
    try {
      if (status) status.textContent = 'Saving…';
      const {error} = await supabaseClient.from('financial_profiles').upsert(payload,{onConflict:'user_id'});
      if (error) throw error;
      financial = code;
      const hidden = document.getElementById('preferredCurrencySelect');
      if (hidden) { hidden.innerHTML = `<option value="${code}">${code}</option>`; hidden.value = code; }
      moneySymbols(code, document.querySelector('#financial-profile .financial-form'));
      preview(code);
      if (status) { status.textContent = `Private financial context saved in ${code}.`; status.className = 'form-message success'; }
    } catch (error) {
      console.error(error);
      if (status) { status.textContent = 'We could not save your financial context.'; status.className = 'form-message error'; }
    }
  }

  window.addEventListener('submit', (event) => {
    if (event.target?.id !== 'financialForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    safeSaveFinancialProfile(event);
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.snap-quick-vote')) return;
    const assessmentCurrency = valid(document.getElementById('currency')?.value);
    const basis = financial || preferred || valid(typeof local !== 'undefined' ? local?.settings?.preferred_currency : null) || 'GBP';
    if (assessmentCurrency && assessmentCurrency !== basis) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = event.target.closest('.snap-quick-vote');
      const mount = button.closest('.snap-candidates') || button.parentElement;
      if (!mount?.querySelector('.currency-vote-warning')) mount?.insertAdjacentHTML('beforeend', `<div class="quick-vote-note currency-vote-warning"><strong>Confirm the price in ${basis} first</strong><span>This product is currently ${assessmentCurrency}. TruWorth+ will not compare it with your ${basis} financial profile until you enter a confirmed equivalent price.</span></div>`);
    }
  }, true);

  function enhance() { stabiliseProfileCurrency(); }

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(enhance, 50);
  });
  if (document.body) observer.observe(document.body,{childList:true,subtree:true});
  else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
  enhance();
  [500,1200,2500].forEach((ms)=>setTimeout(()=>{loaded=false;enhance();},ms));
})();
