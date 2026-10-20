import assert from 'node:assert/strict';
import test from 'node:test';
import { createSolnLoginClient, SolnLoginError } from './index.js';

test('SDK only sends credentials to its explicitly configured HTTPS issuer without cookies', async () => {
  const id = 'a'.repeat(43);
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const client = createSolnLoginClient({
    issuer: 'https://console.example', requestId: id, locale: 'zh-CN',
    fetch: async (url, options) => {
      calls.push({ url: String(url), options: options! });
      return new Response(JSON.stringify({ nextStep: 'set_password', email: 'a@example.com', expiresAt: new Date().toISOString() }), { status: 200 });
    },
  });
  await client.loginWithPassword({ email: 'a@example.com', password: 'secret' });
  const call = calls[0];
  assert.equal(call.url, 'https://console.example/api/auth/custom-login/password');
  assert.equal(call.options.credentials, 'omit');
  assert.equal(call.options.redirect, 'error');
  assert.equal(new Headers(call.options.headers).get('x-soln-login-request'), id);
  assert.equal(new Headers(call.options.headers).get('accept-language'), 'zh-CN');
  assert.equal(call.url.includes('secret'), false);
  assert.deepEqual(JSON.parse(String(call.options.body)), { email: 'a@example.com', password: 'secret' });
});

test('SDK preserves structured localized errors for captcha and retry decisions', async () => {
  const client = createSolnLoginClient({ issuer: 'https://console.example', requestId: 'a'.repeat(43),
    fetch: async () => new Response(JSON.stringify({ code: 'AUTH_REQUIRED', domain: 'member_auth', reason: 'password_captcha_required', message: 'Verify first' }), { status: 401 }),
  });
  await assert.rejects(client.loginWithPassword({ email: 'a@example.com', password: 'wrong' }), (error: unknown) => {
    assert.ok(error instanceof SolnLoginError); assert.equal(error.reason, 'password_captcha_required'); assert.equal(error.status, 401); return true;
  });
});

test('SDK rejects untrusted issuers and completion redirects', () => {
  for (const issuer of ['http://console.example', 'https://user:password@console.example', 'https://console.example/path', 'https://console.example/#hash']) {
    assert.throws(() => createSolnLoginClient({ issuer, requestId: 'a'.repeat(43) }), /CUSTOM_LOGIN_ISSUER_INVALID/);
  }
  const client = createSolnLoginClient({ issuer: 'https://console.example', requestId: 'a'.repeat(43) });
  assert.throws(() => client.complete({ nextStep: 'complete', completionUrl: 'https://attacker.example/' }), /CUSTOM_LOGIN_COMPLETION_URL_INVALID/);
  assert.throws(() => client.complete({ nextStep: 'complete', completionUrl: `https://console.example/api/auth/custom-login/complete?request=${'b'.repeat(43)}&ticket=${'c'.repeat(43)}` }), /CUSTOM_LOGIN_COMPLETION_URL_INVALID/);
});
