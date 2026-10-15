(() => {
  'use strict';

  const footerMarkup = () => [
    '<a href="/privacy.html">Privacy</a>',
    '<a href="/terms.html">Terms</a>',
    '<button class="tw-footer-nav" type="button" data-tw-footer-href="/cookies.html">Cookies</button>',
    '<button class="tw-footer-nav" type="button" data-tw-footer-href="/security.html">Security</button>',
    '<a href="/decision-support.html">How TruWorth works</a>',
    '<button class="tw-footer-nav" type="button" data-tw-footer-href="/member-benefits.html">Member Benefits</button>',
    '<button class="tw-footer-nav" type="button" data-tw-footer-href="/partner-with-truworth.html">Partner with us</button>',
    '<a href="/commercial-disclosure.html">Commercial disclosure</a>',
    '<a href="/plans.html">Membership</a>',
    '<a href="/settings.html">Settings</a>',
    '<button class="tw-cookie-link" type="button" data-tw-cookie-settings>Cookie settings</button>'
  ].join('');

  function addStyles() {
    if (document.getElementById('navigationV29Styles')) return;
    const style = document.createElement('style');
    style.id = 'navigationV29Styles';
    style.textContent = `
      .bottom-nav{z-index:10020!important;pointer-events:auto!important}
      .bottom-nav a{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:1!important}
      .site-footer{position:relative!important;z-index:50!important;pointer-events:auto!important}
      .site-footer a,.site-footer button{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:2!important}
      .tw-footer-nav{border:0;background:none;padding:0;color:inherit;font:inherit;text-decoration:none;cursor:pointer}
      .tw-footer-nav:hover,.site-footer a:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  function stableFooter() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    const anchors = [...footer.querySelectorAll('a')];
    const anchorHrefs = anchors.map((a) => a.getAttribute('href'));
    const baseStable = anchorHrefs.some((x) => /privacy\.html$/.test(x || ''))
      && anchorHrefs.some((x) => /terms\.html$/.test(x || ''))
      && anchorHrefs.some((x) => /decision-support\.html$/.test(x || ''))
      && anchorHrefs.some((x) => /commercial-disclosure\.html$/.test(x || ''))
      && anchorHrefs.some((x) => /plans\.html$/.test(x || ''))
      && anchorHrefs.some((x) => /settings\.html$/.test(x || ''));

    const hasExtras = footer.querySelector('[data-tw-footer-href="/cookies.html"]')
      && footer.querySelector('[data-tw-footer-href="/security.html"]')
      && footer.querySelector('[data-tw-footer-href="/member-benefits.html"]')
      && footer.querySelector('[data-tw-footer-href="/partner-with-truworth.html"]')
      && footer.querySelector('[data-tw-cookie-settings]');

    if (!baseStable || !hasExtras || footer.dataset.footerVersion !== 'tw29b') {
      footer.innerHTML = footerMarkup();
      footer.dataset.footerVersion = 'tw29b';
    }
  }

  function sameOriginNavigate(href) {
    if (!href) return;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    location.assign(url.href);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented && !event.target.closest?.('.bottom-nav,.site-footer')) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const footerButton = event.target.closest?.('[data-tw-footer-href]');
    if (footerButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sameOriginNavigate(footerButton.getAttribute('data-tw-footer-href'));
      return;
    }

    const link = event.target.closest?.('.bottom-nav a, .site-footer a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sameOriginNavigate(href);
  }, true);

  function apply() {
    addStyles();
    stableFooter();
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      stableFooter();
    });
  });

  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else window.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });

  window.addEventListener('truworth:routed', apply);
  window.addEventListener('truworth:release-ready', apply);
  apply();
})();
