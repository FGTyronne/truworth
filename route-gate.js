(() => {
  const originalRoute = route;
  let rendered = false;

  route = function auditedRoute() {
    if (!window.__TRUWORTH_RELEASE_READY__ || !window.__TRUWORTH_DATA_READY__) return;
    if (rendered) return;
    rendered = true;
    originalRoute();
    window.__TRUWORTH_ROUTED__ = true;
    window.dispatchEvent(new CustomEvent('truworth:routed'));
  };
})();