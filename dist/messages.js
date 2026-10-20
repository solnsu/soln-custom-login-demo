export const sdkMessages = {
    en: {
        verification: 'Security verification',
        cancelled: 'Verification cancelled', expired: 'Verification expired, please try again',
        rejected: 'Verification failed, please try again',
        unavailable: 'Unable to load verification, please try again', busy: 'A sign-in request is already in progress',
    },
    'zh-CN': {
        verification: '安全验证',
        cancelled: '已取消验证', expired: '验证已过期，请重试',
        rejected: '验证未通过，请重试',
        unavailable: '无法加载验证，请重试', busy: '登录请求正在处理中',
    },
};
export function getSdkMessages(locale) {
    return sdkMessages[locale] || sdkMessages.en;
}
