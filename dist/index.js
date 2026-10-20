import { completeHostedCaptcha } from './hosted-captcha.js';
import { getSdkMessages } from './messages.js';
export class SolnLoginError extends Error {
    status;
    code;
    reason;
    domain;
    challenge;
    constructor(message, status, code, reason, domain, challenge) {
        super(message);
        this.status = status;
        this.code = code;
        this.reason = reason;
        this.domain = domain;
        this.challenge = challenge;
        this.name = 'SolnLoginError';
    }
}
export function createSolnLoginClient(options) {
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
    if (typeof sessionStorage !== 'undefined')
        sessionStorage.setItem(storageKey, requestId);
    if (location && fragment.has('soln_login_request')) {
        fragment.delete('soln_login_request');
        const hash = fragment.toString();
        window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`);
    }
    const request = options.fetch || globalThis.fetch;
    let verificationPending = false;
    async function call(action, body) {
        const response = await request(new URL(`/api/auth/custom-login/${action}`, issuer), {
            method: body === undefined ? 'GET' : 'POST',
            credentials: 'omit', cache: 'no-store', redirect: 'error',
            signal: AbortSignal.timeout(20_000),
            headers: {
                'x-soln-login-request': requestId,
                'accept-language': options.locale || 'en',
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new SolnLoginError(payload.message || response.statusText, response.status, payload.code || '', payload.reason || '', payload.domain || '', payload.challenge);
        }
        return payload;
    }
    async function protectedCall(action, input) {
        if (verificationPending)
            throw new Error(getSdkMessages(options.locale).busy);
        verificationPending = true;
        try {
            try {
                return await call(action, input);
            }
            catch (error) {
                if (!(error instanceof SolnLoginError) || error.status !== 428 || !error.challenge)
                    throw error;
                const captchaProof = await completeHostedCaptcha(error.challenge, { issuer, requestId: requestId, locale: options.locale });
                // Retry once. Another failed password attempt must not open an endless verification loop.
                return await call(action, { ...input, captchaProof });
            }
        }
        finally {
            verificationPending = false;
        }
    }
    return {
        getContext: () => call('context'),
        loginWithPassword: (input) => protectedCall('password', input),
        sendEmailCode: (input) => protectedCall('send-code', input),
        verifyEmailCode: (input) => call('verify-code', input),
        setupPassword: (input) => call('setup-password', input),
        complete(result) {
            if (result.nextStep !== 'complete')
                throw new Error('CUSTOM_LOGIN_PASSWORD_SETUP_REQUIRED');
            const target = new URL(result.completionUrl);
            if (target.origin !== issuer.origin || target.pathname !== '/api/auth/custom-login/complete' ||
                target.username || target.password || target.hash || target.searchParams.get('request') !== requestId ||
                !/^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get('ticket') || '')) {
                throw new Error('CUSTOM_LOGIN_COMPLETION_URL_INVALID');
            }
            if (!location)
                throw new Error('CUSTOM_LOGIN_BROWSER_REQUIRED');
            if (typeof sessionStorage !== 'undefined')
                sessionStorage.removeItem(storageKey);
            location.assign(target.toString());
        },
    };
}
