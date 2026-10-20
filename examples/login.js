// SOLN INTEGRATION 2 — Add the SDK to an existing login page.
// This static demo uses the bundled ESM file. In a project with a bundler, install
// the supplied SDK package and import { createSolnLoginClient } from '@soln/custom-login-sdk'.
import { createSolnLoginClient } from '../dist/index.js';
import { config } from './config.js';
import { messages } from './messages.js';

let locale = Object.hasOwn(messages, config.locale) ? config.locale : 'en';
const languageKey = `soln-custom-login:language:${config.issuer}${window.location.pathname}`;
try {
  const saved = localStorage.getItem(languageKey);
  if (Object.hasOwn(messages, saved)) locale = saved;
} catch { /* Language switching also works when browser storage is disabled. */ }
let t = messages[locale];
// Keep this options object: changing locale also changes SDK error/verification language.
const clientOptions = { issuer: config.issuer, locale };
// SOLN INTEGRATION 5 — Bind your own components to the fields and handlers below.
// These DOM IDs are demo conventions, not protocol requirements. If you replace the
// markup with React/Vue components, read equivalent values from your component state.
const byId = (id) => document.getElementById(id);
const form = byId('login-form');
const status = byId('status');
const error = byId('error');
const languagePicker = document.querySelector('.language-picker');
const languageButton = byId('language');
const languageMenu = byId('language-menu');
const languageItems = [...languageMenu.querySelectorAll('[data-locale]')];
const rememberedEmailKey = `soln-custom-login:remembered-email:${config.issuer}${window.location.pathname}`;
let mode = 'password';
let busy = false;
let login;
let timer;
let seconds = 0;
let initializationError;
let preview = false;
const feedbackTimers = new Map();

byId('brand-name').textContent = config.brandName;
document.querySelector('.brand').setAttribute('aria-label', config.brandName);
// OPTIONAL BRANDING — Apply the configured browser tab icon independently of the page logo.
byId('favicon').href = config.faviconUrl;

function applyLanguage(value) {
  const previous = t;
  locale = value;
  t = messages[locale];
  clientOptions.locale = locale;
  document.documentElement.lang = locale;
  document.title = `${t.title} · ${config.brandName}`;
  languageButton.setAttribute('aria-label', t.language);
  languageItems.forEach((item) => { item.setAttribute('aria-checked', String(item.dataset.locale === locale)); });
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t[node.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t[node.dataset.i18nPlaceholder]; });
  document.querySelector('.remember-email').title = t.rememberHint;
  document.querySelectorAll('[data-password-target]').forEach((button) => {
    button.setAttribute('aria-label', button.getAttribute('aria-pressed') === 'true' ? t.hidePassword : t.showPassword);
  });
  for (const node of [status, error]) {
    const key = Object.keys(previous).find((key) => previous[key] === node.textContent);
    if (key) feedback(node, t[key]);
  }
  setMode(mode, true);
  if (seconds) byId('send-code').textContent = t.retryIn.replace('{seconds}', seconds);
}

