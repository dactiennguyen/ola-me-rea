// Copies what `tauri build --target <triple>` left in apps/src-tauri/target/<triple>/release/bundle into one folder,
// named ola-desktop_<version>_<os>_<arch><ext> for every platform (Tauri's own names mix x64, amd64, x86_64 and en-US,
// and contain the space of "Ola Desktop"). Used by .github/workflows/build-matrix.yml; fails when a bundle is missing.
//   node .github/scripts/stage-bundles.mjs <target triple> <out dir>
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [target, out] = process.argv.slice(2);
if (!target || !out) {
  console.error('usage: node .github/scripts/stage-bundles.mjs <target triple> <out dir>');
  process.exit(2);
}

const PLATFORMS = {
  'aarch64-apple-darwin': 'macos_aarch64',
  'x86_64-apple-darwin': 'macos_x64',
  'x86_64-pc-windows-msvc': 'windows_x64',
  'x86_64-unknown-linux-gnu': 'linux_x64',
};
/** Per OS: [folder of bundle/, file name suffix, asset name suffix], one file each. */
const BUNDLES = {
  macos: [['dmg', '.dmg', '.dmg'], ['macos', '.app', '.app.zip']],
  windows: [['nsis', '-setup.exe', '-setup.exe'], ['msi', '.msi', '.msi']],
  linux: [['deb', '.deb', '.deb'], ['rpm', '.rpm', '.rpm'], ['appimage', '.AppImage', '.AppImage']],
};

const platform = PLATFORMS[target];
if (!platform) throw new Error(`unknown target ${target}; known: ${Object.keys(PLATFORMS).join(', ')}`);
const os = platform.split('_')[0];

const root = fileURLToPath(new URL('../..', import.meta.url));
const app = join(root, 'apps');
const config = JSON.parse(readFileSync(join(app, 'src-tauri/tauri.conf.json'), 'utf8'));
// tauri.conf.json takes its version from apps/package.json.
const { version } = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
const crate = /^name\s*=\s*"([^"]+)"/m.exec(readFileSync(join(app, 'src-tauri/Cargo.toml'), 'utf8'))?.[1];
const binary = config.mainBinaryName ?? crate;
const release = join(app, 'src-tauri/target', target, 'release');
const base = `${config.productName.toLowerCase().replace(/\s+/g, '-')}_${version}_${platform}`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const staged = [];
for (const [dir, suffix, assetSuffix] of BUNDLES[os]) {
  const folder = join(release, 'bundle', dir);
  const found = existsSync(folder) ? readdirSync(folder).filter(f => f.endsWith(suffix)) : [];
  if (found.length !== 1) throw new Error(`expected one *${suffix} in ${folder}, found: ${found.join(', ') || 'none'}`);
  const dest = join(out, base + assetSuffix);
  // A .app is a folder: ditto keeps its symlinks and signature in the zip.
  if (suffix === '.app') execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', join(folder, found[0]), dest]);
  else copyFileSync(join(folder, found[0]), dest);
  staged.push(dest);
}
// Windows: the executable alone also runs without installing (WebView2 ships with Windows 10/11).
if (os === 'windows') {
  const dest = join(out, `${base}_portable.exe`);
  copyFileSync(join(release, `${binary}.exe`), dest);
  staged.push(dest);
}

for (const file of staged) console.log(`${(statSync(file).size / 1048576).toFixed(1).padStart(7)} MB  ${file}`);
