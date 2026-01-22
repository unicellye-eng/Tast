// Registers the service worker that forces fresh fetches for key assets.
(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch((err) => console.warn('[SW] registration failed:', err));
  });
})();
