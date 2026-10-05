function insightsPage() {
  const purchased = records.filter((r) => r.status === 'purchased' || purchases[r.id]);
  const average = records.length ? Math.round(records.reduce((total, r) => total + Number(r.score), 0) / records.length) : 0;
  const best = sortedRecords()[0];
  const totalConsidered = records.reduce((sum, r) => sum + Number(r.observed_price || 0), 0);
  layout('Insights', 'Patterns across the things you consider and buy.', `<section class="insight-cards"><article><span>Average score</span><strong>${records.length ? average : '—'}</strong><small>Across ${records.length} saved product${records.length === 1 ? '' : 's'}</small></article><article><span>Purchased</span><strong>${purchased.length}</strong><small>Products moved from consideration to ownership</small></article><article><span>Value considered</span><strong>${money(totalConsidered)}</strong><small>Total listed price across your saved library</small></article></section>${best ? `<section class="section-block"><div class="section-heading"><div><p class="kicker">Current leader</p><h2>Your strongest match</h2></div></div><div class="product-list">${productRow(best, 1)}</div></section>` : `<div class="empty-state"><h3>Your insights will build over time</h3><p>Save a few assessments and TruWorth will start showing patterns.</p></div>`}`, { kicker: 'Your patterns' });
}

function plansPage() {
  const isPlus = subscription.tier === 'plus' && ['active','trialing'].includes(subscription.status);
  layout('Membership', 'Choose how large you want your product library to be.', `<section class="plans-grid"><article class="plan-card"><p class="kicker">Free</p><h2>£0</h2><p>For occasional purchase decisions.</p><ul><li>Up to 10 saved products</li><li>Product link import</li><li>Comparison and purchase tracking</li></ul><span class="plan-status">${!isPlus ? 'Your current plan' : 'Available'}</span></article><article class="plan-card featured"><p class="kicker">TruWorth+</p><h2>Unlimited</h2><p>For people who want a long-term purchase history.</p><ul><li>Unlimited saved products</li><li>Full searchable history</li><li>Future premium insights</li></ul><button class="primary-button" type="button" disabled>${isPlus ? 'Current plan' : 'Payments coming next'}</button></article></section>`, { kicker: 'Plans' });
}

function accountPage() {
  if (authRecovery && user) return passwordRecoveryPage();
  if (user) return signedInAccountPage();
  layout('Your account', 'Save products across devices and keep a searchable purchase history.', `<section class="auth-layout"><form id="loginForm" class="auth-card"><p class="kicker">Welcome back</p><h2>Sign in</h2><label class="field"><span>Email</span><input id="loginEmail" type="email" autocomplete="email" required></label><label class="field"><span>Password</span><input id="loginPassword" type="password" autocomplete="current-password" minlength="6" required></label><p id="loginMessage" class="form-message" role="alert"></p><button class="primary-button" type="submit">Sign in</button><button class="text-button inline" id="forgotPassword" type="button">Forgot password?</button></form><form id="signupForm" class="auth-card soft"><p class="kicker">New to TruWorth?</p><h2>Create an account</h2><label class="field"><span>Email</span><input id="signupEmail" type="email" autocomplete="email" required></label><label class="field"><span>Password</span><input id="signupPassword" type="password" autocomplete="new-password" minlength="8" required><small>Use at least 8 characters.</small></label><p id="signupMessage" class="form-message" role="alert"></p><button class="secondary-button" type="submit">Create account</button></form></section>`, { kicker: 'Account' });
  $('loginForm').addEventListener('submit', login);
  $('signupForm').addEventListener('submit', signup);
  $('forgotPassword').addEventListener('click', resetPassword);
}

async function login(event) {
  event.preventDefault();
  const message = $('loginMessage');
  message.textContent = '';
  const { error } = await supabaseClient.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
  if (error) { message.textContent = error.message; message.className = 'form-message error'; return; }
  await syncGuestRecords();
  location.href = 'index.html';
}

async function signup(event) {
  event.preventDefault();
  const message = $('signupMessage');
  message.textContent = '';
  const email = $('signupEmail').value.trim();
  const { data, error } = await supabaseClient.auth.signUp({ email, password: $('signupPassword').value, options: { emailRedirectTo: `${location.origin}/account.html` } });
  if (error) { message.textContent = error.message; message.className = 'form-message error'; return; }
  message.textContent = data.session ? 'Account created. You are signed in.' : 'Check your email to confirm your account, then sign in.';
  message.className = 'form-message success';
}

