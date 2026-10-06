(() => {
  const SUPABASE_URL = 'https://npfdkbqjoxolxxtmprmr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
  const root = document.getElementById('authCallback');
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const initialType = hash.get('type') || search.get('type') || '';
  const initialError = hash.get('error_description') || search.get('error_description') || '';
  let recoveryEvent = initialType === 'recovery';

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryEvent = true;
  });

  function cleanUrl() {
    history.replaceState({}, document.title, `${location.origin}${location.pathname}`);
  }

  function renderSuccess(title, body, actionLabel = 'Continue to TruWorth', href = 'account.html') {
    root.innerHTML = `<div class="auth-icon success" aria-hidden="true">✓</div><p class="auth-kicker">All set</p><h1>${title}</h1><p>${body}</p><div class="auth-actions"><a class="primary-button" href="${href}">${actionLabel}</a><a class="secondary-button" href="index.html">Go home</a></div>`;
  }

  function renderError(message) {
    root.innerHTML = `<div class="auth-icon error" aria-hidden="true">!</div><p class="auth-kicker">That link didn’t work</p><h1>We can fix this.</h1><p>${message}</p><div class="auth-actions"><a class="primary-button" href="account.html">Request a new link</a><a class="secondary-button" href="index.html">Go home</a></div>`;
  }

  function renderReset() {
    root.innerHTML = `<p class="auth-kicker">Password reset</p><h1>Choose a new password.</h1><p>Use at least 8 characters. Once it’s changed, you’ll return to your TruWorth account.</p><form id="authResetForm" class="auth-reset-form"><label><span>New password</span><input id="authNewPassword" type="password" minlength="8" autocomplete="new-password" required></label><label><span>Confirm new password</span><input id="authConfirmPassword" type="password" minlength="8" autocomplete="new-password" required></label><p id="authResetMessage" class="auth-message" role="alert"></p><button class="primary-button" type="submit">Update password</button></form>`;
    document.getElementById('authResetForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const first = document.getElementById('authNewPassword').value;
      const second = document.getElementById('authConfirmPassword').value;
      const message = document.getElementById('authResetMessage');
      if (first !== second) {
        message.textContent = 'The passwords do not match.';
        message.className = 'auth-message error';
        return;
      }
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      message.textContent = 'Updating your password…';
      const { error } = await client.auth.updateUser({ password: first });
      if (error) {
        message.textContent = error.message;
        message.className = 'auth-message error';
        button.disabled = false;
        return;
      }
      cleanUrl();
      renderSuccess('Password changed.', 'Your new password is ready to use. You are still securely signed in.', 'Open my account');
    });
  }

  async function boot() {
    try {
      const { data, error } = await client.auth.getSession();
      const session = data?.session || null;
      if (initialError) {
        cleanUrl();
        renderError(decodeURIComponent(initialError.replace(/\+/g, ' ')) || 'The email link may have expired or already been used.');
        return;
      }
      if (error) {
        cleanUrl();
        renderError('The email link could not be verified. It may have expired or already been used.');
        return;
      }
      if (recoveryEvent || initialType === 'recovery') {
        cleanUrl();
        if (!session) {
          renderError('This password reset link is no longer valid. Request a new one and use the newest email we send you.');
          return;
        }
        renderReset();
        return;
      }
      cleanUrl();
      if (session) {
        renderSuccess('Email confirmed.', 'Your TruWorth account is verified and ready to use.');
        return;
      }
      renderSuccess('Email confirmed.', 'Your email has been verified. Sign in to continue to your account.', 'Sign in', 'account.html');
    } catch (error) {
      console.error(error);
      cleanUrl();
      renderError('Something interrupted the verification. Return to the account page and request a fresh link.');
    }
  }

  boot();
})();