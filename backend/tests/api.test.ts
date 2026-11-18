/**
 * Backend unit + HTTP tests. No network and no database: Supabase env vars
 * point at an unreachable placeholder, and every test below exercises code
 * paths that answer before any database call. Database rules are tested in
 * supabase/test/10_rls_security_tests.sql against a real PostgreSQL.
 *
 * Run: npm test
 */
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const { app } = await import('../src/index.js');
const { sanitizeContext, filterAllowedModels, openRouterChat, textModelCandidates } = await import('../src/ai/provider.js');
const { isSafeStoragePath } = await import('../src/validation/paths.js');
const { readAalClaim, requireMfa } = await import('../src/middleware/auth.js');
const { mfaRequired, resetMfaCache, isMissingFunction } = await import('../src/services/dbFeatures.js');
const { rateLimit } = await import('../src/middleware/security.js');
const { isGovernmentEmail } = await import('../src/routes/auth.js');

let server: Server;
let base = '';

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

function mockRes() {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.setHeader = () => r;
  return r;
}

describe('AI context sanitizer', () => {
  test('removes credentials, PII and sealed bid data', () => {
    const out = sanitizeContext({
      project_name: 'Ring Road',
      contact_email: 'officer@pmc.gov.in',
      notes: 'call 9876543210 or mail a@b.in, token eyJhbGciOi.eyJzdWIiOi.abc123',
      bids: [{ bid_amount: 12.5, technical_proposal: 'secret', status: 'SUBMITTED' }],
      service_role_key: 'x',
    });
    assert.equal(out.project_name, 'Ring Road');
    assert.equal(out.contact_email, undefined);
    assert.equal(out.service_role_key, undefined);
    assert.equal(out.bids[0].bid_amount, undefined);
    assert.equal(out.bids[0].technical_proposal, undefined);
    assert.equal(out.bids[0].status, 'SUBMITTED');
    assert.match(out.notes, /\[REDACTED_PHONE\]/);
    assert.match(out.notes, /\[REDACTED_EMAIL\]/);
    assert.match(out.notes, /\[REDACTED_TOKEN\]/);
  });
});

