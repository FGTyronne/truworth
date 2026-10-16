(() => {
  'use strict';

  function markFooterLinks() {
    document.querySelectorAll('.site-footer a[href]').forEach((link) => {
      link.dataset.twNativeFooterLink = '1';
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
    });
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.site-footer a[data-tw-native-footer-link="1"]');
    if (!link) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    // Footer links are ordinary navigation. Handle them in capture phase so
    // legacy delegated click handlers cannot swallow a normal left-click.
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(new URL(href, location.href).href);
  }, true);

  function settle() {
    markFooterLinks();
    [120, 560, 1320].forEach((delay) => setTimeout(markFooterLinks, delay));
  }

  window.addEventListener('truworth:routed', settle);
  window.addEventListener('truworth:release-ready', settle, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) settle();
})();