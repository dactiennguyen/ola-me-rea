import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { cliValue, main, type CliDeps } from '../src/cli.ts';
import { defineEndpoint, text, type AnyEndpoint, type JsonObject } from '../src/endpoint.ts';
import { getPostByID } from '../src/endpoints/getPostByID.ts';
import { postStoriesId } from '../src/endpoints/postStoriesId.ts';
import { updateNotification } from '../src/endpoints/updateNotification.ts';
import { usersUpdate } from '../src/endpoints/usersUpdate.ts';

const registry = { getPostByID, postStoriesId, updateNotification, usersUpdate } as unknown as Record<string, AnyEndpoint>;

function harness() {
  const lines: string[] = [];
  const calls: { endpoint: string; input: JsonObject }[] = [];
  let logins = 0;
  let closes = 0;
  const deps: CliDeps = {
    endpoints: registry,
    output: line => lines.push(line),
    login: async () => {
      logins++;
      return {
        call: (async (endpoint: AnyEndpoint, input: JsonObject) => {
          calls.push({ endpoint: endpoint.name, input });
          return { is_success: true };
        }) as never,
        close: async () => { closes++; },
      };
    },
  };
  return { deps, lines, calls, logins: () => logins, closes: () => closes };
}

describe('ola CLI', () => {
  it('--dry-run prints the request without logging in', async () => {
    const h = harness();
    await main(['getPostByID', '--postID', '123', '--dry-run'], h.deps);
    assert.equal(h.logins(), 0);
    // "123" stays a string: postID is a text field.
    assert.deepEqual(JSON.parse(h.lines.join('\n')),
      { method: 'POST', path: 'faApi2/getPostByID.php', body: { postID: '123' } });
  });

  it('validates before login', async () => {
    const h = harness();
    await assert.rejects(main(['getPostByID'], h.deps), /postID/);
    await assert.rejects(main(['updateNotification', '--mark_all_read', '--delete_all'], h.deps), /cannot be used together/);
    assert.equal(h.logins(), 0);
  });

  it('logs in, calls, prints and closes', async () => {
    const h = harness();
    await main(['usersUpdate', '--birth_year', '1999', '--name', 'An'], h.deps);
    assert.deepEqual(h.calls, [{ endpoint: 'usersUpdate', input: { name: 'An', birth_year: 1999 } }]);
    assert.deepEqual(JSON.parse(h.lines.join('\n')), { is_success: true });
    assert.equal(h.closes(), 1);
  });

  it('parses JSON object fields and merges --json under the flags', async () => {
    const h = harness();
    await main(['postStoriesId', '--storyId', 's1', '--action', 'react', '--body', '{"type":"love"}',
      '--json', '{"storyId":"ignored","method":"post"}', '--dry-run'], h.deps);
    assert.deepEqual(JSON.parse(h.lines.join('\n')),
      { method: 'POST', path: 'napi/post/stories/s1/react', body: { type: 'love' } });
  });

  it('rejects unknown flags', async () => {
    const h = harness();
    await assert.rejects(main(['getPostByID', '--postId', '1', '--dry-run'], { ...h.deps }), /unknown option/);
  });

  it('reads dashed field names back from commander', async () => {
    const h = harness();
    const upload = defineEndpoint({
      name: 'upload', summary: '', method: 'POST', path: 'napi/upload',
      fields: { 'x-file-name': text(), 'content-type': text().optional() },
    });
    await main(['upload', '--x-file-name', 'a.jpg', '--content-type', 'image/jpeg', '--dry-run'],
      { ...h.deps, endpoints: { upload } as unknown as Record<string, AnyEndpoint> });
    assert.deepEqual(JSON.parse(h.lines.join('\n')).body, { 'x-file-name': 'a.jpg', 'content-type': 'image/jpeg' });
  });

  it('lists endpoints', async () => {
    const h = harness();
    await main(['list'], h.deps);
    assert.equal(h.lines.length, 4);
    assert.match(h.lines.find(l => l.startsWith('updateNotification'))!, /POST\s+MUTATE faApi2\/updateNotification\.php/);
  });
});

describe('cliValue', () => {
  it('keeps the first candidate the field accepts', () => {
    assert.equal(cliValue(z.string(), '42'), '42');
    assert.equal(cliValue(z.int(), '42'), 42);
    assert.equal(cliValue(z.union([z.string(), z.int()]), '42'), '42');
    assert.equal(cliValue(z.union([z.literal(1), z.literal('all')]), '1'), 1);
    assert.equal(cliValue(z.boolean(), 'false'), false);
    assert.equal(cliValue(z.boolean(), true), true);
    assert.deepEqual(cliValue(z.record(z.string(), z.number()), '{"a":1}'), { a: 1 });
    assert.equal(cliValue(z.int(), 'abc'), 'abc');
  });

  it('reads true/false as booleans where accepted, and null for nullable fields', () => {
    const scalar = z.union([z.string(), z.number(), z.boolean()]);
    assert.equal(cliValue(scalar, 'false'), false);
    assert.equal(cliValue(scalar, '55123'), '55123');
    assert.equal(cliValue(z.string(), 'false'), 'false');
    assert.equal(cliValue(z.int().nullable(), 'null'), null);
  });
});