// Global notifications do not move the form. Strip terminal periods from API text
// too, so translated server errors follow the same presentation as local messages.
function feedback(node, text = '', duration = 5000) {
  clearTimeout(feedbackTimers.get(node));
  feedbackTimers.delete(node);
  const message = text.trim().replace(/[。.]+$/u, '');
  node.textContent = message;
  node.hidden = !message;
  if (message && duration) feedbackTimers.set(node, setTimeout(() => feedback(node), duration));
}
// SOLN INTEGRATION 9 — Preserve loading, error, and form-state handling in your UI.
// Disable duplicate actions while a request or hosted verification is pending.
function setBusy(value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  form.querySelectorAll('button, input').forEach((node) => { node.disabled = value; });
  byId('switch-mode').disabled = value;
  languageButton.disabled = value;
  if (value) setLanguageMenu(false);
  byId('submit').querySelector('.button-spinner').hidden = !value;
  if (timer) byId('send-code').disabled = true;
}
// Keep all three states: password login, email-code login, and required password setup.
// Hidden inputs must not remain required; switching language must preserve typed values.
function setMode(value, preserveInputs = false) {
  mode = value;
  const setup = value === 'setup';
  const password = value === 'password';
  for (const [id, visible] of [['email', !setup], ['password', password], ['code', value === 'code'], ['new-password', setup]]) {
    byId(`${id}-label`).hidden = !visible;
    byId(id).required = visible;
    if (!preserveInputs && !visible && id !== 'email') byId(id).value = '';
  }
  byId('form-options').hidden = setup;
  byId('forgot-password').hidden = !password;
  byId('switch-mode').hidden = setup;
  byId('mode-prompt').hidden = setup;
  byId('switch-mode').textContent = password ? t.useCode : t.usePassword;
  byId('mode-prompt').textContent = password ? t.codePrompt : t.passwordPrompt;
  byId('submit-label').textContent = setup ? t.setPassword : t.signIn;
  byId('title').textContent = setup ? t.setupTitle : password ? t.title : t.codeTitle;
  byId('subtitle').textContent = setup ? t.setupSubtitle : password ? t.subtitle : t.codeSubtitle;
}
// Render errors as text. API error messages follow the SDK locale; use structured
// SolnLoginError code/reason fields if adding branches, never translated message text.
// Cancelling hosted verification rejects too; callers must release their loading state.
function showError(err) {
  feedback(status);
  const message = err instanceof Error && err.message.startsWith('CUSTOM_LOGIN_') ? t.sessionExpired
    : err instanceof Error ? err.message : t.requestFailed;
  feedback(error, message);
}
function ready() {
  if (preview) return false;
  if (initializationError) { showError(initializationError); return false; }
  return Boolean(login);
}
// OPTIONAL UX — Remember only the email. Never persist or log passwords, email codes,
// transaction IDs, or completion URLs in your own analytics or application storage.
function rememberEmail() {
  try {
    if (byId('remember-email').checked) localStorage.setItem(rememberedEmailKey, byId('email').value.trim());
    else localStorage.removeItem(rememberedEmailKey);
  } catch { /* Remembering an email is optional when browser storage is disabled. */ }
}

