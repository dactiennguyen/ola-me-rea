#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');

const ENDPOINTS = Object.freeze({
  online: 'faApi2/getExploreOnlineV6.php',
  verified: 'faApi2/getExplore3.php',
  avatar: 'faApi2/getExploreAvatarV4.php',
});

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function buildExploreRequest(uid, options = {}) {
  const { tab = 'online', page = 0, gender, cityID, lastSeenPaging } = options;
  if (!Object.hasOwn(ENDPOINTS, tab)) throw new Error('tab must be online, verified or avatar.');
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('Missing signed-in Firebase UID.');
  integer(page, 'page');
  if (page === Number.MAX_SAFE_INTEGER) throw new Error('page is too large to advance.');
  const body = { uid, os: 'android', page };
  if (tab === 'online') body.condition = 2;
  if (tab === 'verified') body.condition = 1;
  if (gender !== undefined && gender !== 'all') {
    if (![0, 1, 2].includes(gender)) throw new Error('gender must be 0, 1, 2 or all.');
    body.gender = gender;
  }
  if (cityID !== undefined && cityID !== '' && cityID !== 'all') {
    if (typeof cityID !== 'string' || !/^[1-9]\d*$/.test(cityID)) {
      throw new Error('cityID must be a positive decimal string or all.');
    }
    body.cityID = cityID;
  }
  if (tab === 'online') {
    if (page > 0 && lastSeenPaging === undefined) {
      throw new Error('Online page > 0 requires lastSeenPaging from the previous response.');
    }
    body.lastSeenPaging = integer(lastSeenPaging ?? 0, 'lastSeenPaging');
  } else if (lastSeenPaging !== undefined) {
    throw new Error('lastSeenPaging is only used by the online tab.');
  }
  return { path: ENDPOINTS[tab], body };
}

function localAuth() {
  try { require.resolve('./login'); } catch {
    throw new Error('Missing scripts/nodejs/login.js with login() and requestOla() exports.');
  }
  try { return require('./login'); } catch (error) {
    // login.js exists, so a missing module here is one of its npm dependencies.
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error('login.js dependencies are missing; run `yarn install` in scripts/nodejs.');
    }
    throw error;
  }
}

async function getExplore(session, options = {}, request) {
  if (!session || typeof session.idToken !== 'string' || !session.idToken.trim()) {
    throw new Error('Missing Firebase session.idToken; call login() first.');
  }
  const { path, body } = buildExploreRequest(session.localId, options);
  const raw = await (request || localAuth().requestOla)(session.idToken, path, body);
  if ([false, 0, '0', 'false'].includes(raw?.is_success)) {
    throw new Error(`${path}: API reported is_success=false.`);
  }
  if (!Array.isArray(raw?.list_data)) throw new Error(`${path}: expected list_data array.`);
  const tab = options.tab ?? 'online';
  let next = null;
  if (raw.list_data.length) {
    next = { tab, page: body.page + 1 };
    if (body.gender !== undefined) next.gender = body.gender;
    if (body.cityID !== undefined) next.cityID = body.cityID;
    if (tab === 'online') next.lastSeenPaging = integer(raw.lastSeenPaging, 'response.lastSeenPaging');
  }
  return { tab, page: body.page, items: raw.list_data, next, raw };
}

const getExploreOnline = (session, options = {}, request) => getExplore(session, { ...options, tab: 'online' }, request);
const getExploreVerified = (session, options = {}, request) => getExplore(session, { ...options, tab: 'verified' }, request);
const getExploreAvatar = (session, options = {}, request) => getExplore(session, { ...options, tab: 'avatar' }, request);

function parseCli(args) {
  const { values } = parseArgs({ args, options: {
    tab: { type: 'string', default: 'online' },
    page: { type: 'string', default: '0' },
    pages: { type: 'string', default: '1' },
    gender: { type: 'string' }, city: { type: 'string' },
    cursor: { type: 'string' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) return { help: true };
  function number(value, name) {
    if (!/^\d+$/.test(value)) throw new Error(`${name} must contain decimal digits only.`);
    return integer(Number(value), name);
  }
  const options = { tab: values.tab, page: number(values.page, 'page') };
  if (values.gender !== undefined) options.gender = values.gender === 'all' ? 'all' : number(values.gender, 'gender');
  if (values.city !== undefined) options.cityID = values.city;
  if (values.cursor !== undefined) options.lastSeenPaging = number(values.cursor, 'cursor');
  const pages = number(values.pages, 'pages');
  if (!pages) throw new Error('pages must be at least 1.');
  buildExploreRequest('<signed-in-uid>', options); // Validate before login/network calls.
  return { options, pages, dryRun: Boolean(values['dry-run']) };
}

async function main(args = process.argv.slice(2), dependencies = {}) {
  const output = dependencies.output || console.log;
  const cli = parseCli(args);
  if (cli.help) {
    output(`Usage: node scripts/nodejs/explore.js [options]
  --tab online|verified|avatar   Default: online
  --gender 0|1|2|all            Female|male|LGBT|all (default)
  --city <app-city-id>|all     Example: 1 = Ha Noi
  --page <n>                  Zero-based starting page; default: 0
  --cursor <n>                Previous Online response.lastSeenPaging
  --pages <n>                 Maximum pages to fetch; default: 1
  --dry-run                   Show first request only; no login/network
  --help                      Show usage
Uses the local login.js account. Prints one full JSON response per page.`);
    return;
  }
  if (cli.dryRun) {
    output(JSON.stringify(buildExploreRequest('<signed-in-uid>', cli.options), null, 2));
    return;
  }
  const auth = dependencies.auth || localAuth();
  const { session } = await auth.login();
  let options = cli.options;
  for (let i = 0; i < cli.pages && options; i++) {
    const result = await getExplore(session, options, auth.requestOla);
    output(JSON.stringify({ tab: result.tab, page: result.page, count: result.items.length,
      next: result.next, response: result.raw }));
    options = result.next;
  }
}

module.exports = { buildExploreRequest, getExplore, getExploreOnline, getExploreVerified, getExploreAvatar, parseCli, main };
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
