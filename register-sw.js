// Registers the service worker + forces fast updates (no manual cache clearing)
(() => {
  if (!('serviceWorker' in navigator)) return;

  const reloadOnce = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      // reload to pick the new cache/assets
      window.location.reload();
    };
  })();

  function sendSkipWaiting(reg) {
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      // Ask the browser to check for an update every visit
      if (reg && typeof reg.update === 'function') {
        try { await reg.update(); } catch (_) {}
      }

      // If there's already a waiting worker, activate it now
      sendSkipWaiting(reg);

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // When the new SW is installed, activate it immediately
          if (nw.state === 'installed') {
            sendSkipWaiting(reg);
          }
        });
      });

      // When the controller changes, the new SW is active
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        reloadOnce();
      });
    } catch (err) {
      console.warn('[SW] registration failed:', err);
    }
  });
})();
