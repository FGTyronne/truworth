(() => {
  'use strict';

  if (window.__TRUWORTH_FOOTER_V35__) return;
  window.__TRUWORTH_FOOTER_V35__ = true;

  const FOOTER_HTML = [
    '<span class="tw-footer-note">TruWorth · Buy with your eyes open.</span>',
    '<nav class="tw-footer-v35-links" aria-label="Legal, privacy and support">',
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
    '<button type="button" data-tw-cookie-settings>Cookie settings</button>',
    '</nav>'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('tw-footer-v35-style')) return;
    const style = document.createElement('style');
    style.id = 'tw-footer-v35-style';
    style.textContent = `
      .tw-footer-v35{
        position:relative;z-index:40;
        width:min(1460px,calc(100% - 24px));
        margin:38px auto 18px;padding:14px 18px 16px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
        border:1px solid rgba(23,28,74,.08);border-radius:22px;
        background:rgba(255,255,255,.78);box-shadow:0 12px 34px rgba(31,38,80,.06);
        backdrop-filter:blur(12px);pointer-events:auto;
      }
      .tw-footer-v35 .tw-footer-note{display:block;margin:0;text-align:center;color:#787b89;font-size:12px;line-height:1.3}
      .tw-footer-v35-links{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:center;gap:0 18px;width:100%;min-width:0}
      .tw-footer-v35-links a,.tw-footer-v35-links button{
        flex:0 0 auto;width:auto;min-width:0;min-height:30px;margin:0;padding:0;
        display:inline-flex;align-items:center;justify-content:center;
        white-space:nowrap;writing-mode:horizontal-tb;text-orientation:mixed;
        color:#2c345f;font:700 13px/1.2 inherit;text-decoration:none;
        border:0;background:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;
      }
      .tw-footer-v35-links a:hover,.tw-footer-v35-links button:hover{color:#158b71;text-decoration:underline;text-underline-offset:3px}
      .tw-footer-v35-links a:focus-visible,.tw-footer-v35-links button:focus-visible{outline:3px solid rgba(96,107,235,.28);outline-offset:3px;border-radius:6px}
      @media(max-width:1180px){.tw-footer-v35-links{flex-wrap:wrap;row-gap:5px;column-gap:18px}}
      @media(max-width:760px){
        .tw-footer-v35{width:calc(100% - 18px);margin:26px auto 92px;padding:14px 12px 16px;border-radius:18px}
        .tw-footer-v35-links{flex-wrap:wrap;row-gap:4px;column-gap:14px}
        .tw-footer-v35-links a,.tw-footer-v35-links button{font-size:12px;min-height:30px}
      }
    `;
    document.head.appendChild(style);
  }

  function adoptFooter() {
    ensureStyle();

    let footer = document.querySelector('.tw-footer-v35');
    const legacy = document.querySelector('.site-footer');

    if (legacy) {
      legacy.classList.remove('site-footer');
      legacy.classList.add('tw-footer-v35');
      footer = legacy;
    }

    if (!footer) {
      const shell = document.querySelector('.app-shell');
      if (!shell) return;
      footer = document.createElement('footer');
      footer.className = 'tw-footer-v35';
      shell.appendChild(footer);
    }

    if (footer.dataset.twFooterV35 !== '1' || footer.innerHTML !== FOOTER_HTML) {
      footer.innerHTML = FOOTER_HTML;
      footer.dataset.twFooterV35 = '1';
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.tw-footer-v35 a[href]');
    if (!link) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = new URL(href, window.location.href).href;
  }, true);

  function settle() {
    adoptFooter();
    [80, 240, 620, 1400, 2800].forEach((delay) => setTimeout(adoptFooter, delay));
  }

  window.addEventListener('truworth:routed', settle);
  window.addEventListener('truworth:release-ready', settle, { once: true });
  document.addEventListener('DOMContentLoaded', settle, { once: true });
  if (document.readyState !== 'loading') settle();
  if (window.__TRUWORTH_RELEASE_READY__) settle();
})();
