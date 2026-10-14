(() => {
  const CONFIG = {
    enabled: false,
    client: '',
    slots: {
      home: '',
      result: '',
      library: ''
    }
  };

  const plusActive = () => {
    try {
      return subscription?.tier === 'plus' && ['active', 'trialing'].includes(String(subscription?.status || ''));
    } catch {
      return false;
    }
  };

  const pageName = () => document.body?.dataset?.page || '';
  const eligiblePage = () => ({ home: 'home', result: 'result', watchlist: 'library' }[pageName()] || null);

  function loadAdSense() {
    if (!CONFIG.enabled || !CONFIG.client || window.__TRUWORTH_AD_CONSENT__ !== true) return false;
    if (document.querySelector('script[data-truworth-adsense]')) return true;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.truworthAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CONFIG.client)}`;
    document.head.appendChild(script);
    return true;
  }

  function mountAd() {
    const placement = eligiblePage();
    if (!placement || plusActive() || !CONFIG.enabled || window.__TRUWORTH_AD_CONSENT__ !== true) return;
    const slotId = CONFIG.slots[placement];
    if (!slotId || document.querySelector(`[data-truworth-ad="${placement}"]`)) return;
    if (!loadAdSense()) return;

    const main = document.querySelector('.main-content');
    if (!main) return;
    const wrap = document.createElement('aside');
    wrap.className = 'tw-ad-wrap';
    wrap.dataset.truworthAd = placement;
    wrap.setAttribute('aria-label', 'Advertisement');
    wrap.innerHTML = `<span class="tw-ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.client}" data-ad-slot="${slotId}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    main.appendChild(wrap);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (error) { console.warn('Ad slot could not initialise', error); }
  }

  function removeAdsForPlus() {
    if (!plusActive()) return;
    document.querySelectorAll('[data-truworth-ad]').forEach((node) => node.remove());
  }

  function refresh() {
    removeAdsForPlus();
    mountAd();
  }

  window.TruWorthAds = Object.freeze({
    refresh,
    get enabled() { return CONFIG.enabled; },
    get plusIsAdFree() { return plusActive(); }
  });

  window.addEventListener('truworth:release-ready', refresh);
  window.addEventListener('truworth:subscription-updated', refresh);
})();
