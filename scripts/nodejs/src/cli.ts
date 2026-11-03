// `ola` CLI: one subcommand per endpoint, flags generated from its fields.
//
//   node ola.ts list
//   node ola.ts addCoins3 --help
//   node ola.ts getPostByID --postID 123 --dry-run
//
// Flags are the field names exactly as they go on the wire. Values are parsed to
// whatever the field accepts (string, number, boolean, JSON). Input is validated
// with a stand-in account before any login or network call.

import { Command, Option } from 'commander';
import { z } from 'zod';
import type { OlaClient } from './client.ts';
import { envDryRunSession, loginFromEnv } from './node.ts';
import { InputError, type AnyEndpoint, type JsonObject } from './endpoint.ts';
import { endpoints } from './endpoints/index.ts';

export interface CliDeps {
  output?: (line: string) => void;
  login?: () => Promise<Pick<OlaClient, 'call' | 'close'>>;
  endpoints?: Readonly<Record<string, AnyEndpoint>>;
}

const RESERVED = new Set(['json', 'dryRun', 'help']);

interface JsonSchemaProp {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaProp[];
  default?: unknown;
}

export function buildProgram({
  output = console.log,
  login = () => loginFromEnv(),
  endpoints: registry = endpoints as unknown as Record<string, AnyEndpoint>,
}: CliDeps = {}): Command {
  const program = new Command('ola')
    .description('Gọi Ola API bằng tài khoản trong scripts/nodejs/.env')
    .showHelpAfterError()
    .exitOverride();

  program.command('list')
    .description('Liệt kê các endpoint')
    .action(() => {
      for (const ep of Object.values(registry)) {
        output(`${ep.name.padEnd(24)} ${ep.method.padEnd(7)} ${ep.mutates ? 'MUTATE ' : '       '}${ep.path}  — ${ep.summary}`);
      }
    });

  for (const ep of Object.values(registry)) addEndpointCommand(program, ep, { output, login });
  return program;
}

export async function main(argv = process.argv.slice(2), deps: CliDeps = {}): Promise<void> {
  await buildProgram(deps).parseAsync(argv, { from: 'user' });
}

function addEndpointCommand(program: Command, ep: AnyEndpoint, { output, login }: Required<Pick<CliDeps, 'output' | 'login'>>) {
  const shape = ep.schema.shape as Record<string, z.ZodType>;
  const json = z.toJSONSchema(ep.schema, { io: 'input', unrepresentable: 'any' }) as {
    properties?: Record<string, JsonSchemaProp>;
    required?: string[];
  };
  const command = program.command(ep.name)
    .description(`${ep.mutates ? '[MUTATE] ' : ''}${ep.summary}\n${ep.method} ${ep.path}`);

  // field -> commander's key in opts() (it camel-cases dashed names: content-type -> contentType).
  const optionKeys = new Map<string, string>();
  for (const [field, prop] of Object.entries(json.properties ?? {})) {
    const fromSession = ep.sessionFields[field];
    const notes = [
      prop.description,
      typeLabel(prop),
      fromSession ? `mặc định: session.${fromSession}`
        : prop.default !== undefined ? `mặc định: ${JSON.stringify(prop.default)}`
          : json.required?.includes(field) ? 'bắt buộc' : undefined,
    ];
    // Fields that accept `true` (booleans, scalars) also work as a bare flag.
    const flag = shape[field]!.safeParse(true).success ? `--${field} [value]` : `--${field} <value>`;
    const option = new Option(flag, notes.filter(Boolean).join(' · '));
    const key = option.attributeName();
    if (RESERVED.has(key) || [...optionKeys.values()].includes(key)) {
      throw new Error(`${ep.name}: field "${field}" clashes with another CLI option.`);
    }
    optionKeys.set(field, key);
    command.addOption(option);
  }
  command
    .option('--json <object>', 'Input dạng JSON object, gộp với các cờ (cờ thắng)')
    .option('--dry-run', 'Chỉ in request sẽ ký và gửi; không đăng nhập, không gọi mạng')
    .action(async (opts: Record<string, unknown>) => {
      const input: JsonObject = opts.json === undefined ? {} : parseJsonObject(String(opts.json));
      for (const [field, key] of optionKeys) {
        const raw = opts[key];
        if (raw !== undefined) input[field] = cliValue(shape[field]!, raw as string | true);
      }
      // Validate before login so a typo costs no sign-in and no users/sync.
      const preview = ep.build(envDryRunSession(), input);
      if (opts.dryRun) {
        output(JSON.stringify(preview, null, 2));
        return;
      }
      const client = await login();
      try {
        output(JSON.stringify(await client.call(ep as never, input as never), null, 2));
      } finally {
        await client.close();
      }
    });
}

// Keep the first candidate the field accepts: true/false as booleans first (so
// `--delAll false` never sends the truthy string "false"), then the raw string,
// then number / JSON (null, objects, arrays). Unparseable values go through as
// strings so the schema reports the error. Use --json to send a literal "false".
export function cliValue(field: z.ZodType, raw: string | true): unknown {
  if (raw === true) return true;
  const candidates: unknown[] = raw === 'true' || raw === 'false' ? [raw === 'true', raw] : [raw];
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) candidates.push(Number(raw));
  try { candidates.push(JSON.parse(raw)); } catch { /* not JSON */ }
  const index = candidates.findIndex(candidate => field.safeParse(candidate).success);
  return index < 0 ? raw : candidates[index];
}

function parseJsonObject(raw: string): JsonObject {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new InputError('--json must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('--json must be a JSON object.');
  return value as JsonObject;
}

function typeLabel(prop: JsonSchemaProp): string | undefined {
  if (prop.enum) return prop.enum.map(v => JSON.stringify(v)).join(' | ');
  if (prop.const !== undefined) return JSON.stringify(prop.const);
  if (prop.anyOf) return prop.anyOf.map(typeLabel).filter(Boolean).join(' | ');
  return Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type;
}