async function resetPassword() {
  const email = $('loginEmail').value.trim();
  const message = $('loginMessage');
  if (!email) { message.textContent = 'Enter your email address first.'; return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/account.html` });
  message.textContent = error ? error.message : 'Password reset email sent.';
  message.className = `form-message ${error ? 'error' : 'success'}`;
}

function passwordRecoveryPage() {
  layout('Set a new password', 'Choose a new password for your TruWorth account.', `<form id="recoveryForm" class="auth-card single"><label class="field"><span>New password</span><input id="newPassword" type="password" minlength="8" required autocomplete="new-password"></label><p id="recoveryMessage" class="form-message"></p><button class="primary-button" type="submit">Update password</button></form>`, { kicker: 'Account recovery' });
  $('recoveryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { error } = await supabaseClient.auth.updateUser({ password: $('newPassword').value });
    $('recoveryMessage').textContent = error ? error.message : 'Password updated.';
    $('recoveryMessage').className = `form-message ${error ? 'error' : 'success'}`;
  });
}

function signedInAccountPage() {
  const limit = subscription.tier === 'plus' ? 'Unlimited saved products' : `${records.length} of 10 products saved`;
  layout('Your account', user.email, `<section class="account-overview"><div class="account-profile"><div class="avatar">${esc((user.email || 'T').charAt(0).toUpperCase())}</div><div><span>Email</span><strong>${esc(user.email)}</strong></div></div><div class="account-stats"><div><span>Plan</span><strong>${subscription.tier === 'plus' ? 'TruWorth+' : 'Free'}</strong></div><div><span>Storage</span><strong>${limit}</strong></div></div><div class="account-actions"><a class="secondary-button" href="plans.html">Membership</a><button id="signOut" class="text-button" type="button">Sign out</button></div></section>`, { kicker: 'Account' });
  $('signOut').addEventListener('click', async () => { await supabaseClient.auth.signOut(); location.href = 'index.html'; });
}

async function syncGuestRecords() {
  if (!supabaseClient || !local.records?.length) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const currentUser = sessionData.session?.user;
  if (!currentUser) return;
  const guestRecords = local.records.map(normaliseGuestRecord).slice(0, 10);
  for (const record of guestRecords) {
    const inputs = { ...record.inputs, item: record.title };
    const metrics = score(inputs);
    const { error } = await supabaseClient.from('assessments').insert({
      user_id: currentUser.id, title: record.title, brand: record.brand || null, retailer: record.retailer || null,
      source_url: record.source_url || null, canonical_url: record.canonical_url || null, image_url: record.image_url || null,
      observed_price: record.observed_price, currency: record.currency || 'GBP', score: record.score ?? metrics.score,
      score_version: record.score_version || metrics.version, inputs, status: record.status || 'considering'
    });
    if (error && String(error.message).includes('storage limit')) break;
  }
  local = { records: [], owned: {}, settings: local.settings || { motion: true } };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
}

function settingsPage() {
  layout('Settings', 'Control your app preferences and saved data.', `<section class="settings-list"><article><div><h2>Reduce motion</h2><p>Limit interface movement and transitions.</p></div><label class="switch"><input id="motionToggle" type="checkbox" ${local.settings?.motion === false ? 'checked' : ''}><span></span></label></article><article><div><h2>Privacy</h2><p>Your signed-in product history is private to your account. Product links are stored with the assessments you save.</p></div></article><article><div><h2>Delete saved products</h2><p>Remove your assessment history and purchase tracking. Your account stays active.</p></div><button id="deleteData" class="danger-button" type="button">Delete saved data</button></article></section><p id="settingsStatus" class="form-message" role="status"></p>`, { kicker: 'Preferences' });
  $('motionToggle').addEventListener('change', async () => {
    local.settings = local.settings || {};
    local.settings.motion = !$('motionToggle').checked;
    saveLocal();
    applyMotionPreference();
    if (user && supabaseClient) await supabaseClient.from('user_settings').update({ reduced_motion: $('motionToggle').checked }).eq('user_id', user.id);
  });
  $('deleteData').addEventListener('click', deleteSavedData);
}

async function deleteSavedData() {
  if (!confirm('Delete all saved TruWorth products and tracking data?')) return;
  const status = $('settingsStatus');
  try {
    if (user && supabaseClient) {
      const { error } = await supabaseClient.from('assessments').delete().eq('user_id', user.id);
      if (error) throw error;
    } else {
      records = []; purchases = {}; local.records = []; local.owned = {}; saveLocal();
    }
    status.textContent = 'Saved product data deleted.';
    status.className = 'form-message success';
  } catch (error) {
    console.error(error);
    status.textContent = 'We could not delete your saved data.';
    status.className = 'form-message error';
  }
}

function route() {
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
}

(async function boot() {
  await initBackend();
  route();
})();
