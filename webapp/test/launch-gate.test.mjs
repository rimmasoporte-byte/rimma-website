import test from 'node:test';
import assert from 'node:assert/strict';

// Separate test worker: prove default production deployments cannot open login.
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.WEB_ORIGIN = 'https://staging.example.invalid';
process.env.RIMMA_API_BASE_URL = 'https://api.example.invalid';
delete process.env.WEB_PUBLIC_LOGIN_ENABLED;
const { server } = await import('../server.mjs');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;

test('a fresh production instance serves health but keeps login locked', async () => {
  try {
    let res = await fetch(base + '/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    res = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://staging.example.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({email: 'test@example.invalid', password: 'bad'})
    });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /todav[ií]a no est[aá] disponible/);
    res = await fetch(base + '/app/');
    assert.equal(res.status, 200);
    const page = await res.text();
    assert.match(page, /entorno de pruebas/i);
    assert.doesNotMatch(page, /type=["']password|<form/i);
    res = await fetch(base + '/api/data/clients');
    assert.equal(res.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
