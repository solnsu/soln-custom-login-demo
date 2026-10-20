import { getSdkMessages } from './messages.js';

export type CaptchaChallenge = { challengeId: string; frameUrl: string; expiresAt: string };

export function completeHostedCaptcha(challenge: CaptchaChallenge, input: {
  issuer: URL; requestId: string; locale?: string;
}): Promise<string> {
  const t = getSdkMessages(input.locale);
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error(t.unavailable));
  const url = new URL(challenge.frameUrl);
  const remaining = Date.parse(challenge.expiresAt) - Date.now();
  if (url.origin !== input.issuer.origin || url.pathname !== '/api/auth/custom-login/captcha/frame' ||
      url.username || url.password || url.hash || !/^[A-Za-z0-9_-]{43}$/.test(challenge.challengeId) ||
      url.searchParams.get('request') !== input.requestId || url.searchParams.get('challenge') !== challenge.challengeId ||
      !Number.isFinite(remaining) || remaining <= 0) {
    return Promise.reject(new Error('CUSTOM_LOGIN_CAPTCHA_CHALLENGE_INVALID'));
  }
  return new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', t.verification);
    // The trusted iframe owns the provider widget. Keep its host transparent so
    // users see only the provider challenge, without a second card or heading.
    dialog.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;box-shadow:none;overflow:hidden;';
    const style = document.createElement('style');
    style.textContent = 'dialog[data-soln-verification]::backdrop{background:transparent}';
    dialog.dataset.solnVerification = '';
    const frame = document.createElement('iframe');
    frame.src = url.toString(); frame.title = t.verification; frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:transparent;';
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    function finish(error?: Error, proof?: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      if (dialog.open) dialog.close();
      dialog.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      if (error) reject(error); else resolve(proof!);
    }
    const cancel = () => finish(new DOMException(t.cancelled, 'AbortError'));
    function receive(event: MessageEvent) {
      if (event.origin !== input.issuer.origin || event.source !== frame.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object' || !('challengeId' in data) || data.challengeId !== challenge.challengeId || !('type' in data)) return;
      if (data.type === 'soln:captcha:cancel') cancel();
      if (data.type === 'soln:captcha:error') {
        const errors: Record<string, string> = { expired: t.expired, rejected: t.rejected };
        finish(new Error('reason' in data && typeof data.reason === 'string'
          && Object.hasOwn(errors, data.reason) ? errors[data.reason] : t.unavailable));
      }
      if (data.type === 'soln:captcha:complete' && 'proof' in data && typeof data.proof === 'string' && /^[A-Za-z0-9_-]{43}$/.test(data.proof)) {
        finish(undefined, data.proof);
      }
    }
    dialog.append(style, frame);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', cancel);
    frame.onerror = () => finish(new Error(t.unavailable));
    window.addEventListener('message', receive);
    timer = setTimeout(() => finish(new Error(t.expired)), Math.min(remaining, 180_000));
    document.body.append(dialog);
    try { dialog.showModal(); frame.focus(); } catch { finish(new Error(t.unavailable)); }
  });
}
