export function runningInstalled(window, navigator) {
  return navigator.standalone === true || ['standalone', 'minimal-ui', 'window-controls-overlay'].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
}

export async function requestProtection(storage) {
  if (!storage?.persist) return 'unsupported';
  try { return await storage.persist() ? 'granted' : 'denied'; }
  catch { return 'error'; }
}
