(() => {
  function enhanceFooter() {
    document.querySelectorAll('.site-footer').forEach((footer) => {
      if (footer.dataset.launchLegal === '1') return;
      footer.dataset.launchLegal = '1';
      footer.innerHTML = '<a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="decision-support.html">How TruWorth decides</a><a href="plans.html">Membership</a><a href="settings.html">Settings</a>';
    });
  }

  function addDecisionSupportNote() {
    if (!['result','plans','insights'].includes(document.body.dataset.page || '')) return;
    if (document.querySelector('.decision-support-note')) return;
    const target = document.querySelector('.decision-verdict, .membership-sheet, .buyer-profile-hero, .page-intro');
    if (!target) return;
    const note = document.createElement('div');
    note.className = 'decision-support-note';
    note.innerHTML = '<strong>Decision support, not financial advice.</strong><span>TruWorth uses the information you provide to help you pressure-test a purchase. It does not know every part of your financial circumstances and cannot guarantee an outcome.</span><a href="decision-support.html">How the recommendation works</a>';
    target.insertAdjacentElement('afterend', note);
  }

  async function deleteAccount() {
    if (typeof user === 'undefined' || !user || typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const typed = window.prompt('This permanently deletes your TruWorth account and saved data. Type DELETE to continue.');
    if (typed !== 'DELETE') return;
    const button = document.getElementById('deleteAccount');
    const status = document.getElementById('deleteAccountStatus');
    if (button) { button.disabled = true; button.textContent = 'Deleting…'; }
    if (status) { status.textContent = 'Deleting your account…'; status.className = 'form-message'; }
    try {
      const { data, error } = await supabaseClient.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error || !data?.deleted) throw error || new Error('Deletion was not confirmed.');
      try { await supabaseClient.auth.signOut({ scope: 'local' }); } catch {}
      try { localStorage.removeItem('sb-npfdkbqjoxolxxtmprmr-auth-token'); } catch {}
      try { localStorage.removeItem(typeof LOCAL_KEY !== 'undefined' ? LOCAL_KEY : 'truworth_guest_v1'); } catch {}
      location.href = 'index.html?account_deleted=1';
    } catch (error) {
      console.error('Account deletion failed', error);
      if (status) { status.textContent = 'We could not delete the account. Please try again. If it keeps failing, contact support.'; status.className = 'form-message error'; }
      if (button) { button.disabled = false; button.textContent = 'Delete account'; }
    }
  }

  function addDeleteAccountControl() {
    if (document.body.dataset.page !== 'settings') return;
    if (typeof user === 'undefined' || !user) return;
    const list = document.querySelector('.settings-list');
    if (!list || document.getElementById('deleteAccount')) return;
    const row = document.createElement('article');
    row.className = 'delete-account-row';
    row.innerHTML = '<div><h2>Delete account</h2><p>Permanently remove your TruWorth account, assessments, purchase history, financial profile and preferences. This cannot be undone.</p><p id="deleteAccountStatus" class="form-message" role="status"></p></div><button id="deleteAccount" class="danger-button" type="button">Delete account</button>';
    list.appendChild(row);
    document.getElementById('deleteAccount')?.addEventListener('click', deleteAccount);
  }

  function accountDeletedBanner() {
    const params = new URLSearchParams(location.search);
    if (params.get('account_deleted') !== '1' || document.querySelector('.account-deleted-banner')) return;
    const main = document.getElementById('main-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.className = 'account-deleted-banner';
    banner.innerHTML = '<strong>Your account has been deleted.</strong><span>Your signed-in TruWorth data has been removed.</span>';
    main.prepend(banner);
    params.delete('account_deleted');
    const qs = params.toString();
    history.replaceState({}, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  }

  function enhance() {
    enhanceFooter();
    addDecisionSupportNote();
    addDeleteAccountControl();
    accountDeletedBanner();
  }

  const observer = new MutationObserver(() => enhance());
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });
  enhance();
  [350, 900, 1800].forEach((ms) => setTimeout(enhance, ms));
})();
