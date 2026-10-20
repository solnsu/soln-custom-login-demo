# Soln Custom Login SDK · 自定义登录页接入

租户自行开发、托管登录页面和静态资源。账号密码、邮件验证码的校验、首次设置密码、控制面会话以及 Runtime 授权仍由 Soln 负责。SDK 不包含 UI，可以与任意前端框架一起使用。


完整示例仓库：[GitHub](https://github.com/solnsu/soln-custom-login-demo) · [GitCode](https://gitcode.com/lunaris_soln/soln-custom-login-demo)

本仓库包含独立可构建的 SDK、编译后的 `dist/`、完整登录页 `examples/` 和接入说明。默认仅有通用占位配置；不包含任何测试租户、实际服务器地址或部署凭据。代码沿用 `UNLICENSED` 声明。

直接部署时保留 `examples/` 与 `dist/` 的相对目录关系，访问 HTTPS 站点的 `/examples/`。先修改 `examples/config.js` 中的 `issuer`；需要直接访问发起登录时，填写可信工作区的 `workspaceLoginUrl`。完整改造清单见 [`examples/README.md`](examples/README.md)。

## 构建和交付

本包已提供源码，尚未发布到 npm。在本仓库根目录执行：

```sh
npm ci
npm run build
npm test
npm pack
```

租户可以安装交付的 `.tgz`，也可以将本包的 `dist/` 作为静态 ESM 文件自行托管。`examples/` 提供完整的原生 HTML 示例；修改 `examples/config.js` 中的可信控制面 `issuer`、品牌名称和语言后，将 `examples/` 和 `dist/` 按原目录关系部署到 HTTPS 站点。

示例已完整接入 SDK。各接入位置使用编号英文注释 `SOLN INTEGRATION 1–9` 标出，涵盖配置、初始化、表单绑定、验证码、密码登录、首次设置密码、会话衔接及错误状态；对应清单见 [`examples/README.md`](examples/README.md)。按这些位置将调用接入自己的 UI 即可，品牌和样式可独立修改。

浏览器标签页图标通过 `examples/config.js` 的 `faviconUrl` 配置，默认使用随包提供的 Soln 图标 `./assets/favicon-192x192.png`。可替换为自己的 SVG、PNG、ICO 相对路径或 HTTPS 图片地址，独立于页面内的 Logo。

示例采用左右分栏、彩色流线背景和白色登录表单，不包含第三方登录。背景 SVG 和样式均随示例交付，不依赖外部图片或字体。示例默认中文，右上角可即时切换中英文并在当前设备记住选择；`locale` 设置初始语言，未识别的语言使用英文。支持密码显隐、记住邮箱、邮件验证码和首次设置密码；需要人机验证时 SDK 自动打开 Soln 托管的验证弹层。“忘记密码”进入免密码的邮件验证码登录。“记住邮箱”仅保存邮箱，不改变 Soln 会话策略。

验证过程只显示服务商验证组件，不再额外套“安全验证”标题、说明或白色卡片。登录页的加载、成功、失败和取消反馈统一在顶部全局提示中显示，提示末尾不带句号；租户可替换为自己的全局消息组件。

本地查看设计：

```sh
python3 -m http.server 4176 --bind 127.0.0.1
# 打开 http://127.0.0.1:4176/examples/
```

`examples/config.js` 的 `workspaceLoginUrl` 默认是 `null`，直接打开页面时可预览布局和切换登录方式，不显示预览提示，也不会模拟登录成功。正式部署可以将它设为可信工作区的 HTTPS `/auth/start` 地址；直接访问自定义页时会自动经过 Runtime 创建登录事务，再回到此页面，无需先登录。需先在该工作区的组织资料中登记自定义页的 HTTPS 地址。

## 配置

在租户的“系统管理 → 组织资料”（`/system/organization`）中点击“编辑”，填写“自定义登录页地址”。留空使用 Soln 默认登录页。也可以通过 CLI：

```sh
sl system organization profile update --custom-login-page-url https://login.example.com/soln
sl system organization profile get --json
sl system organization profile update --use-default-login-page
```

更新要求组织资料编辑权限，并记录租户审计。地址作为登录配置保存在控制面现有租户设置的 `customLoginPageUrl` 字段中；租户页面内容和资源仍由租户自行托管。`customLoginPageUrl: null` 使用内置登录页。配置错误导致页面无法登录时，管理员可以从已有会话或已授权的 CLI 恢复默认配置。

登录页必须使用 HTTPS，URL 不含用户名、密码或 `#` 片段；可保留查询参数。页面可以部署在内网，控制面不会请求该地址，但使用者的浏览器必须能访问它与控制面。应填写最终页面地址，避免跨来源重定向。页面路由不可依赖 hash。

人机验证由 Soln 控制面统一托管，不需要先登录，也不需要租户配置 hCaptcha、注册自己的域名或传入服务商 token。控制面运维只需在 hCaptcha 配置中允许控制面 `issuer` 对应的域名。租户可以自行设计账号、密码、邮件验证码输入框；发送验证码、密码错误达到阈值时，SDK 自动打开托管验证弹层，完成后继续原请求。

验证页由控制面 API 的 `/api/auth/custom-login/captcha/frame` 返回，和 `issuer` 同源；部署时需让该路径进入控制面 API。该响应通过 CSP `frame-ancestors` 只允许当前事务配置的登录页来源嵌入，不应在网关为该路径添加 `X-Frame-Options: DENY/SAMEORIGIN`。如租户站点配置了 CSP，需要在 `frame-src` 中允许可信 `issuer`；无须允许 hCaptcha 域名，服务商组件仅在 Soln 验证页运行。两侧须部署同一版协议与 SDK。

## 使用 SDK

```ts
import { createSolnLoginClient, SolnLoginError } from '@soln/custom-login-sdk';

// issuer 由开发者写入可信配置，禁止读取 URL 中任意传入的 issuer。
const login = createSolnLoginClient({
  issuer: 'https://console.example.com',
  locale: 'zh-CN', // 默认 en
});
const context = await login.getContext();

// 登录页自己决定如何渲染 context.tenant.name、表单与错误。
// 若 context.passwordSetup 非空，应恢复到首次设置密码界面。
const result = await login.loginWithPassword({ email, password });
if (result.nextStep === 'complete') login.complete(result);

// 验证弹层与后续重试由 SDK 管理，页面无需处理 captchaToken。
await login.sendEmailCode({ email });
const verified = await login.verifyEmailCode({ email, code });
if (verified.nextStep === 'set_password') {
  // 页面展示新密码表单；设置票据仅留在控制面，不交给登录页。
  const completed = await login.setupPassword({ newPassword });
  login.complete(completed);
} else {
  login.complete(verified);
}
```

启用 hCaptcha 后，发送验证码必须通过验证；密码连续错误达到现有阈值（3 次）时，也必须先验证。接口返回 HTTP 428 和一次性挑战，SDK 自动打开托管验证页；控制面通过 hCaptcha 校验配置的 site key 和服务端密钥（hostname 仅用于统计，不作为认证依据），签发短期凭据，SDK 携带凭据重试原操作一次。密码仍然错误时返回凭据错误，不循环弹出验证。取消弹层会抛出 `name: 'AbortError'`，页面应结束加载，允许用户再次操作。

错误对象 `SolnLoginError` 含 `status`、`code`、`reason`、`domain` 与按 `locale` 翻译的 `message`。不要依赖 message 文本做分支。网络故障使用浏览器原生异常；过期或已用的事务需要从 Runtime 重新发起登录。

页面必须防止重复提交，并自行处理邮件重发倒计时；发送频率仍由服务端校验。密码和验证码不应保存到浏览器存储或日志。SDK 仅将短期事务 ID 保存在当前标签页的 sessionStorage，以支持刷新恢复。

## 协议 v1

1. 浏览器访问 Runtime。Runtime 创建原有 OAuth state/PKCE 事务，通过已认证的 Agent 通道请求控制面；控制面读取保存的登录页地址，配置非空时创建自定义登录事务，未配置时继续默认登录。
2. 浏览器进入控制面 `/oauth/authorize`。控制面核对租户、Runtime 注册、回调地址、state、PKCE，设置绑定此浏览器的 `HttpOnly; Secure; SameSite=Lax` Cookie，再跳转租户配置的页面。
3. 跳转格式为 `https://login.example.com/soln#soln_login_request=...`。事务有效期 10 分钟。SDK 读取事务 ID 后移除该片段；issuer 必须由页面开发者预先配置。
4. 页面直接向可信 issuer 的下列接口发请求。统一使用 `X-Soln-Login-Request: <事务ID>`、`Accept-Language`，POST 使用 JSON；`credentials: omit`，无需跨站 Cookie。租户身份取自服务端事务，禁止客户端传入或修改。
5. 认证成功返回 60 秒有效的单次完成地址。`login.complete()` 将浏览器顶层导航回控制面；控制面检查发起浏览器的 Cookie，原子消费事务，再校验会话并设置自己的登录 Cookie。
6. 控制面继续原 OAuth 授权，携带授权码回到 Runtime `/auth/callback`。Runtime 交换并验证授权码，建立本地会话。

| 方法 | 路径（相对于 issuer） | JSON 输入 | 结果 |
| --- | --- | --- | --- |
| GET | `/api/auth/custom-login/context` | 无 | 租户展示名、有效期、托管验证启用状态、待设置密码状态 |
| POST | `/api/auth/custom-login/password` | `email, password, captchaProof?` | `complete` 或 HTTP 428 验证挑战 |
| POST | `/api/auth/custom-login/send-code` | `email, captchaProof?` | `202 { success: true }` 或 HTTP 428 验证挑战 |
| POST | `/api/auth/custom-login/verify-code` | `email, code`（6 位数字） | `complete` 或 `set_password` |
| POST | `/api/auth/custom-login/setup-password` | `newPassword`（至少 8 字符） | `complete` |
| GET | `/api/auth/custom-login/complete?request=...&ticket=...` | 无；仅浏览器顶层导航 | 设置控制面 Cookie 并继续 OAuth |
| GET | `/api/auth/custom-login/captcha/frame?request=...&challenge=...&locale=...` | 无；仅 SDK 弹层加载 | Soln 域名下的验证文档，仅允许当前登录页来源嵌入 |
| POST | `/api/auth/custom-login/captcha/verify` | `challengeId, captchaToken`；仅托管验证页调用 | `{ proof }`；拒绝租户来源调用，不依赖登录 Cookie |

`context.captcha` 只提供 `{ enabled, mode: 'soln_hosted' }`，不向租户页面交付服务商配置。`captchaProof` 是 SDK 内部自动管理的字段，业务页面无需读取。挑战最长有效 3 分钟且不超过登录事务有效期，验证后的凭据最多有效 60 秒。挑战和凭据绑定登录事务、邮箱、操作类型，凭据由 Redis 锁保护并在执行操作前单次消费；即使密码错误或邮件发送失败也不能复用。验证弹层消息必须同时匹配 issuer 来源、iframe 窗口和挑战 ID；第三方 Cookie 被禁用不影响此验证协议。

接口使用严格输入 Schema，额外字段会被拒绝。实际数据接口只接受事务中配置的精确 Origin；预检允许列出的请求方法和头，不开放跨站凭据。每个事务限制 30 次提交并串行处理，验证码和密码错误校验继续使用原有服务端规则。长期会话令牌、refresh token 和密码设置票据不会返回给自定义页面。

控制面租户设置只保存登录页地址，Redis 只保留短期认证事务、验证状态及待完成结果，不保存自定义页面源码或素材。不记录这些地址的查询参数，完成地址里的 ticket 属于短期凭据。原始 hCaptcha token 只在 Soln 验证页与控制面之间传输，不返回给租户页面，也不写入 Redis。

本功能接管 Runtime 发起的普通浏览器登录；显式企业 SSO 入口保持其原有认证流程。控制面后台和平台操作员登录不受租户页面配置影响。此协议不授予租户自行签发 Soln 用户身份的能力。

## English integration notes

This is a UI-independent browser SDK for tenant-hosted login pages. Build and distribute the package or its ESM output; it has not been published to npm. Configure a trusted HTTPS control-plane issuer in your application, never from untrusted URL input. Edit Custom Login Page URL in System Management → Organization Profile (`/system/organization`), or use the CLI above. The control plane stores the URL as tenant login configuration; leave it empty to restore the default page. Tenant page content remains self-hosted.

The SDK reads a ten-minute transaction ID from the launch fragment, removes it from the address bar, and calls the documented JSON endpoints without cross-site cookies. All account identity and tenant selection are server-controlled. Passwords, email codes, captcha enforcement, and initial password setup reuse Soln authentication. A successful result contains a short-lived, single-use completion URL, not a session token. Navigate with `complete()` to bind the control-plane session in the original browser and continue OAuth back to the Runtime.

Use your own form components and display localized API errors. Human verification is hosted by Soln without requiring an authenticated session. Only the trusted issuer hostname must be allowed in hCaptcha. The SDK displays only the provider challenge in a transparent full-screen verification frame, without an extra Soln card or heading, then retries once using a short-lived, transaction/email/action-bound proof. The tenant page never loads the provider widget or handles its token. The verification endpoint validates the configured sitekey and server-side secret with hCaptcha. The provider-reported hostname is telemetry and is not used for authentication. Allow the issuer in the tenant site's `frame-src` policy; preserve the API response's precise `frame-ancestors` policy and do not add a conflicting X-Frame-Options header to the frame endpoint. Cancellation raises AbortError. Deploy matching API and SDK versions.

Configure the trusted issuer, brand name, and locale in `examples/config.js`. The responsive split-screen example includes local ribbon artwork, password visibility, optional email remembering, password and email-code flows, initial password setup, and automatic hosted verification with English fallback and Chinese strings. A direct visit previews the design; actual authentication requires a transaction launched from the Runtime. Remembering an email does not extend a session.
