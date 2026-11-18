// latest.json for the updater (.github/scripts/latest-json.mjs; apps/docs/05-phat-hanh.md#tự-cập-nhật).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestJson, releaseNotes } from '../../.github/scripts/latest-json.mjs';

// The assets of a release as stage-bundles.mjs names them, with the .sig a build with the updater key leaves.
const bundles = [
  'ola-desktop_0.8.0_macos_aarch64.dmg', 'ola-desktop_0.8.0_macos_aarch64.app.zip', 'ola-desktop_0.8.0_macos_aarch64.app.tar.gz',
  'ola-desktop_0.8.0_macos_x64.dmg', 'ola-desktop_0.8.0_macos_x64.app.zip', 'ola-desktop_0.8.0_macos_x64.app.tar.gz',
  'ola-desktop_0.8.0_windows_x64-setup.exe', 'ola-desktop_0.8.0_windows_x64.msi', 'ola-desktop_0.8.0_windows_x64_portable.exe',
  'ola-desktop_0.8.0_linux_x64.deb', 'ola-desktop_0.8.0_linux_x64.rpm', 'ola-desktop_0.8.0_linux_x64.AppImage',
];
const signed = bundles.filter(f => !/\.(dmg|app\.zip)$|_portable\.exe$/.test(f));
const release = (files: string[]) => ({
  files,
  signature: (name: string) => `sig of ${name}\n`,
  version: 'v0.8.0',
  repo: 'dactiennguyen/ola-me-rea',
  tag: 'v0.8.0',
  notes: 'Tự cập nhật\n\nCo-Authored-By: Someone <a@b.c>\n',
  date: '2026-11-18T02:00:00.000Z',
});

test('latest.json: every bundle the updater installs, by {os}-{arch}-{installer} and {os}-{arch}, with its .sig', () => {
  const m = latestJson(release([...bundles, ...signed.map(f => `${f}.sig`), 'SHA256SUMS.txt']));
  assert.equal(m.version, '0.8.0');
  assert.equal(m.notes, 'Tự cập nhật');
  assert.deepEqual(Object.keys(m.platforms).sort(), [
    'darwin-aarch64', 'darwin-aarch64-app', 'darwin-x86_64', 'darwin-x86_64-app',
    'linux-x86_64', 'linux-x86_64-appimage', 'linux-x86_64-deb', 'linux-x86_64-rpm',
    'windows-x86_64', 'windows-x86_64-msi', 'windows-x86_64-nsis',
  ]);
  assert.deepEqual(m.platforms['darwin-aarch64-app'], {
    signature: 'sig of ola-desktop_0.8.0_macos_aarch64.app.tar.gz.sig',
    url: 'https://github.com/dactiennguyen/ola-me-rea/releases/download/v0.8.0/ola-desktop_0.8.0_macos_aarch64.app.tar.gz',
  });
  assert.equal(m.platforms['windows-x86_64'], m.platforms['windows-x86_64-nsis']);
  assert.equal(m.platforms['linux-x86_64'], m.platforms['linux-x86_64-appimage']);
});

test('latest.json refuses a release with a bundle left unsigned (signing key missing from the secrets)', () => {
  const files = [...bundles, ...signed.filter(f => !f.endsWith('.msi')).map(f => `${f}.sig`)];
  assert.throws(() => latestJson(release(files)), /_windows_x64\.msi\.sig.*TAURI_SIGNING_PRIVATE_KEY/);
  assert.throws(() => latestJson(release(bundles)), /TAURI_SIGNING_PRIVATE_KEY/);
});

test('release notes: the commit body without its trailer paragraph', () => {
  assert.equal(releaseNotes('Một\n\nHai\n\nCo-Authored-By: X <x@y.z>\nSigned-off-by: Y <y@z.w>\n'), 'Một\n\nHai');
  assert.equal(releaseNotes('Chỉ một đoạn\n'), 'Chỉ một đoạn');
});
