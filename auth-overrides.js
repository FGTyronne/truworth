(() => {
  const AUTH_REDIRECT = `${location.origin}/auth.html`;

  function setMessage(id, text, type = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`.trim();
  }

  async function handleSignup(form) {
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value || '';
    if (!email || !password) return;
    setMessage('signupMessage', 'Creating your account…');
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_REDIRECT }
    });
    if (error) {
      setMessage('signupMessage', error.message, 'error');
      return;
    }
    if (data.session) {
      setMessage('signupMessage', 'Account created — you’re signed in.', 'success');
      location.href = 'index.html';
      return;
    }
    setMessage('signupMessage', 'Check your email and tap the confirmation link. It will bring you back to TruWorth.', 'success');

    if (!document.getElementById('resendConfirmation')) {
      const button = document.createElement('button');
      button.id = 'resendConfirmation';
      button.type = 'button';
      button.className = 'text-button inline';
      button.textContent = 'Resend confirmation email';
      form.appendChild(button);
      button.addEventListener('click', async () => {
        button.disabled = true;
        const { error: resendError } = await supabaseClient.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: AUTH_REDIRECT }
        });
        setMessage('signupMessage', resendError ? resendError.message : 'Confirmation email sent again.', resendError ? 'error' : 'success');
        button.disabled = false;
      });
    }
  }

  async function handlePasswordReset() {
    const input = document.getElementById('loginEmail');
    const email = input?.value.trim();
    if (!email) {
      setMessage('loginMessage', 'Enter your email address first.', 'error');
      input?.focus();
      return;
    }
    setMessage('loginMessage', 'Sending reset instructions…');
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT
    });
    setMessage(
      'loginMessage',
      error ? error.message : 'If an account exists for that email, we’ve sent a password reset link. The link will return you to TruWorth.',
      error ? 'error' : 'success'
    );
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'signupForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    await handleSignup(form);
  }, true);

  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('#forgotPassword');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await handlePasswordReset();
  }, true);
})();