describe('AI provider privacy', () => {
  test('free model ids are refused unless explicitly allowed', () => {
    delete process.env.AI_ALLOW_FREE_MODELS;
    assert.deepEqual(filterAllowedModels(['a/b:free', 'a/c', 'a/c']), ['a/c']);
    process.env.AI_ALLOW_FREE_MODELS = 'true';
    assert.deepEqual(filterAllowedModels(['a/b:free', 'a/c']), ['a/b:free', 'a/c']);
    delete process.env.AI_ALLOW_FREE_MODELS;
  });

  test('defaults contain no free models', () => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_MODELS;
    const models = textModelCandidates();
    assert.ok(models.length > 0);
    assert.ok(models.every((m) => !m.endsWith(':free')));
  });

  test('requests ask for zero-data-retention, no-data-collection routing and time out', async () => {
    const realFetch = globalThis.fetch;
    let sent: any;
    let hadSignal = false;
    globalThis.fetch = (async (_url: any, init: any) => {
      sent = JSON.parse(init.body);
      hadSignal = !!init.signal;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { total_tokens: 5 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const out = await openRouterChat('key', 'nvidia/x', [{ role: 'user', content: 'hi' }]);
      assert.equal(out.content, '{"ok":true}');
      assert.deepEqual(sent.provider, { data_collection: 'deny', zdr: true });
      assert.ok(hadSignal, 'fetch must carry an abort/timeout signal');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('no compliant provider is a model-level failure (next model, never a logging endpoint)', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{}', { status: 404, statusText: 'No endpoints found' })) as typeof fetch;
    try {
      await assert.rejects(openRouterChat('key', 'm', []), (err: any) => err.modelLevel === true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('storage path validation', () => {
  const org = '10000000-0000-0000-0000-0000000000c1';
  test('accepts files inside the owner folder', () => {
    assert.ok(isSafeStoragePath(`${org}/20000000-0000-0000-0000-00000000000a/site photo (1).jpg`, org));
  });
  for (const bad of ['../etc/passwd', `${org}/../other/x.jpg`, `/abs/${org}/x.jpg`, `${org}\\x.jpg`, `${org}//x.jpg`, 'x.jpg', `${org}/x<script>.jpg`, '']) {
    test(`rejects ${JSON.stringify(bad)}`, () => assert.equal(isSafeStoragePath(bad, org), false));
  }
  test("rejects another owner's folder", () => {
    assert.equal(isSafeStoragePath('10000000-0000-0000-0000-0000000000c2/x.jpg', org), false);
  });
  test('rejects when the caller has no owner id', () => {
    assert.equal(isSafeStoragePath(`${org}/x.jpg`, null), false);
  });
});

describe('MFA', () => {
  test('reads aal from a verified token', () => {
    assert.equal(readAalClaim(fakeJwt({ aal: 'aal2' })), 'aal2');
    assert.equal(readAalClaim(fakeJwt({})), 'aal1');
    assert.equal(readAalClaim('garbage'), 'aal1');
  });

  test('government and contractor writes need aal2; citizens do not', async () => {
    process.env.REQUIRE_MFA = 'true';
    for (const [role, aal, expectNext] of [
      ['government_admin', 'aal1', false],
      ['government_admin', 'aal2', true],
      ['contractor_admin', 'aal1', false],
      ['citizen', 'aal1', true],
    ] as const) {
      const res = mockRes();
      let called = false;
      await requireMfa({ role, aal } as any, res, () => { called = true; });
      assert.equal(called, expectNext, `${role}/${aal}`);
      if (!expectNext) {
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error.code, 'MFA_REQUIRED');
      }
    }
    delete process.env.REQUIRE_MFA;
  });

  test('REQUIRE_MFA=false disables the gate (development only)', async () => {
    process.env.REQUIRE_MFA = 'false';
    let called = false;
    await requireMfa({ role: 'government_admin', aal: 'aal1' } as any, mockRes(), () => { called = true; });
    assert.ok(called);
    delete process.env.REQUIRE_MFA;
  });

  test('unset REQUIRE_MFA follows the database; unreachable database means not yet enforced', async () => {
    delete process.env.REQUIRE_MFA;
    resetMfaCache();
    assert.equal(await mfaRequired(), false);
  });
});

describe('migration compatibility', () => {
  test('recognises a missing database function', () => {
    assert.ok(isMissingFunction({ code: 'PGRST202', message: 'Could not find the function public.x' }));
    assert.ok(!isMissingFunction({ code: '42501', message: 'permission denied' }));
    assert.ok(!isMissingFunction(null));
  });

  test('a configured free model falls back to the paid defaults instead of disabling AI', () => {
    delete process.env.AI_ALLOW_FREE_MODELS;
    process.env.OPENROUTER_MODEL = 'nvidia/some-model:free';
    const models = textModelCandidates();
    assert.ok(models.length > 0 && models.every((m) => !m.endsWith(':free')));
    delete process.env.OPENROUTER_MODEL;
  });
});

describe('rate limiter (local store)', () => {
  test('blocks after the limit', async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyGenerator: () => 'unit-test-key' });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      let passed = false;
      await limiter({} as any, res, () => { passed = true; });
      statuses.push(passed ? 200 : res.statusCode);
    }
    assert.deepEqual(statuses, [200, 200, 429]);
  });
});

describe('government email domains', () => {
  test('official domains and sub-domains only', () => {
    assert.ok(isGovernmentEmail('officer@pmc.gov.in'));
    assert.ok(isGovernmentEmail('x@nic.in'));
    assert.ok(!isGovernmentEmail('x@gmail.com'));
    assert.ok(!isGovernmentEmail('x@notgov.in'));
    assert.ok(!isGovernmentEmail('x@gov.in.evil.com'));
  });
});

describe('HTTP surface', () => {
  test('/health discloses nothing', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  for (const [method, path] of [
    ['POST', '/api/projects'],
    ['POST', '/api/progress/submit'],
    ['POST', '/api/progress/review'],
    ['POST', '/api/ai/analyze/some-id'],
    ['POST', '/api/tenders'],
    ['PUT', '/api/tenders/x/committee'],
    ['POST', '/api/tenders/x/open'],
    ['POST', '/api/tenders/x/award'],
    ['GET', '/api/tenders/x/bids/summary'],
  ]) {
    test(`${method} ${path} requires authentication`, async () => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(res.status, 401);
    });
  }

  test('unknown origins are refused by CORS', async () => {
    const res = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });

  test('unknown routes return a JSON 404 without internals', async () => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });

  const govApplicant = {
    accountType: 'government', fullName: 'Some One', employeeId: 'E-1', department: 'PWD',
    designation: 'EE', state: 'Maharashtra', district: 'Pune',
  };

  test('government registration requires an official email domain', async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...govApplicant, email: 'someone@gmail.com', password: 'Str0ng!Password#1' }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'OFFICIAL_EMAIL_REQUIRED');
  });

  test('government registration enforces the password policy', async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...govApplicant, email: 'someone@pmc.gov.in', password: 'weakpass' }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_REGISTRATION');
  });

  test('anonymous complaints cannot attach files', async () => {
    const res = await fetch(`${base}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Road', title: 'Pothole here', description: 'Large pothole near school', evidence_paths: ['00000000-0000-0000-0000-00000000d001/x.jpg'] }),
    });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'SIGN_IN_REQUIRED');
  });

  test('complaint validation rejects oversized text', async () => {
    const res = await fetch(`${base}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Road', title: 'x'.repeat(500), description: 'Large pothole near school' }),
    });
    assert.equal(res.status, 400);
  });

  test('vision accepts bodies above the 2 MB default (validated, not 413)', async () => {
    const res = await fetch(`${base}/api/ai/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'not-a-data-url' + 'a'.repeat(3_000_000) }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
  });

  test('other routes keep the 2 MB body limit', async () => {
    const res = await fetch(`${base}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'a'.repeat(2_500_000) }),
    });
    assert.equal(res.status, 413);
  });
});
