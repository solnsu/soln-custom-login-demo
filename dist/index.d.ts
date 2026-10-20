import { type CaptchaChallenge } from './hosted-captcha.js';
export type LoginContext = {
    protocolVersion: 1;
    tenant: {
        name: string;
    };
    expiresAt: string;
    captcha: {
        enabled: boolean;
        mode: 'soln_hosted';
    };
    methods: ['password', 'email_code'];
    passwordSetup: {
        email: string;
        expiresAt: string;
    } | null;
};
export type LoginResult = {
    nextStep: 'complete';
    completionUrl: string;
} | {
    nextStep: 'set_password';
    email: string;
    expiresAt: string;
};
export declare class SolnLoginError extends Error {
    readonly status: number;
    readonly code: string;
    readonly reason: string;
    readonly domain: string;
    readonly challenge?: CaptchaChallenge | undefined;
    constructor(message: string, status: number, code: string, reason: string, domain: string, challenge?: CaptchaChallenge | undefined);
}
type Options = {
    /** Trusted issuer configured by the page owner. Never read it from URL parameters. */
    issuer: string;
    locale?: string;
    /** Required outside a browser; normally read from the launch URL fragment. */
    requestId?: string;
    fetch?: typeof globalThis.fetch;
};
export declare function createSolnLoginClient(options: Options): {
    getContext: () => Promise<LoginContext>;
    loginWithPassword: (input: {
        email: string;
        password: string;
    }) => Promise<LoginResult>;
    sendEmailCode: (input: {
        email: string;
    }) => Promise<{
        success: true;
    }>;
    verifyEmailCode: (input: {
        email: string;
        code: string;
    }) => Promise<LoginResult>;
    setupPassword: (input: {
        newPassword: string;
    }) => Promise<LoginResult>;
    complete(result: LoginResult): void;
};
export {};
