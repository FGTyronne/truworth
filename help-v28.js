(() => {
  'use strict';

  const desktop = () => window.matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)').matches;
  let lastTrigger = null;

  function escHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function addStyles() {
    if (document.getElementById('helpV28Styles')) return;
    const style = document.createElement('style');
    style.id = 'helpV28Styles';
    style.textContent = `
      @media (min-width:701px){
        .tw17 .help-tooltip{display:none!important;visibility:hidden!important;opacity:0!important;transform:none!important}
        .tw17 .help-wrap{cursor:pointer;outline:none!important;margin-left:4px;transform:none!important;vertical-align:middle}
        .tw17 .help-wrap .help-star{width:22px!important;height:22px!important;min-width:22px!important;display:inline-grid!important;place-items:center!important;border-radius:50%!important;font-size:13px!important;font-weight:900!important;line-height:1!important;transform:none!important}
        .tw17 .help-wrap:focus-visible .help-star{box-shadow:0 0 0 3px rgba(16,27,77,.18)!important}
      }
      .tw28-help-layer{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:24px}
      .tw28-help-backdrop{position:absolute;inset:0;border:0;background:rgba(16,27,77,.28);backdrop-filter:blur(2px);cursor:default}
      .tw28-help-card{position:relative;width:min(430px,calc(100vw - 40px));background:#fff;border:1px solid rgba(16,27,77,.12);border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(16,27,77,.22)}
      .tw28-help-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:12px}
      .tw28-help-title{display:flex;align-items:center;gap:10px;color:#101b4d;font-weight:850;font-size:1rem}
      .tw28-help-icon{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#f2b35f;color:#101b4d;font-weight:900}
      .tw28-help-close{width:34px;height:34px;border:0;border-radius:50%;background:#f2f4f7;color:#101b4d;font-size:20px;line-height:1;cursor:pointer}
      .tw28-help-card p{margin:0;color:#596174;font-size:.94rem;line-height:1.58}
      .tw28-help-actions{display:flex;justify-content:flex-end;margin-top:18px}
      .tw28-help-done{min-height:42px!important}
      .tw17.tw-page-assess .range-row{gap:18px!important}
      .tw17.tw-page-assess .range-row input[type=range]{
        --tw-range-pct:44.444%;
        -webkit-appearance:none!important;
        appearance:none!important;
        height:8px!important;
        min-height:8px!important;
        padding:0!important;
        border:0!important;
        border-radius:999px!important;
        outline:none!important;
        background:linear-gradient(90deg,#67cfa8 0 var(--tw-range-pct),#d9dde5 var(--tw-range-pct) 100%)!important;
        box-shadow:none!important;
      }
      .tw17.tw-page-assess .range-row input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:999px;background:transparent}
      .tw17.tw-page-assess .range-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-7px;border-radius:50%;background:#101b4d;border:4px solid #fff;box-shadow:0 1px 5px rgba(16,27,77,.28);cursor:pointer}
      .tw17.tw-page-assess .range-row input[type=range]::-moz-range-track{height:8px;border-radius:999px;background:#d9dde5}
      .tw17.tw-page-assess .range-row input[type=range]::-moz-range-progress{height:8px;border-radius:999px;background:#67cfa8}
      .tw17.tw-page-assess .range-row input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#101b4d;border:4px solid #fff;box-shadow:0 1px 5px rgba(16,27,77,.28);cursor:pointer}
      .tw17.tw-page-assess .range-row output{min-width:64px!important;text-align:right!important;font-size:1rem!important;font-weight:850!important;color:#4aa47f!important}
    `;
    document.head.appendChild(style);
  }

  function closeHelp(restoreFocus = true) {
    document.getElementById('tw28HelpLayer')?.remove();
    document.body.classList.remove('tw28-help-open');
    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) {
      try { lastTrigger.focus({ preventScroll: true }); } catch {}
    }
    lastTrigger = null;
  }

  function openHelp(trigger) {
    if (!desktop()) return;
    const tooltip = trigger.querySelector('.help-tooltip');
    const text = (tooltip?.textContent || trigger.getAttribute('aria-label') || '').trim();
    if (!text) return;
    closeHelp(false);
    lastTrigger = trigger;

    const layer = document.createElement('div');
    layer.id = 'tw28HelpLayer';
    layer.className = 'tw28-help-layer';
    layer.innerHTML = `
      <button class="tw28-help-backdrop" type="button" aria-label="Close help"></button>
      <section class="tw28-help-card" role="dialog" aria-modal="true" aria-labelledby="tw28HelpTitle">
        <div class="tw28-help-head">
          <div class="tw28-help-title"><span class="tw28-help-icon" aria-hidden="true">*</span><strong id="tw28HelpTitle">What this means</strong></div>
          <button class="tw28-help-close" type="button" aria-label="Close help">×</button>
        </div>
        <p>${escHtml(text)}</p>
        <div class="tw28-help-actions"><button class="primary-button tw28-help-done" type="button">Got it</button></div>
      </section>`;
    document.body.appendChild(layer);
    document.body.classList.add('tw28-help-open');
    layer.querySelector('.tw28-help-backdrop')?.addEventListener('click', () => closeHelp());
    layer.querySelector('.tw28-help-close')?.addEventListener('click', () => closeHelp());
    layer.querySelector('.tw28-help-done')?.addEventListener('click', () => closeHelp());
    setTimeout(() => layer.querySelector('.tw28-help-close')?.focus({ preventScroll: true }), 0);
  }

  function syncRange(input) {
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || min);
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--tw-range-pct', `${Math.max(0, Math.min(100, pct))}%`);
  }

  function enhanceAssessment() {
    const joy = document.getElementById('joy');
    if (joy && !joy.dataset.tw28Range) {
      joy.dataset.tw28Range = '1';
      syncRange(joy);
      joy.addEventListener('input', () => syncRange(joy));
      joy.addEventListener('change', () => syncRange(joy));
    }
  }

  document.addEventListener('click', (event) => {
    if (!desktop()) return;
    const trigger = event.target.closest?.('.help-wrap');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openHelp(trigger);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('tw28HelpLayer')) {
      event.preventDefault();
      closeHelp();
      return;
    }
    if (!desktop() || !['Enter',' '].includes(event.key)) return;
    const trigger = event.target.closest?.('.help-wrap');
    if (!trigger) return;
    event.preventDefault();
    openHelp(trigger);
  }, true);

  window.addEventListener('truworth:routed', enhanceAssessment);
  window.addEventListener('truworth:release-ready', enhanceAssessment);
  addStyles();
  enhanceAssessment();
})();
