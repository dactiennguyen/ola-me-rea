import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildConfig, firebaseDefaults, olaDefaults, socketDefaults } from '../src/defaults.ts';
import { md5Hex } from '../src/md5.ts';

describe('md5Hex', () => {
  it('matches node:crypto for ASCII, Vietnamese, emoji and every padding boundary', () => {
    const inputs = ['', 'a', 'abc', 'message digest', '1699999112nodejs-probe/getPostByID.php',
      'Tối nay rảnh không, đi cà phê nhé?', '👋🏽 xin chào'];
    for (let n = 50; n <= 130; n++) inputs.push('x'.repeat(n));
    inputs.push('đ'.repeat(5000));
    for (const input of inputs) {
      assert.equal(md5Hex(input), createHash('md5').update(input, 'utf8').digest('hex'), `length ${input.length}`);
    }
  });
});

describe('buildConfig', () => {
  it('uses the APK defaults when nothing is set', () => {
    assert.deepEqual(buildConfig({}), { firebase: firebaseDefaults, ola: olaDefaults, socket: socketDefaults });
  });

  it('applies trimmed OLA_* overrides and ignores blank values', () => {
    const config = buildConfig({ OLA_BASE_URL: 'https://example.invalid/', OLA_APP_VERSION: '  ', OLA_SOCKET_KEY: ' k\n' });
    assert.equal(config.ola.baseUrl, 'https://example.invalid/');
    assert.equal(config.ola.appVersion, olaDefaults.appVersion);
    assert.equal(config.socket.key, 'k');
  });
});

// The Tauri app (apps/) bundles these modules into a webview, which has no node:* modules.
describe('platform-neutral core', () => {
  const ENTRY_POINTS = ['client.ts', 'chat.ts', 'endpoints/index.ts'];
  const IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s+'([^']+)'/gm;

  it('never reaches a node:* import from the desktop entry points', () => {
    const seen = new Set<string>();
    const stack = ENTRY_POINTS.map(file => new URL(`../src/${file}`, import.meta.url));
    while (stack.length) {
      const url = stack.pop()!;
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      const source = readFileSync(url, 'utf8');
      for (const [, spec] of source.matchAll(IMPORT)) {
        assert.ok(!spec!.startsWith('node:'), `${url.pathname} imports ${spec}`);
        if (spec!.startsWith('.')) stack.push(new URL(spec!, url));
      }
    }
    assert.ok(seen.size > 10, 'walked the import graph');
  });
});
