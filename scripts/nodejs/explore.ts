#!/usr/bin/env node
// Khám phá (Explore) paging CLI: fetches up to --pages pages of one tab, following
// each response's `next` input. Flow: ../../docs/api/luong-kham-pha.md

import { parseArgs } from 'node:util';
import type { OlaClient } from './src/client.ts';
import { envDryRunSession, loginFromEnv } from './src/node.ts';
import type { JsonObject } from './src/endpoint.ts';
import type { ExploreTab } from './src/endpoints/_explore.ts';
import { getExplore3 } from './src/endpoints/getExplore3.ts';
import { getExploreAvatarV4 } from './src/endpoints/getExploreAvatarV4.ts';
import { getExploreOnlineV6 } from './src/endpoints/getExploreOnlineV6.ts';
import { runMain } from './src/run.ts';

export const exploreTabs = { online: getExploreOnlineV6, verified: getExplore3, avatar: getExploreAvatarV4 } as const;

const USAGE = `Usage: node scripts/nodejs/explore.ts [options]
  --tab online|verified|avatar   Default: online
  --gender 0|1|2|all            Female|male|LGBT|all (default)
  --city <app-city-id>|all     Example: 1 = Ha Noi
  --page <n>                  Zero-based starting page; default: 0
  --cursor <n>                Previous Online response.lastSeenPaging
  --pages <n>                 Maximum pages to fetch; default: 1
  --dry-run                   Show first request only; no login/network
  --help                      Show usage
Uses the scripts/nodejs/.env account. Prints one full JSON response per page.`;

function number(value: string, name: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must contain decimal digits only.`);
  }
  return Number(value);
}

export function parseCli(args: string[]) {
  const { values } = parseArgs({
    args, options: {
      tab: { type: 'string', default: 'online' },
      page: { type: 'string', default: '0' },
      pages: { type: 'string', default: '1' },
      gender: { type: 'string' }, city: { type: 'string' },
      cursor: { type: 'string' },
      'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return { help: true as const };
  if (!Object.hasOwn(exploreTabs, values.tab)) throw new Error('tab must be online, verified or avatar.');
  const tab = values.tab as ExploreTab;
  const input: JsonObject = { page: number(values.page, 'page') };
  if (values.gender !== undefined) input.gender = values.gender === 'all' ? 'all' : number(values.gender, 'gender');
  if (values.city !== undefined) input.cityID = values.city;
  if (values.cursor !== undefined) input.lastSeenPaging = number(values.cursor, 'cursor');
  const pages = number(values.pages, 'pages');
  if (!pages) throw new Error('pages must be at least 1.');
  const preview = exploreTabs[tab].build(envDryRunSession(), input); // Validate before login/network calls.
  return { tab, input, pages, preview, dryRun: Boolean(values['dry-run']) };
}

export async function main(args = process.argv.slice(2), {
  output = console.log, login = () => loginFromEnv(),
}: { output?: (line: string) => void; login?: () => Promise<OlaClient> } = {}): Promise<void> {
  const cli = parseCli(args);
  if ('help' in cli) {
    output(USAGE);
    return;
  }
  if (cli.dryRun) {
    output(JSON.stringify(cli.preview, null, 2));
    return;
  }
  const endpoint = exploreTabs[cli.tab];
  const client = await login();
  try {
    let input: JsonObject | null = cli.input;
    for (let i = 0; i < cli.pages && input; i++) {
      const result = await client.call(endpoint, input);
      output(JSON.stringify({ tab: result.tab, page: result.page, count: result.items.length,
        next: result.next, response: result.raw }));
      input = result.next as JsonObject | null;
    }
  } finally {
    await client.close();
  }
}

if (import.meta.main) runMain(() => main());
