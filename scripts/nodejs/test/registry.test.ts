import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { renderIndex } from '../tools/gen-endpoint-index.ts';

it('src/endpoints/index.ts is up to date (run `yarn gen:index`)', () => {
  const onDisk = readFileSync(new URL('../src/endpoints/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, renderIndex());
});