try {
  const saved = localStorage.getItem(rememberedEmailKey);
  if (saved) { byId('email').value = saved; byId('remember-email').checked = true; }
} catch { /* The login form also works with browser storage disabled. */ }
byId('remember-email').addEventListener('change', rememberEmail);
byId('email').addEventListener('change', () => { if (byId('remember-email').checked) rememberEmail(); });
function setLanguageMenu(open, focusIndex) {
  languageMenu.hidden = !open;
  languageButton.setAttribute('aria-expanded', String(open));
  if (open) languageItems[focusIndex ?? languageItems.findIndex((item) => item.dataset.locale === locale)].focus();
}
languageButton.addEventListener('click', () => { setLanguageMenu(languageMenu.hidden); });
languageButton.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  setLanguageMenu(true, event.key === 'ArrowUp' ? languageItems.length - 1 : 0);
});
languageItems.forEach((item) => {
  item.addEventListener('click', () => {
    if (busy) return;
    const value = item.dataset.locale;
    applyLanguage(value);
    setLanguageMenu(false);
    languageButton.focus();
    try { localStorage.setItem(languageKey, value); } catch { /* Saving the preference is optional. */ }
  });
});
languagePicker.addEventListener('keydown', (event) => {
  if (languageMenu.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setLanguageMenu(false);
    languageButton.focus();
    return;
  }
  if (!languageMenu.contains(event.target)) return;
  const index = languageItems.indexOf(document.activeElement);
  const next = { ArrowDown: (index + 1) % languageItems.length, ArrowUp: (index + languageItems.length - 1) % languageItems.length, Home: 0, End: languageItems.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  languageItems[next].focus();
});
for (const event of ['pointerdown', 'focusin']) {
  document.addEventListener(event, (event) => {
    if (!languagePicker.contains(event.target)) setLanguageMenu(false);
  });
}
document.querySelectorAll('[data-password-target]').forEach((button) => {
  button.setAttribute('aria-label', t.showPassword);
  button.addEventListener('click', () => {
    const input = byId(button.dataset.passwordTarget);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? t.hidePassword : t.showPassword);
  });
});
byId('switch-mode').onclick = () => {
  feedback(error); feedback(status);
  setMode(mode === 'password' ? 'code' : 'password');
};
// This button offers email-code sign-in; it does not call a password-reset API.
byId('forgot-password').onclick = () => {
  feedback(error); feedback(status); setMode('code');
};
// SOLN INTEGRATION 6 — Connect your "Send code" button to sendEmailCode({ email }).
// The SDK opens Soln-hosted human verification when required and resumes the request.
// Do not add an hCaptcha widget, site key, provider token, or tenant-domain registration.
byId('send-code').onclick = async () => {
  if (busy || timer || !byId('email').reportValidity() || !ready()) return;
  setBusy(true); feedback(error); feedback(status, t.sendingCode, 0);
  try {
    await login.sendEmailCode({ email: byId('email').value.trim() });
    rememberEmail(); feedback(status, t.codeSent);
    // The resend countdown is page UI; the server independently enforces rate limits.
    seconds = 60;
    byId('send-code').textContent = t.retryIn.replace('{seconds}', seconds);
    timer = setInterval(() => {
      seconds -= 1;
      byId('send-code').textContent = seconds ? t.retryIn.replace('{seconds}', seconds) : t.sendCode;
      if (!seconds) { clearInterval(timer); timer = undefined; byId('send-code').disabled = busy; }
    }, 1000);
  } catch (err) { showError(err); } finally { setBusy(false); }
  if (error.hidden) byId('code').focus();
};
// SOLN INTEGRATION 7 — Replace your form's login action with these SDK methods.
// Keep credentials in memory and send them only through the configured SDK client.
form.onsubmit = async (event) => {
  event.preventDefault();
  if (busy || !ready()) return;
  setBusy(true); feedback(error); feedback(status);
  byId('submit-label').textContent = t.signingIn;
  try {
    rememberEmail();
    let result;
    if (mode === 'setup') {
      // Required after a set_password result; the server retains the setup authorization.
      result = await login.setupPassword({ newPassword: byId('new-password').value });
    } else if (mode === 'code') {
      // Submit the six-digit email code with the same email used to request it.
      result = await login.verifyEmailCode({ email: byId('email').value.trim(), code: byId('code').value });
    } else {
      // Password login needs only email/password; the SDK handles any captcha challenge.
      result = await login.loginWithPassword({ email: byId('email').value.trim(), password: byId('password').value });
    }
    byId('password').value = ''; byId('new-password').value = ''; byId('code').value = '';
    // SOLN INTEGRATION 8 — Handle the server's next step for every login result.
    // set_password is not finished: show the new-password form and submit it above.
    // complete(result) navigates to Soln to establish the session and return to Runtime.
    // Pass the original result; do not invent a redirect URL or create a local session.
    if (result.nextStep === 'set_password') setMode('setup');
    else { login.complete(result); return; }
  } catch (err) { showError(err); }
  setBusy(false); setMode(mode);
};

applyLanguage(locale);
// SOLN INTEGRATION 3 — Create one client when the page loads, before any login action.
// Enter through the Runtime sign-in flow: Soln supplies #soln_login_request=... .
// The SDK reads/removes that fragment and retains the transaction in sessionStorage
// for refreshes. Initialize before any router that would discard or replace the fragment.
// If workspaceLoginUrl is configured, a direct visit starts the Runtime login flow.
// Otherwise it remains a design preview. Never fabricate a request ID or login success.
try {
  login = createSolnLoginClient(clientOptions);
} catch (err) {
  if (err instanceof Error && err.message === 'CUSTOM_LOGIN_REQUEST_INVALID') {
    preview = true;
    if (config.workspaceLoginUrl) window.location.replace(config.workspaceLoginUrl);
  }
  else { initializationError = err; showError(err); }
}
if (login) {
  setBusy(true); feedback(status, t.loading, 0);
  try {
    // SOLN INTEGRATION 4 — Load/validate the transaction before enabling the form.
    // Restore required password setup on refresh. context.tenant.name is available
    // if your design displays the workspace name. Expired flows must restart at Runtime.
    const context = await login.getContext();
    if (context.passwordSetup) setMode('setup');
  } catch (err) { initializationError = err; showError(err); }
  finally { feedback(status); setBusy(false); }
}
