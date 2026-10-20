export type CaptchaChallenge = {
    challengeId: string;
    frameUrl: string;
    expiresAt: string;
};
export declare function completeHostedCaptcha(challenge: CaptchaChallenge, input: {
    issuer: URL;
    requestId: string;
    locale?: string;
}): Promise<string>;
