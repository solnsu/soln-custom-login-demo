# Adapt an existing login page to Soln

This demo already implements the complete SDK integration. The numbered English
`SOLN INTEGRATION` comments identify the code to add when adapting your own page.
Keep the working logic and replace the presentation with your own components.

For your own frontend project, install the SDK:

```sh
npm i @soln/custom-login-sdk
```

The static demo already includes the compiled SDK in `dist/`. Deploy `examples/`
and `dist/` together without changing their relative paths.

| Step | Location | What to configure or carry into your page |
| --- | --- | --- |
| 1 | `config.js` | Set the trusted HTTPS control-plane `issuer`. Deploy your page over HTTPS and register its final URL in `/system/organization` → Custom Login Page URL. Set `workspaceLoginUrl` to your Runtime's HTTPS `/auth/start` URL if users will open the custom page directly. |
| 2 | `login.js` import; `index.html` module tag | Import the SDK and load your integration module once. Static deployments must include `dist/` at the relative path used here; bundler projects can import `@soln/custom-login-sdk` after running `npm i @soln/custom-login-sdk`. |
| 3 | `login.js`, `createSolnLoginClient()` | Create one client before other code changes the launch fragment. The SDK manages the supplied transaction ID. |
| 4 | `login.js`, `getContext()` | Validate the transaction and restore required password setup before enabling the form. |
| 5 | `index.html` fields; `login.js` selectors and `setMode()` | Bind your component values for email, password, email code, and new password. Preserve the three form modes and equivalent field validation. |
| 6 | `login.js`, send-code handler | Call `sendEmailCode({ email })`; provide loading, sent/error feedback, and a resend countdown. |
| 7 | `login.js`, form submit handler | Call `loginWithPassword()`, `verifyEmailCode()`, or `setupPassword()` for the current mode. |
| 8 | `login.js`, result handling | Show password setup for `set_password`; call `complete(result)` for `complete`. Soln establishes the session and returns the browser to Runtime. |
| 9 | `login.js` UI helpers; `index.html` global notifications | Prevent duplicate submissions, display feedback in global toasts without trailing periods, and release loading state after errors or verification cancellation. |

Human verification is already integrated: the SDK opens Soln-hosted verification
when needed. Your page does not configure hCaptcha, register a provider domain,
or handle provider tokens. Deploy the matching Soln control-plane API version.
If your hosting platform sets CSP, allow the trusted issuer in `connect-src` and
`frame-src`.

Only the provider's challenge is visible during verification; there is no extra Soln
verification card or heading. Loading, success, error, and cancellation feedback use
the demo's global toast area, which you can replace with your application's notifier.

For branding, edit the SVG in `index.html`, `brandName` and `faviconUrl` in `config.js`, the copy in
`messages.js`, and the artwork/styles in `styles.css` and `assets/`. These edits are
optional and do not replace any authentication step. Never store or log passwords,
email codes, transaction IDs, or completion URLs in your own application storage.

`faviconUrl` controls the browser tab icon independently of the page logo. The default
is the bundled Soln icon (`./assets/favicon-192x192.png`). Replace that file, set another SVG,
PNG, or ICO path relative to the page, or use an HTTPS image URL. If your site has an
`img-src` CSP directive, allow the icon's origin there too.

To preview the bundled demo, serve the package root over HTTP locally and open
`/examples/` with `workspaceLoginUrl: null`. To test real sign-in, configure the issuer
and HTTPS page URL, then start from the workspace's normal Runtime sign-in entry.
For direct access, set `workspaceLoginUrl` to that trusted `/auth/start` URL. A visit
without a transaction then navigates to Runtime, which creates a transaction and
returns through Soln to this page. Users do not need an existing login session.
This demo assumes Custom Login Page URL is registered for that Runtime's tenant.
