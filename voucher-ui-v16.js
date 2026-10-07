(() => {
  async function voucherAdminStatus() {
    if (!user || !supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient.functions.invoke('voucher-admin', { body: { action: 'status' } });
      if (error) return null;
      return data || null;
    } catch (_) { return null; }
  }

  const previousPlansPage = plansPage;
  plansPage = function plansPageWithVouchers() {
    previousPlansPage();
    const sheet = document.querySelector('.membership-sheet');
    if (!sheet || document.querySelector('.voucher-checkout-note')) return;
    const note = document.createElement('p');
    note.className = 'legal-note voucher-checkout-note';
    note.innerHTML = '<strong>Have a voucher?</strong> Choose either plan, then enter it in secure Stripe Checkout before confirming.';
    sheet.insertAdjacentElement('afterend', note);
  };

  const previousAccountPage = signedInAccountPage;
  signedInAccountPage = function signedInAccountPageWithVoucherAdmin() {
    previousAccountPage();
    voucherAdminStatus().then((data) => {
      if (!data?.admin || document.getElementById('voucherAdminLink')) return;
      const actions = document.querySelector('.account-actions');
      const signOut = document.getElementById('signOut');
      if (!actions) return;
      const link = document.createElement('a');
      link.id = 'voucherAdminLink';
      link.className = 'secondary-button';
      link.href = 'admin-vouchers.html';
      link.textContent = 'Voucher control';
      actions.insertBefore(link, signOut || null);
    });
  };
})();
