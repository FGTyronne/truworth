(() => {
  'use strict';

  const provenance = { price_type: '', price_confidence: '', price_source: '', price_url: '', variant: '' };

  function addStyles() {
    if (document.getElementById('twLaunchHardening31Styles')) return;
    const style = document.createElement('style');
    style.id = 'twLaunchHardening31Styles';
    style.textContent = `
      .tw-skip-link{position:fixed;left:12px;top:12px;z-index:20000;transform:translateY(-180%);padding:10px 14px;border-radius:10px;background:#101b4d;color:#fff;font-weight:800;text-decoration:none}.tw-skip-link:focus{transform:none}
      :where(a,button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid rgba(21,195,154,.45)!important;outline-offset:3px!important}
      .tw-network-banner{position:fixed;left:50%;bottom:84px;z-index:15000;transform:translateX(-50%);padding:10px 14px;border-radius:999px;background:#101b4d;color:#fff;font-size:.82rem;font-weight:800;box-shadow:0 10px 30px rgba(16,27,77,.2)}
      .tw-change-card{margin-top:14px;padding:18px;border:1px solid rgba(16,27,77,.12);border-radius:20px;background:#fff}.tw-change-card h3{margin:4px 0 8px}.tw-change-card p{margin:0;color:#68708a}.tw-change-list{margin:12px 0 0;padding-left:20px;color:#343b56}.tw-change-list li+li{margin-top:7px}.tw-change-note{margin-top:12px!important;font-size:.78rem!important;color:#7a8194!important}
      .field-hint[data-price-state="warning"]{color:#7a5a07}.field-hint[data-price-state="good"]{color:#08765d}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  }

  function enhanceAccessibility() {
    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main-content';
    if (main && !document.querySelector('.tw-skip-link')) {
      const link = document.createElement('a');
      link.className = 'tw-skip-link';
      link.href = '#main-content';
      link.textContent = 'Skip to main content';
      document.body.prepend(link);
    }
    const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('a[href]').forEach((a) => {
      try {
        const href = new URL(a.getAttribute('href'), location.href).pathname.split('/').pop()?.toLowerCase() || 'index.html';
        if (href === current) a.setAttribute('aria-current', 'page');
        else if (a.getAttribute('aria-current') === 'page') a.removeAttribute('aria-current');
      } catch {}
    });
    document.querySelectorAll('button').forEach((button) => {
      if (!button.getAttribute('aria-label') && !button.textContent?.trim() && button.getAttribute('title')) button.setAttribute('aria-label', button.getAttribute('title'));
    });
  }

  function networkBanner(offline) {
    document.getElementById('twNetworkBanner')?.remove();
    if (!offline) return;
    const node = document.createElement('div');
    node.id = 'twNetworkBanner';
    node.className = 'tw-network-banner';
    node.setAttribute('role', 'status');
    node.textContent = 'You are offline. Some TruWorth actions cannot be saved yet.';
    document.body.appendChild(node);
  }

  const baseFormValues = typeof formValues === 'function' ? formValues : null;
  if (baseFormValues) {
    formValues = function formValuesV31() {
      return { ...baseFormValues(), ...provenance };
    };
  }

  if (typeof importProductFromUrl === 'function') {
    importProductFromUrl = async function importProductFromUrlV31() {
      const status = document.getElementById('importStatus');
      const field = document.getElementById('productUrl');
      const button = document.getElementById('importProduct');
      const url = field?.value?.trim() || '';
      if (!status || !button) return;
      if (!url) { status.textContent = 'Paste a product link first.'; return; }
      if (!user || !supabaseClient) { status.innerHTML = 'Sign in to import details automatically. <a href="account.html">Sign in</a>'; return; }
      status.removeAttribute('data-price-state');
      status.textContent = 'Importing page details…';
      button.disabled = true;
      try {
        const { data, error } = await supabaseClient.functions.invoke('import-product', { body: { url } });
        if (error) throw error;
        if (data?.title) document.getElementById('item').value = data.title;
        if (data?.brand) document.getElementById('brand').value = data.brand;
        if (data?.retailer) document.getElementById('retailer').value = data.retailer;
        if (data?.image_url) document.getElementById('imageUrl').value = data.image_url;
        if (data?.canonical_url) document.getElementById('canonicalUrl').value = data.canonical_url;
        if (data?.currency) document.getElementById('currency').value = data.currency;

        provenance.price_type = data?.price_type || (data?.price_is_from ? 'starting' : (data?.price != null ? 'exact' : 'unknown'));
        provenance.price_confidence = data?.price_confidence || (data?.price_source === 'product-page' ? 'high' : (data?.price_source ? 'medium' : 'low'));
        provenance.price_source = data?.price_source || '';
        provenance.price_url = data?.price_url || '';
        provenance.variant = data?.variant || '';

        const price = document.getElementById('price');
        if (data?.price != null && provenance.price_type !== 'monthly') price.value = data.price;

        if (provenance.price_type === 'monthly') {
          price.value = '';
          status.dataset.priceState = 'warning';
          status.textContent = 'We found a monthly price, not a reliable cash purchase price. Enter the full cash price before scoring.';
        } else if (provenance.price_type === 'starting') {
          status.dataset.priceState = 'warning';
          status.textContent = 'A starting price was imported. Confirm the exact variant and cash price before relying on affordability or value.';
        } else if (provenance.price_type === 'sale') {
          status.dataset.priceState = 'warning';
          status.textContent = 'A sale price was imported. Confirm the promotion still applies to the exact variant you intend to buy.';
        } else if (data?.price != null) {
          status.dataset.priceState = 'good';
          status.textContent = `Details imported${provenance.price_confidence ? ` · ${provenance.price_confidence} price confidence` : ''}. Check the exact variant before scoring.`;
        } else {
          status.dataset.priceState = 'warning';
          status.textContent = 'We found the product but not a reliable cash price. Add the current cash price manually before scoring.';
        }
      } catch (error) {
        console.error('TruWorth importer', error);
        status.dataset.priceState = 'warning';
        status.textContent = 'We could not import that page. You can still complete the assessment manually.';
      } finally {
        button.disabled = false;
      }
    };
  }

  const improvementCopy = {
    'Affordability': 'A lower verified cash price, lower lifetime cost, or more monthly free cash would improve affordability.',
    'Utility': 'Stronger evidence that you will use it often or that it saves meaningful time would improve utility.',
    'Goal alignment': 'A clearer link to a real goal or problem would strengthen goal alignment.',
    'Lifestyle fit': 'A purchase that fits your actual routine with less setup or upkeep would improve lifestyle fit.',
    'Value': 'A lower price or more realistic lifetime uses would improve value-for-money.',
    'Satisfaction': 'Higher expected long-term enjoyment and lower likely remorse would improve satisfaction.',
    'Quality / longevity': 'Evidence of longer useful life, durability or repairability would strengthen quality and longevity.',
    'Purchase risk': 'Less impulse pressure, less status motivation, a cooling-off period or a stronger comparison with what you already own would reduce purchase risk.'
  };

  function injectChangeCard() {
    const mount = document.getElementById('twDecisionMount');
    const shell = mount?.querySelector('.tw-decision-shell');
    if (!shell || shell.querySelector('.tw-change-card')) return;
    const factors = [...shell.querySelectorAll('.tw-factor')].map((node) => ({
      label: node.querySelector('span')?.textContent?.trim() || '',
      value: Number((node.querySelector('strong')?.textContent || '').match(/\d+/)?.[0] || 0)
    })).filter((item) => item.label);
    if (!factors.length) return;
    const outcome = shell.querySelector('.tw-pill')?.textContent?.trim()?.toUpperCase() || '';
    const risk = factors.find((f) => f.label === 'Purchase risk');
    const positives = factors.filter((f) => f.label !== 'Purchase risk').sort((a,b) => a.value - b.value);
    const selected = [];
    if (risk && risk.value >= 55) selected.push(risk);
    for (const factor of positives) if (selected.length < 3) selected.push(factor);
    const items = selected.slice(0,3).map((factor) => `<li><strong>${esc(factor.label)} ${factor.value}/100:</strong> ${esc(improvementCopy[factor.label] || 'Change the underlying input and reassess.')}</li>`).join('');
    const card = document.createElement('section');
    card.className = 'tw-change-card';
    card.innerHTML = `<p class="kicker">What would change TruWorth’s mind?</p><h3>${outcome === 'BUY' ? 'These are the areas that could weaken this decision.' : 'These are the strongest levers in the current result.'}</h3><p>TruWorth is pointing to the inputs with the most room to move. Change the real-world facts, then reassess.</p><ul class="tw-change-list">${items}</ul><p class="tw-change-note">This is not a promise that one change will flip the result. The full decision is recalculated server-side using all factors and your Decision Discipline.</p>`;
    const note = shell.querySelector('.tw-server-note');
    (note || shell.lastElementChild)?.insertAdjacentElement('afterend', card);
  }

  function observeDecision() {
    const mount = document.getElementById('twDecisionMount');
    if (!mount || mount.dataset.twObserved === '1') { injectChangeCard(); return; }
    mount.dataset.twObserved = '1';
    new MutationObserver(injectChangeCard).observe(mount, { childList: true, subtree: true });
    injectChangeCard();
  }

  function enhance() {
    enhanceAccessibility();
    observeDecision();
  }

  addStyles();
  networkBanner(!navigator.onLine);
  window.addEventListener('offline', () => networkBanner(true));
  window.addEventListener('online', () => networkBanner(false));
  window.addEventListener('truworth:routed', enhance);
  setTimeout(() => { if (window.__TRUWORTH_ROUTED__) enhance(); }, 0);
})();
