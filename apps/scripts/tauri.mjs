// `yarn tauri …`: the Tauri CLI, with src-tauri/tauri.dev.conf.json over
// tauri.conf.json for `dev`. The dev app is then Ola Desktop DEV with its own
// identifier, so its own app data dir (accounts.json, settings.json, message
// cache) beside the installed app's. Every other command (build, icon,
// signer…) goes to the CLI unchanged, so release builds are not affected.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
// First, so that a --config given on the command line is merged after it and wins.
if (args[0] === 'dev') {
  args.splice(1, 0, '--config', fileURLToPath(new URL('../src-tauri/tauri.dev.conf.json', import.meta.url)));
}
// The CLI's own script under this node, without a shell: a shell (needed for
// tauri.cmd on Windows) would split a path with spaces.
const cli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js');
const run = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(run.status ?? 1);
