(() => {
  'use strict';

  const ENDPOINT = 'https://npfdkbqjoxolxxtmprmr.supabase.co/functions/v1/partner-enquiry';

  function setStatus(node, message, kind = '') {
    node.textContent = message;
    node.className = `partner-form-status${kind ? ` is-${kind}` : ''}`;
  }

  async function submit(form) {
    const status = form.querySelector('[data-partner-status]');
    const button = form.querySelector('button[type="submit"]');
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      contact_name: data.get('contact_name'),
      work_email: data.get('work_email'),
      company_name: data.get('company_name'),
      company_website: data.get('company_website'),
      enquiry_type: data.get('enquiry_type'),
      message: data.get('message'),
      company_fax: data.get('company_fax'),
      privacy_acknowledged: data.get('privacy_acknowledged') === 'on'
    };

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setStatus(status, 'Submitting…');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'We could not submit your enquiry.');
      form.reset();
      setStatus(status, 'Thanks. Your enquiry has been received. We will review it against TruWorth’s partnership standards.', 'success');
    } catch (error) {
      setStatus(status, error instanceof Error ? error.message : 'We could not submit your enquiry. Please try again.', 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('partnerEnquiryForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submit(form);
    });
  });
})();
