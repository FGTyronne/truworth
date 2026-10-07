(() => {
  const originalInitBackend = initBackend;
  let releaseReadyResolver = null;

  function waitForRelease() {
    if (window.__TRUWORTH_RELEASE_READY__) return Promise.resolve();
    return new Promise((resolve) => {
      releaseReadyResolver = resolve;
      window.addEventListener('truworth:release-ready', resolve, { once: true });
    });
  }

  window.addEventListener('truworth:release-ready', () => releaseReadyResolver?.(), { once: true });

  initBackend = async function auditedInitBackend() {
    await waitForRelease();
    await originalInitBackend();

    try {
      const pending = Array.isArray(local?.records) ? local.records.length : 0;
      if (user && pending && typeof syncGuestRecords === 'function') {
        const lastAttempt = Number(sessionStorage.getItem('truworth_guest_sync_attempt') || 0);
        if (!lastAttempt || Date.now() - lastAttempt > 5 * 60 * 1000) {
          sessionStorage.setItem('truworth_guest_sync_attempt', String(Date.now()));
          await syncGuestRecords();
          await loadCloudData();
        }
      }
    } catch (error) {
      console.warn('Guest history sync deferred', error);
    } finally {
      window.__TRUWORTH_DATA_READY__ = true;
      window.dispatchEvent(new CustomEvent('truworth:data-ready'));
    }
  };
})();