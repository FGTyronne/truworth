(() => {
  'use strict';

  const HERO_SRC = 'assets/hero-products.webp?v=20261016a';
  const originalAccountPage = typeof accountPage === 'function' ? accountPage : null;

  function restoreProductArtwork() {
    const homeImage = document.querySelector('.tw-collage-card img');
    if (homeImage) {
      homeImage.src = HERO_SRC;
      homeImage.alt = 'Examples of recognisable everyday purchases including technology, fashion, beauty, gaming and home products';
      homeImage.loading = 'eager';
      homeImage.decoding = 'async';
      try { homeImage.fetchPriority = 'high'; } catch {}
    }

    const assessImage = document.querySelector('.tw-assess-examples img');
    if (assessImage) {
      assessImage.src = HERO_SRC;
      assessImage.alt = 'Examples of recognisable everyday products';
      assessImage.loading = 'lazy';
      assessImage.decoding = 'async';
    }
  }

  function normaliseNavigation() {
    const footer = document.querySelector('.site-footer');
    if (footer) {
      footer.innerHTML = [
        '<span class="tw-footer-note">TruWorth · Buy with your eyes open.</span>',
        '<a href="/privacy.html">Privacy</a>',
        '<a href="/terms.html">Terms</a>',
        '<a href="/cookies.html">Cookies</a>',
        '<a href="/security.html">Security</a>',
        '<a href="/decision-support.html">How TruWorth works</a>',
        '<a href="/member-benefits.html">Member Benefits</a>',
        '<a href="/partner-with-truworth.html">Partner with us</a>',
        '<a href="/commercial-disclosure.html">Commercial disclosure</a>',
        '<a href="/plans.html">Membership</a>',
        '<a href="/settings.html">Settings</a>',
        '<button class="tw-cookie-link" type="button" data-tw-cookie-settings>Cookie settings</button>'
      ].join('');
      footer.dataset.footerVersion = 'tw33';
    }

    document.querySelectorAll('.bottom-nav a, .site-footer a, .site-footer button').forEach((node) => {
      node.style.pointerEvents = 'auto';
      node.style.touchAction = 'manipulation';
    });
  }

  function applyVisuals() {
    document.body?.classList.add('tw-playful');
    restoreProductArtwork();
    normaliseNavigation();
  }

  function showAuthFace(face) {
    const shell = document.getElementById('twAuthShell');
    if (!shell) return;
    const signup = face === 'signup';
    shell.classList.toggle('is-signup', signup);

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const signInToggle = document.getElementById('twAuthSigninToggle');
    const signUpToggle = document.getElementById('twAuthSignupToggle');

    if (loginForm) {
      loginForm.setAttribute('aria-hidden', signup ? 'true' : 'false');
      loginForm.inert = signup;
    }
    if (signupForm) {
      signupForm.setAttribute('aria-hidden', signup ? 'false' : 'true');
      signupForm.inert = !signup;
    }
    signInToggle?.setAttribute('aria-selected', signup ? 'false' : 'true');
    signUpToggle?.setAttribute('aria-selected', signup ? 'true' : 'false');

    const focusTarget = signup ? document.getElementById('signupEmail') : document.getElementById('loginEmail');
    requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
  }

  function renderSignedOutAccount() {
    layout('Account', 'Sign in to continue, or create a free account in seconds.', `
      <section class="tw-auth-shell" id="twAuthShell">
        <div class="tw-auth-tabs" role="tablist" aria-label="Account access">
          <button id="twAuthSigninToggle" type="button" role="tab" aria-selected="true" data-auth-face="signin">Sign in</button>
          <button id="twAuthSignupToggle" type="button" role="tab" aria-selected="false" data-auth-face="signup">Create account</button>
        </div>

        <div class="tw-auth-flip">
          <div class="tw-auth-flip-inner">
            <form id="loginForm" class="auth-card tw-auth-face tw-auth-front" aria-hidden="false">
              <p class="kicker">Welcome back</p>
              <h2>Sign in</h2>
              <p class="tw-auth-lead">Pick up where you left off and keep your purchase history together.</p>
              <label class="field"><span>Email</span><input id="loginEmail" type="email" autocomplete="email" required></label>
              <label class="field"><span>Password</span><input id="loginPassword" type="password" autocomplete="current-password" minlength="6" required></label>
              <p id="loginMessage" class="form-message" role="alert"></p>
              <button class="primary-button" type="submit">Sign in</button>
              <button class="text-button inline" id="forgotPassword" type="button">Forgot password?</button>
              <p class="tw-auth-switch-copy">New to TruWorth? <button type="button" data-auth-face="signup">Create a free account</button></p>
            </form>

            <form id="signupForm" class="auth-card soft tw-auth-face tw-auth-back" aria-hidden="true" inert>
              <p class="kicker">New here?</p>
              <h2>Create an account</h2>
              <p class="tw-auth-lead">Save your assessments, compare purchases and build your buying history.</p>
              <label class="field"><span>Email</span><input id="signupEmail" type="email" autocomplete="email" required></label>
              <label class="field"><span>Password</span><input id="signupPassword" type="password" autocomplete="new-password" minlength="8" required><small>Use at least 8 characters.</small></label>
              <p id="signupMessage" class="form-message" role="alert"></p>
              <button class="primary-button" type="submit">Create account</button>
              <p class="tw-auth-switch-copy">Already a member? <button type="button" data-auth-face="signin">Sign in instead</button></p>
            </form>
          </div>
        </div>
      </section>
    `, { kicker: 'Account' });

    document.getElementById('loginForm')?.addEventListener('submit', login);
    document.getElementById('signupForm')?.addEventListener('submit', signup);
    document.getElementById('forgotPassword')?.addEventListener('click', resetPassword);
    document.querySelectorAll('[data-auth-face]').forEach((button) => {
      button.addEventListener('click', () => showAuthFace(button.dataset.authFace));
    });

    const requested = new URLSearchParams(location.search).get('mode');
    if (requested === 'signup') showAuthFace('signup');
  }

  if (originalAccountPage) {
    accountPage = function accountPageV33() {
      if (authRecovery || user) return originalAccountPage();
      return renderSignedOutAccount();
    };
  }

  window.addEventListener('truworth:routed', () => requestAnimationFrame(applyVisuals));
  window.addEventListener('truworth:release-ready', () => requestAnimationFrame(applyVisuals), { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) requestAnimationFrame(applyVisuals);
})();
