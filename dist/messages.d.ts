export declare const sdkMessages: {
    en: {
        verification: string;
        cancelled: string;
        expired: string;
        rejected: string;
        unavailable: string;
        busy: string;
    };
    'zh-CN': {
        verification: string;
        cancelled: string;
        expired: string;
        rejected: string;
        unavailable: string;
        busy: string;
    };
};
export declare function getSdkMessages(locale?: string): {
    verification: string;
    cancelled: string;
    expired: string;
    rejected: string;
    unavailable: string;
    busy: string;
} | {
    verification: string;
    cancelled: string;
    expired: string;
    rejected: string;
    unavailable: string;
    busy: string;
};
