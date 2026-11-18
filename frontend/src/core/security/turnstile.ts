/**
 * Cloudflare Turnstile (bot protection) for public, unauthenticated actions:
 * registration, complaint filing and the citizen AI tools. Active only when
 * VITE_TURNSTILE_SITE_KEY is set; the backend enforces it when
 * TURNSTILE_SECRET_KEY is set. Most visitors never see a challenge — the
 * widget only appears if Cloudflare needs an interaction.
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (idOrEl: string | HTMLElement) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Security check failed to load.')));
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Security check failed to load. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function turnstileEnabled(): boolean {
  return Boolean(SITE_KEY);
}

/** Resolves to a one-time token, or null when Turnstile is not configured. */
export async function getHumanToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  const api = await loadScript();
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.bottom = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);
    let widgetId = '';
    const cleanup = () => {
      try { if (widgetId) api.remove(widgetId); } catch { /* ignore */ }
      host.remove();
    };
    widgetId = api.render(host, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      execution: 'render',
      callback: (token: string) => { cleanup(); resolve(token); },
      'error-callback': () => { cleanup(); reject(new Error('The security check could not be completed. Please try again.')); },
      'timeout-callback': () => { cleanup(); reject(new Error('The security check timed out. Please try again.')); },
    });
  });
}

/** Headers to add to a public POST. */
export async function humanHeaders(): Promise<Record<string, string>> {
  const token = await getHumanToken();
  return token ? { 'cf-turnstile-response': token } : {};
}
