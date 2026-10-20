import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createSolnLoginClient, SolnLoginError } from './index.ts';

const issuer = 'https://console.example';
const requestId = 'r'.repeat(43);
const challengeId = 'c'.repeat(43);
const proof = 'p'.repeat(43);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const challenge = () => ({ challengeId,
  frameUrl: `${issuer}/api/auth/custom-login/captcha/frame?request=${requestId}&challenge=${challengeId}`,
  expiresAt: new Date(Date.now() + 180_000).toISOString(),
});
const required = (value = challenge()) => Response.json({
  code: 'FAILED_PRECONDITION', domain: 'custom_login', reason: 'captcha_required', message: 'Verify first', challenge: value,
}, { status: 428 });

function setup(t, fetch) {
  const dom = new JSDOM('<!doctype html><html><body><button id="submit">Sign in</button></body></html>', { url: 'https://tenant.example/login' });
  for (const key of ['window', 'document', 'HTMLElement']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event('close')); };
  t.after(() => dom.window.close());
  document.getElementById('submit').focus();
  const client = createSolnLoginClient({ issuer, requestId, locale: 'zh-CN', fetch });
  const message = (extra = {}) => {
    const frame = document.querySelector('iframe');
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
      origin: issuer, source: frame.contentWindow, data: { type: 'soln:captcha:complete', challengeId, proof }, ...extra,
    }));
  };
  return { client, message };
}

test('SDK opens the trusted hosted frame and retries only after a matching source, origin and challenge', async (t) => {
  const calls = [];
  const { client, message } = setup(t, async (url, options) => {
    calls.push({ url: String(url), options });
    return calls.length === 1 ? required() : Response.json({ nextStep: 'complete', completionUrl: 'server-completion' });
  });
  const input = { email: 'member@example.com', password: 'secret' };
  const result = client.loginWithPassword(input);
  await tick();
  assert.ok(document.querySelector('dialog').open);
  assert.equal(new URL(document.querySelector('iframe').src).origin, issuer);
  assert.equal(document.querySelector('iframe').referrerPolicy, 'no-referrer');
  message({ origin: 'https://attacker.example' });
  message({ source: window });
  message({ data: { type: 'soln:captcha:complete', challengeId: 'wrong', proof } });
  message({ data: { type: 'soln:captcha:complete', challengeId, proof: 'invalid' } });
  await tick();
  assert.equal(calls.length, 1);
  message();
  assert.equal((await result).nextStep, 'complete');
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0].options.body), input);
  assert.deepEqual(JSON.parse(calls[1].options.body), { ...input, captchaProof: proof });
  assert.equal(calls[1].options.credentials, 'omit');
  assert.equal(calls[1].options.headers['x-soln-login-request'], requestId);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.activeElement.id, 'submit');
});

test('cancel and timeout clean up the modal without submitting the protected action', async (t) => {
  let calls = 0;
  let expiresSoon = false;
  const { client } = setup(t, async () => {
    calls++;
    const value = challenge();
    if (expiresSoon) value.expiresAt = new Date(Date.now() + 60).toISOString();
    return required(value);
  });
  const first = client.sendEmailCode({ email: 'member@example.com' });
  const cancelled = assert.rejects(first, (error) => error.name === 'AbortError');
  await tick();
  await assert.rejects(client.sendEmailCode({ email: 'member@example.com' }), /登录请求正在处理中/);
  document.querySelector('dialog').dispatchEvent(new window.Event('cancel', { cancelable: true }));
  await cancelled;
  assert.equal(calls, 1);
  assert.equal(document.querySelector('dialog'), null);
  expiresSoon = true;
  await assert.rejects(client.sendEmailCode({ email: 'member@example.com' }), /验证已过期/);
  assert.equal(calls, 2);
  assert.equal(document.querySelector('dialog'), null);
});

test('challenge URLs cannot move verification to a foreign origin or another transaction', async (t) => {
  let frameUrl;
  const { client } = setup(t, async () => required({ ...challenge(), frameUrl }));
  for (const url of [
    'https://attacker.example/api/auth/custom-login/captcha/frame',
    `${issuer}/login?request=${requestId}&challenge=${challengeId}`,
    `${issuer}/api/auth/custom-login/captcha/frame?request=${'x'.repeat(43)}&challenge=${challengeId}`,
  ]) {
    frameUrl = url;
    await assert.rejects(client.sendEmailCode({ email: 'member@example.com' }), /CUSTOM_LOGIN_CAPTCHA_CHALLENGE_INVALID/);
    assert.equal(document.querySelector('dialog'), null);
  }
});

test('a second challenge is reported instead of starting an endless verification loop', async (t) => {
  let calls = 0;
  const { client, message } = setup(t, async () => { calls++; return required(); });
  const result = client.sendEmailCode({ email: 'member@example.com' });
  const failed = assert.rejects(result, (error) => error instanceof SolnLoginError && error.status === 428);
  await tick(); message(); await failed;
  assert.equal(calls, 2);
  assert.equal(document.querySelector('dialog'), null);
});

test('hosted provider errors close verification, release the request and allow a fresh attempt', async (t) => {
  let calls = 0;
  const { client, message } = setup(t, async () => { calls++; return required(); });
  for (const [reason, expected] of [['unavailable', '无法加载验证，请重试'], ['expired', '验证已过期，请重试'], ['rejected', '验证未通过，请重试']]) {
    const result = client.sendEmailCode({ email: 'member@example.com' });
    const rejected = assert.rejects(result, { message: expected });
    await tick();
    message({ data: { type: 'soln:captcha:error', challengeId, reason } });
    await rejected;
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(document.activeElement.id, 'submit');
  }
  assert.equal(calls, 3);
});
