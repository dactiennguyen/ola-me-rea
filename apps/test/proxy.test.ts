// node --test (yarn test): the proxy formats the account form accepts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseProxy, proxyLabel } from '../src/lib/proxy.ts';

const url = (text: string) => {
  const parsed = parseProxy(text);
  assert.ok(parsed && 'url' in parsed, `${JSON.stringify(text)} → ${JSON.stringify(parsed)}`);
  return parsed.url;
};
const error = (text: string) => {
  const parsed = parseProxy(text);
  assert.ok(parsed && 'error' in parsed, `${JSON.stringify(text)} should fail, got ${JSON.stringify(parsed)}`);
  return parsed.error;
};

describe('parseProxy', () => {
  it('reads URLs', () => {
    assert.equal(url('http://u:p@1.2.3.4:8080'), 'http://u:p@1.2.3.4:8080');
    assert.equal(url('socks5://1.2.3.4:1080'), 'socks5://1.2.3.4:1080');
    assert.equal(url('SOCKS5H://u:p@proxy.example.com:1080/'), 'socks5h://u:p@proxy.example.com:1080');
    assert.equal(url('socks://u:p@1.2.3.4:1080'), 'socks5://u:p@1.2.3.4:1080');
    assert.equal(url('http://u:p%40x@1.2.3.4:8080'), 'http://u:p%40x@1.2.3.4:8080');
  });

  it('reads host:port with or without credentials, in both orders', () => {
    assert.equal(url('1.2.3.4:8080'), 'http://1.2.3.4:8080');
    assert.equal(url('1.2.3.4:8080:user:pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('user:pass:1.2.3.4:8080'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('user:pass:proxy.example.com:3128'), 'http://user:pass@proxy.example.com:3128');
    assert.equal(url('proxy.example.com:3128:user:pass'), 'http://user:pass@proxy.example.com:3128');
  });

  it('keeps ":" inside passwords', () => {
    assert.equal(url('1.2.3.4:8080:user:pa:ss'), 'http://user:pa%3Ass@1.2.3.4:8080');
    assert.equal(url('user:pa:ss:1.2.3.4:8080'), 'http://user:pa%3Ass@1.2.3.4:8080');
  });

  it('reads both @ orders', () => {
    assert.equal(url('user:pass@1.2.3.4:8080'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4:8080@user:pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('user:p@ss@1.2.3.4:8080'), 'http://user:p%40ss@1.2.3.4:8080');
  });

  it('reads other separators', () => {
    assert.equal(url('1.2.3.4 8080 user pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4\t8080\tuser\tpass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4|8080|user|pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4;8080;user;pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4,8080,user,pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('1.2.3.4:8080 user:pass'), 'http://user:pass@1.2.3.4:8080');
    assert.equal(url('user pass 1.2.3.4 8080'), 'http://user:pass@1.2.3.4:8080');
  });

  it('reads a scheme word, spaces and extra lines', () => {
    assert.equal(url('socks5 1.2.3.4:1080:user:pass'), 'socks5://user:pass@1.2.3.4:1080');
    assert.equal(url('SOCKS5 1.2.3.4 1080 user pass'), 'socks5://user:pass@1.2.3.4:1080');
    assert.equal(url('socks5://1.2.3.4:1080:user:pass'), 'socks5://user:pass@1.2.3.4:1080');
    assert.equal(url('  \n  1.2.3.4:8080:user:pass  \n2.2.2.2:1'), 'http://user:pass@1.2.3.4:8080');
  });

  it('reads an [IPv6] host', () => {
    assert.equal(url('[2001:db8::1]:8080'), 'http://[2001:db8::1]:8080');
    assert.equal(url('http://u:p@[2001:db8::1]:8080'), 'http://u:p@[2001:db8::1]:8080');
  });

  it('treats empty text as no proxy', () => {
    assert.equal(parseProxy(''), null);
    assert.equal(parseProxy('   \n '), null);
    assert.equal(parseProxy(undefined), null);
  });

  it('rejects what it cannot use', () => {
    assert.match(error('https://1.2.3.4:8080'), /https/);
    assert.match(error('socks4://1.2.3.4:1080'), /socks4/);
    assert.match(error('1.2.3.4'), /Không đọc được proxy/);
    assert.match(error('1.2.3.4:99999'), /Cổng/);
    assert.match(error('1.2.3.4:8080:user'), /Không đọc được proxy/);
    assert.match(error('bad_host:80'), /Host/);
  });
});

describe('proxyLabel', () => {
  it('hides the password', () => {
    assert.equal(proxyLabel('1.2.3.4:8080:user:secret'), 'http 1.2.3.4:8080 (có user)');
    assert.equal(proxyLabel('socks5://1.2.3.4:1080'), 'socks5 1.2.3.4:1080');
    assert.equal(proxyLabel('nonsense'), 'proxy không hợp lệ');
  });
});
