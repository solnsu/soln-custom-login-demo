import { completeHostedCaptcha, type CaptchaChallenge } from './hosted-captcha.js';
import { getSdkMessages } from './messages.js';

export type LoginContext = {
  protocolVersion: 1;
  tenant: { name: string };
  expiresAt: string;
  captcha: { enabled: boolean; mode: 'soln_hosted' };
  methods: ['password', 'email_code'];
  passwordSetup: { email: string; expiresAt: string } | null;
};
export type LoginResult =
  | { nextStep: 'complete'; completionUrl: string }
  | { nextStep: 'set_password'; email: string; expiresAt: string };

export class SolnLoginError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly reason: string,
    public readonly domain: string,
    public readonly challenge?: CaptchaChallenge,
  ) { super(message); this.name = 'SolnLoginError'; }
}

type Options = {
  /** Trusted issuer configured by the page owner. Never read it from URL parameters. */
  issuer: string;
  locale?: string;
  /** Required outside a browser; normally read from the launch URL fragment. */
  requestId?: string;
  fetch?: typeof globalThis.fetch;
};

export function createSolnLoginClient(options: Options) {
  const issuer = new URL(options.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password ||
    issuer.pathname !== '/' || issuer.search || issuer.hash) {
    throw new Error('CUSTOM_LOGIN_ISSUER_INVALID');
  }
  const location = typeof window === 'undefined' ? null : window.location;
  const fragment = new URLSearchParams(location?.hash.slice(1) || '');
  const storageKey = `soln-custom-login:${issuer.origin}${location?.pathname || ''}`;
  const requestId = options.requestId || fragment.get('soln_login_request') ||
    (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey));
  if (!requestId || !/^[A-Za-z0-9_-]{43}$/.test(requestId)) {
    throw new Error('CUSTOM_LOGIN_REQUEST_INVALID');
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey, requestId);
  if (location && fragment.has('soln_login_request')) {
    fragment.delete('soln_login_request');
    const hash = fragment.toString();
    window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`);
  }
  const request = options.fetch || globalThis.fetch;
  let verificationPending = false;
  async function call<T>(action: string, body?: unknown): Promise<T> {
    const response = await request(new URL(`/api/auth/custom-login/${action}`, issuer), {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'x-soln-login-request': requestId!,
        'accept-language': options.locale || 'en',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new SolnLoginError(payload.message || response.statusText, response.status,
        payload.code || '', payload.reason || '', payload.domain || '', payload.challenge);
    }
    return payload as T;
  }
  async function protectedCall<T>(action: 'password' | 'send-code', input: { email: string; password?: string }): Promise<T> {
    if (verificationPending) throw new Error(getSdkMessages(options.locale).busy);
    verificationPending = true;
    try {
      try { return await call<T>(action, input); }
      catch (error) {
        if (!(error instanceof SolnLoginError) || error.status !== 428 || !error.challenge) throw error;
        const captchaProof = await completeHostedCaptcha(error.challenge, { issuer, requestId: requestId!, locale: options.locale });
        // Retry once. Another failed password attempt must not open an endless verification loop.
        return await call<T>(action, { ...input, captchaProof });
      }
    } finally { verificationPending = false; }
  }
  return {
    getContext: () => call<LoginContext>('context'),
    loginWithPassword: (input: { email: string; password: string }) => protectedCall<LoginResult>('password', input),
    sendEmailCode: (input: { email: string }) => protectedCall<{ success: true }>('send-code', input),
    verifyEmailCode: (input: { email: string; code: string }) => call<LoginResult>('verify-code', input),
    setupPassword: (input: { newPassword: string }) => call<LoginResult>('setup-password', input),
    complete(result: LoginResult) {
      if (result.nextStep !== 'complete') throw new Error('CUSTOM_LOGIN_PASSWORD_SETUP_REQUIRED');
      const target = new URL(result.completionUrl);
      if (target.origin !== issuer.origin || target.pathname !== '/api/auth/custom-login/complete' ||
        target.username || target.password || target.hash || target.searchParams.get('request') !== requestId ||
        !/^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get('ticket') || '')) {
        throw new Error('CUSTOM_LOGIN_COMPLETION_URL_INVALID');
      }
      if (!location) throw new Error('CUSTOM_LOGIN_BROWSER_REQUIRED');
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey);
      location.assign(target.toString());
    },
  };
}
