/** Registers the service worker in production builds only (keeps dev/HMR and tests untouched). */
export function registerSW(env: { PROD: boolean } = import.meta.env, nav: Navigator = navigator): boolean {
  if (!env.PROD || !('serviceWorker' in nav)) return false;
  window.addEventListener('load', () => {
    nav.serviceWorker.register('/sw.js').catch(() => { /* offline support is best-effort */ });
  });
  return true;
}
