(() => {
  const render = () => {
    if (document.body.dataset.page !== 'benefits' || typeof window.benefitsPage !== 'function') return;
    window.benefitsPage();
  };
  window.addEventListener('truworth:routed', render);
  if (window.__TRUWORTH_ROUTED__) render();
})();