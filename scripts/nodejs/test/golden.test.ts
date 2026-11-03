// Golden tests: every endpoint must build exactly the request the pre-refactor
// JS client built (expected values in test/golden/*.json were produced by the
// legacy builders), and must reject the inputs the old code let through.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { AnyEndpoint, JsonObject, OlaRequest, SessionInfo } from '../src/endpoint.ts';
import { endpoints } from '../src/endpoints/index.ts';

const GOLDEN_DIR = new URL('./golden/', import.meta.url);
// Fixed device values (not olaConfig) so a local OLA_DEVICE_ID cannot change the expected requests.
const SESSION: SessionInfo = { localId: 'me-uid', email: 'me@example.com', deviceId: 'nodejs-probe', androidVersion: '13' };
const registry = endpoints as unknown as Record<string, AnyEndpoint>;

interface GoldenCase {
  name: string;
  input: JsonObject;
  expected?: OlaRequest;
  error?: string;
}

// GOLDEN=addCoins3,getCoins limits the run to those endpoints.
const only = process.env.GOLDEN?.split(',').filter(Boolean);
const files = readdirSync(GOLDEN_DIR)
  .filter(file => file.endsWith('.json') && (!only || only.includes(file.slice(0, -5))))
  .sort();
const covered = new Set<string>();

for (const file of files) {
  const golden = JSON.parse(readFileSync(new URL(file, GOLDEN_DIR), 'utf8')) as { endpoint: string; cases: GoldenCase[] };
  covered.add(golden.endpoint);
  describe(`golden ${golden.endpoint}`, () => {
    const endpoint = registry[golden.endpoint];
    it('is registered', () => assert.ok(endpoint, `${golden.endpoint} missing from src/endpoints/index.ts`));
    for (const c of golden.cases) {
      it(c.name, () => {
        if (c.error !== undefined) {
          assert.throws(() => endpoint!.build(SESSION, c.input), (error: Error) => {
            assert.ok(error.message.includes(c.error!), `"${error.message}" should mention "${c.error}"`);
            return true;
          });
        } else {
          assert.deepStrictEqual(endpoint!.build(SESSION, c.input), c.expected);
        }
      });
    }
  });
}

it('every endpoint has golden cases', { skip: Boolean(only) }, () => {
  assert.deepStrictEqual(Object.keys(registry).filter(name => !covered.has(name)), []);
});
