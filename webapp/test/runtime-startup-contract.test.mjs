import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const packageJson=JSON.parse(
  await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')
);

test('production startup launches the server directly without CI quality gates', () => {
  assert.equal(packageJson.scripts.start, 'node server.mjs');
  assert.equal(
    packageJson.scripts.prestart,
    undefined,
    'npm prestart must not run syntax checks, audits, or tests in the Railway startup lifecycle'
  );
  assert.match(packageJson.scripts.quality, /engineering:audit/);
  assert.match(packageJson.scripts.quality, /npm test/);
});
