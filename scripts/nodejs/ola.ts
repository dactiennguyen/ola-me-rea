#!/usr/bin/env node
// Ola API CLI. `node scripts/nodejs/ola.ts list` shows every endpoint;
// `node scripts/nodejs/ola.ts <endpoint> --help` shows its flags. See src/cli.ts.

import { main } from './src/cli.ts';
import { runMain } from './src/run.ts';

runMain(() => main());
