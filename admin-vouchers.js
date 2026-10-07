(() => {
  'use strict';
  const SUPABASE_URL = 'https://npfdkbqjoxolxxtmprmr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
  const root = document.getElementById('voucherAdminApp');
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = (unix) => unix ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(Number(unix)*1000)) : 'No expiry';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let accessToken = '';

  function randomCode() {
    const bytes = new Uint8Array(5); crypto.getRandomValues(bytes);
    return `FAMILY-${Array.from(bytes, b => (b % 36).toString(36)).join('').toUpperCase()}`;
  }

  async function callAdmin(payload) {
    let { data: { session } } = await sb.auth.getSession();
    if (!session) return { status: 401, data: { error: 'Sign in required' } };
    accessToken = session.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/voucher-admin`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${accessToken}`, 'apikey':SUPABASE_KEY },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({ error: 'Unexpected server response' }));
    return { status: res.status, data };
  }

  function renderBootstrap() {
    root.innerHTML = `<section class="voucher-admin-panel">
      <div class="voucher-admin-kicker">Owner setup</div>
      <h1>Claim voucher control</h1>
      <p class="voucher-admin-muted">This one-time step makes your currently signed-in TruWorth account the voucher administrator. After it succeeds, the setup code can no longer create another administrator.</p>
      <form id="bootstrapForm">
        <div class="voucher-field"><label for="bootstrapPin">One-time owner code</label><input id="bootstrapPin" class="voucher-bootstrap-code" autocomplete="off" required></div>
        <div class="voucher-actions"><button class="voucher-btn primary" type="submit">Claim admin access</button></div>
        <p id="bootstrapStatus" class="voucher-status" role="status"></p>
      </form>
    </section>`;
    document.getElementById('bootstrapForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget.querySelector('button');
      const status = document.getElementById('bootstrapStatus');
      btn.disabled = true; status.textContent = 'Checking…'; status.className = 'voucher-status';
      const result = await callAdmin({ action:'bootstrap', pin:document.getElementById('bootstrapPin').value.trim() });
      if (result.status === 200 && result.data?.admin) { status.textContent = 'Admin access claimed.'; status.className = 'voucher-status success'; await loadDashboard(); return; }
      status.textContent = result.data?.error || 'That setup code was not accepted.'; status.className = 'voucher-status error'; btn.disabled = false;
    });
  }

  function renderDenied() {
    root.innerHTML = `<section class="voucher-admin-panel"><div class="voucher-admin-kicker">Private</div><h1>Voucher control</h1><p class="voucher-admin-muted">This signed-in account does not have administrator access.</p><div class="voucher-actions"><a class="voucher-btn secondary" href="account.html">Back to account</a></div></section>`;
  }

  function voucherCard(v) {
    const expired = v.expires_at && (Number(v.expires_at) * 1000 < Date.now());
    const usedUp = v.max_redemptions && Number(v.times_redeemed) >= Number(v.max_redemptions);
    const live = v.active && !expired && !usedUp;
    return `<article class="voucher-row" data-promo="${esc(v.id)}">
      <div class="voucher-row-top"><div><div class="voucher-code">${esc(v.code)}</div><div class="voucher-meta">
        <span class="voucher-pill ${live?'active':'off'}">${live?'Active':expired?'Expired':usedUp?'Used':'Disabled'}</span>
        <span class="voucher-pill">${esc(v.percent_off ?? 0)}% off</span>
        <span class="voucher-pill">${esc(v.times_redeemed)} / ${esc(v.max_redemptions ?? '∞')} redeemed</span>
        <span class="voucher-pill">${esc(date(v.expires_at))}</span>
      </div></div><div class="voucher-actions">
        <button type="button" class="voucher-btn ghost copy-voucher" data-code="${esc(v.code)}">Copy</button>
        ${live ? `<button type="button" class="voucher-btn warning disable-voucher" data-id="${esc(v.id)}" data-code="${esc(v.code)}">Disable</button>` : ''}
      </div></div>
    </article>`;
  }

  function redemptionCard(r) {
    const end = r.current_period_end ? date(r.current_period_end) : 'Unknown renewal';
    return `<article class="voucher-row">
      <div class="voucher-row-top"><div><div class="voucher-redemption-email">${esc(r.customer_email || 'Stripe customer')}</div><div class="voucher-meta">
        <span class="voucher-pill ${['active','trialing'].includes(r.status)?'active':'off'}">${esc(r.status)}</span>
        <span class="voucher-pill">${esc(r.percent_off ?? 0)}% discount</span>
        <span class="voucher-pill">${esc(end)}</span>
      </div></div></div>
      <div class="voucher-actions">
        <button type="button" class="voucher-btn warning remove-discount" data-id="${esc(r.subscription_id)}">Remove voucher</button>
        <button type="button" class="voucher-btn danger cancel-subscription" data-id="${esc(r.subscription_id)}">Cancel TruWorth+</button>
      </div>
    </article>`;
  }

  async function loadDashboard(message='') {
    root.innerHTML = '<div class="voucher-admin-loading">Loading vouchers…</div>';
    const result = await callAdmin({ action:'list' });
    if (result.status === 403 && result.data?.bootstrap_available) { renderBootstrap(); return; }
    if (result.status === 403) { renderDenied(); return; }
    if (result.status !== 200) { root.innerHTML = `<section class="voucher-admin-panel"><h1>Voucher control unavailable</h1><p class="voucher-admin-muted">${esc(result.data?.error || 'Please try again.')}</p></section>`; return; }
    const vouchers = result.data?.vouchers || [];
    const redemptions = result.data?.redemptions || [];
    root.innerHTML = `<section class="voucher-admin-panel">
      <div class="voucher-admin-kicker">TruWorth private control</div>
      <h1>Vouchers</h1>
      <p class="voucher-admin-muted">Create controlled Stripe vouchers for family and product testing. A 100% forever voucher keeps that tester at £0 until you remove the discount or cancel their Plus subscription.</p>
      <form id="createVoucherForm">
        <div class="voucher-admin-grid">
          <div class="voucher-field"><label for="voucherCode">Voucher code</label><input id="voucherCode" maxlength="32" value="${randomCode()}" required></div>
          <div class="voucher-field"><label for="voucherDiscount">Discount</label><select id="voucherDiscount"><option value="100">100% off</option><option value="75">75% off</option><option value="50">50% off</option><option value="25">25% off</option></select></div>
          <div class="voucher-field"><label for="voucherUses">Maximum redemptions</label><input id="voucherUses" type="number" min="1" max="1000" value="1" required></div>
          <div class="voucher-field"><label for="voucherExpiry">Redeem by (optional)</label><input id="voucherExpiry" type="date"></div>
        </div>
        <div class="voucher-actions"><button class="voucher-btn primary" type="submit">Create voucher</button><button class="voucher-btn secondary" id="newCode" type="button">New code</button></div>
        <div class="voucher-note">The discount duration is deliberately set to <strong>forever</strong>. You stay in control: disable the code to stop new use, remove the discount from an existing tester, or cancel their Plus subscription.</div>
        <p id="createStatus" class="voucher-status ${message?'success':''}" role="status">${esc(message)}</p>
      </form>
    </section>
    <section class="voucher-admin-panel"><h2>Voucher library</h2><p class="voucher-admin-muted">Disabling a code stops future redemption. It does not alter a tester who already redeemed it.</p><div class="voucher-stack">${vouchers.length?vouchers.map(voucherCard).join(''):'<div class="voucher-empty">No vouchers yet.</div>'}</div></section>
    <section class="voucher-admin-panel"><h2>Voucher-backed subscriptions</h2><p class="voucher-admin-muted">Removing a voucher keeps Plus active and returns the subscription to normal pricing at its next applicable invoice. Cancelling Plus ends the Stripe subscription immediately.</p><div class="voucher-stack">${redemptions.length?redemptions.map(redemptionCard).join(''):'<div class="voucher-empty">No active voucher discounts found.</div>'}</div></section>`;

    document.getElementById('newCode').addEventListener('click', () => { document.getElementById('voucherCode').value = randomCode(); });
    document.getElementById('createVoucherForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const btn=e.currentTarget.querySelector('[type="submit"]'); const status=document.getElementById('createStatus'); btn.disabled=true; status.textContent='Creating in Stripe…'; status.className='voucher-status';
      const expiry=document.getElementById('voucherExpiry').value;
      const result=await callAdmin({action:'create',code:document.getElementById('voucherCode').value.trim(),percent_off:Number(document.getElementById('voucherDiscount').value),max_redemptions:Number(document.getElementById('voucherUses').value),expires_at:expiry?`${expiry}T23:59:59Z`:null});
      if(result.status===200){await loadDashboard(`Created ${result.data?.voucher?.code || 'voucher'}.`);return;}
      status.textContent=result.data?.error||'Could not create voucher.';status.className='voucher-status error';btn.disabled=false;
    });
    root.querySelectorAll('.copy-voucher').forEach(btn=>btn.addEventListener('click',async()=>{await navigator.clipboard.writeText(btn.dataset.code);const old=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=old,1200);}));
    root.querySelectorAll('.disable-voucher').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm(`Disable ${btn.dataset.code}? It will stop new redemptions but will not remove discounts already in use.`))return;btn.disabled=true;const r=await callAdmin({action:'disable',promotion_code_id:btn.dataset.id});if(r.status===200)await loadDashboard(`${btn.dataset.code} disabled.`);else{alert(r.data?.error||'Could not disable voucher.');btn.disabled=false;}}));
    root.querySelectorAll('.remove-discount').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Remove this voucher from the subscription? The tester keeps TruWorth+, but future billing returns to the normal subscription price.'))return;btn.disabled=true;const r=await callAdmin({action:'remove_discount',subscription_id:btn.dataset.id});if(r.status===200)await loadDashboard('Voucher removed from subscription.');else{alert(r.data?.error||'Could not remove voucher.');btn.disabled=false;}}));
    root.querySelectorAll('.cancel-subscription').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Cancel this TruWorth+ subscription immediately? This stops future Stripe billing and removes Plus access when the webhook is processed.'))return;btn.disabled=true;const r=await callAdmin({action:'cancel_subscription',subscription_id:btn.dataset.id});if(r.status===200)await loadDashboard('TruWorth+ subscription cancelled.');else{alert(r.data?.error||'Could not cancel subscription.');btn.disabled=false;}}));
  }

  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.replace('account.html'); return; }
    const status = await callAdmin({ action:'status' });
    if (status.status === 200 && status.data?.admin) { await loadDashboard(); return; }
    if (status.status === 403 && status.data?.bootstrap_available) { renderBootstrap(); return; }
    renderDenied();
  })().catch((error) => {
    console.error(error);
    root.innerHTML = '<section class="voucher-admin-panel"><h1>Voucher control unavailable</h1><p class="voucher-admin-muted">Refresh and try again.</p></section>';
  });
})();
