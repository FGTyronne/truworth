(() => {
  const mobileHelp = () => window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)').matches;
  let lastTrigger = null;

  function closeHelp() {
    const layer = document.getElementById('mobileHelpLayer');
    if (!layer) return;
    layer.remove();
    document.body.classList.remove('mobile-help-open');
    if (lastTrigger && document.contains(lastTrigger)) {
      try { lastTrigger.focus({ preventScroll: true }); } catch {}
    }
    lastTrigger = null;
  }

  function openHelp(trigger) {
    if (!mobileHelp()) return;
    const tooltip = trigger.querySelector('.help-tooltip');
    const text = (tooltip?.textContent || trigger.getAttribute('aria-label') || '').trim();
    if (!text) return;
    closeHelp();
    lastTrigger = trigger;
    try { trigger.blur(); } catch {}

    const layer = document.createElement('div');
    layer.id = 'mobileHelpLayer';
    layer.className = 'mobile-help-layer';
    layer.innerHTML = `
      <button class="mobile-help-backdrop" type="button" aria-label="Close explanation"></button>
      <section class="mobile-help-sheet" role="dialog" aria-modal="true" aria-labelledby="mobileHelpTitle">
        <div class="mobile-help-handle" aria-hidden="true"></div>
        <div class="mobile-help-head">
          <div><span class="mobile-help-star" aria-hidden="true">*</span><strong id="mobileHelpTitle">What this means</strong></div>
          <button class="mobile-help-close" type="button" aria-label="Close explanation">×</button>
        </div>
        <p>${String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</p>
        <button class="primary-button mobile-help-done" type="button">Got it</button>
      </section>`;
    document.body.appendChild(layer);
    document.body.classList.add('mobile-help-open');
    layer.querySelector('.mobile-help-backdrop')?.addEventListener('click', closeHelp);
    layer.querySelector('.mobile-help-close')?.addEventListener('click', closeHelp);
    layer.querySelector('.mobile-help-done')?.addEventListener('click', closeHelp);
    setTimeout(() => layer.querySelector('.mobile-help-close')?.focus({ preventScroll: true }), 0);
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('.help-wrap');
    if (!trigger || !mobileHelp()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openHelp(trigger);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('mobileHelpLayer')) closeHelp();
    if ((event.key === 'Enter' || event.key === ' ') && mobileHelp() && event.target.closest?.('.help-wrap')) {
      event.preventDefault();
      openHelp(event.target.closest('.help-wrap'));
    }
  }, true);
})();
