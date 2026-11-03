// defineEndpoint(): one declaration per Ola endpoint.
//
// An endpoint file declares its method, path and fields (as zod schemas). From
// that this module derives everything the old per-file boilerplate did by hand:
// input validation, session defaults (uid -> signed-in account), path params,
// the request body/query, the success-flag check and the CLI (see cli.ts).
//
// build() returns exactly what OlaClient will sign and send, which is what
// --dry-run prints and what the golden tests compare. It is deterministic except
// for values an endpoint generates per send (e.g. a message id from Date.now()).

import { z } from 'zod';
import { isPathSegment } from './signing.ts';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type JsonObject = Record<string, unknown>;

export interface OlaRequest {
  method: HttpMethod;
  path: string;
  body?: JsonObject;
  query?: JsonObject;
}

/** What an endpoint can default from: the signed-in account and this device. */
export interface SessionInfo {
  localId: string;
  email?: string | null;
  /** Signed as the `deviceid` header (OlaClient fills these from its config). */
  deviceId?: string;
  androidVersion?: string;
}

/** Stand-in account for --dry-run and validation before login (see dryRunSession()). */
export const DRY_RUN_SESSION: SessionInfo = { localId: 'SIGNED_IN_UID', email: 'signed-in@example.invalid' };

/** Response field that reports failure when it is explicitly false; false skips the check. */
export type SuccessFlag = 'is_success' | 'success' | false;

type Shape = z.ZodRawShape;
type Schema<F extends Shape> = z.ZodObject<F, z.core.$strict>;
export type InputOf<F extends Shape> = z.input<Schema<F>>;
export type ValueOf<F extends Shape> = z.output<Schema<F>>;
type SessionKey = keyof SessionInfo;
type SessionDefaults<F extends Shape> = { [K in keyof F]?: SessionKey };

export interface EndpointSpec<F extends Shape, D extends SessionDefaults<F>, R> {
  name: string;
  /** One line for `ola list` and --help. */
  summary: string;
  method: HttpMethod | ((value: ValueOf<F>) => HttpMethod);
  /**
   * API path. `/:field` segments are filled from the input and left out of the
   * body/query; `/:field?` is dropped when the field is not given.
   */
  path: string;
  /** Changes server state (sends, deletes, buys, ...). Shown in `ola list`. */
  mutates?: boolean;
  /**
   * Every accepted input field; unknown keys are rejected. A field named `extra`
   * (see extraFields()) is spread into the body and may not reuse a declared name.
   */
  fields: F;
  /** Fields that default to the signed-in account, e.g. { uid: 'localId' }. */
  session?: D;
  /** Cross-field rules; throw an Error to reject the input. */
  validate?: (value: ValueOf<F>) => void;
  /** Custom body/query when the request is not a 1:1 copy of the fields. */
  request?: (value: ValueOf<F>) => { body?: JsonObject; query?: JsonObject };
  /** Defaults to 'is_success' for faApi2/ paths and 'success' for napi/ paths. */
  success?: SuccessFlag;
  /** Turns the raw response into the endpoint's result (default: the raw JSON). */
  parse?: (raw: unknown, request: OlaRequest) => R;
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Input a caller passes: the fields, with session-defaulted ones optional. */
export type CallInput<F extends Shape, D> = Simplify<
  Omit<InputOf<F>, keyof D> & Partial<Pick<InputOf<F>, Extract<keyof D, keyof InputOf<F>>>>
>;

/** Makes the input argument optional when no field is required. */
export type InputArgs<I> = {} extends I ? [input?: I] : [input: I];

export interface Endpoint<F extends Shape = Shape, D = {}, R = unknown> {
  readonly name: string;
  readonly summary: string;
  /** Fixed method, or 'dynamic' when the input picks it. */
  readonly method: HttpMethod | 'dynamic';
  readonly path: string;
  readonly mutates: boolean;
  readonly schema: Schema<F>;
  readonly sessionFields: Readonly<Record<string, SessionKey | undefined>>;
  /** Validates the input and returns the exact request that would be signed and sent. */
  build(session: SessionInfo, ...input: InputArgs<CallInput<F, D>>): OlaRequest;
  /** Applies the success-flag check, then parse(). */
  handle(raw: unknown, request: OlaRequest): R;
}

/** The view of an endpoint that generic code (CLI, registry, tests) works with. */
export interface AnyEndpoint {
  readonly name: string;
  readonly summary: string;
  readonly method: HttpMethod | 'dynamic';
  readonly path: string;
  readonly mutates: boolean;
  readonly schema: z.ZodObject;
  readonly sessionFields: Readonly<Record<string, SessionKey | undefined>>;
  build(session: SessionInfo, input?: JsonObject): OlaRequest;
  handle(raw: unknown, request: OlaRequest): unknown;
}

// ---- errors -----------------------------------------------------------------

/** The input was rejected before anything was sent. */
export class InputError extends Error {
  override name = 'InputError';
}

/** The server answered, but reported failure. `response` holds the raw JSON. */
export class ApiError extends Error {
  override name = 'ApiError';
  readonly response: unknown;
  constructor(message: string, response: unknown) {
    super(message);
    this.response = response;
  }
}

// ---- field helpers ----------------------------------------------------------

const FAILED = [false, 0, '0', 'false'];

/** Non-empty string; whitespace-only is rejected, the value is sent untrimmed. */
export const text = () => z.string().regex(/\S/, 'must be a non-empty string');

/** Non-negative safe integer. */
export const int = () => z.int().nonnegative();

/** A non-empty string or a safe integer, for IDs the app sends either way. */
export const identifier = () => z.union([text(), z.int()]);

/** string | number | boolean, for fields whose wire type varies by call site. */
export const scalar = () => z.union([z.string(), z.number(), z.boolean()]);

/** A dynamic path segment: [A-Za-z0-9_.-], never "." or "..". */
export const segment = () => z.string()
  .refine(isPathSegment, 'must contain only [A-Za-z0-9_.-] and not be "." or ".."');

/** Free-form scalar flags spread into the body (name the field `extra`). */
export const extraFields = () => z.record(text(), scalar()).optional()
  .describe('Cờ phụ { tên: scalar } gộp vào body; không được trùng tên field đã khai báo');

/** Rejects input that sets more than one of `keys`; with `required`, exactly one. */
export function oneOf(value: JsonObject, keys: readonly string[], { required = false } = {}): void {
  const given = keys.filter(key => value[key] !== undefined);
  if (given.length > 1) throw new InputError(`${given.join(' and ')} cannot be used together.`);
  if (required && given.length === 0) throw new InputError(`Provide one of: ${keys.join(', ')}.`);
}

// ---- defineEndpoint ---------------------------------------------------------

const PATH_PARAM = /\/:([A-Za-z_][A-Za-z0-9_]*)(\?)?/g;

// Defense in depth for path params declared without segment().
function pathSegment(name: string, param: string, value: unknown): string {
  const part = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof part !== 'string' || !isPathSegment(part)) {
    throw new InputError(`${name}: ${param} must be a path segment of [A-Za-z0-9_.-], not "." or "..".`);
  }
  return part;
}

function definedOnly(object: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export function defineEndpoint<F extends Shape, const D extends SessionDefaults<F> = {}, R = unknown>(
  spec: EndpointSpec<F, D, R>,
): Endpoint<F, D, R> {
  const { name } = spec;
  const schema = z.strictObject(spec.fields);
  const params = [...spec.path.matchAll(PATH_PARAM)].map(match => match[1]!);
  for (const param of params) {
    if (!Object.hasOwn(spec.fields, param)) throw new Error(`${name}: path param :${param} has no matching field.`);
  }
  const sessionFields: Record<string, SessionKey | undefined> = { ...spec.session };
  const success = spec.success ?? (spec.path.startsWith('faApi2/') ? 'is_success' : 'success');

  function build(session: SessionInfo, input: JsonObject = {}): OlaRequest {
    const merged: JsonObject = {};
    for (const [field, key] of Object.entries(sessionFields)) {
      if (key) merged[field] = session[key] ?? undefined;
    }
    Object.assign(merged, definedOnly(input));
    const parsed = schema.safeParse(merged);
    if (!parsed.success) throw new InputError(`${name}: ${z.prettifyError(parsed.error)}`);
    const value = parsed.data as ValueOf<F> & JsonObject;
    try {
      spec.validate?.(value);
    } catch (error) {
      throw new InputError(`${name}: ${(error as Error).message}`);
    }

    const method = typeof spec.method === 'function' ? spec.method(value) : spec.method;
    const path = spec.path.replace(PATH_PARAM, (_, param: string, optional?: string) =>
      (optional && value[param] === undefined ? '' : `/${pathSegment(name, param, value[param])}`));
    if (spec.request) {
      const { body, query } = spec.request(value);
      return {
        method, path,
        ...(body !== undefined && { body: definedOnly(body) }),
        ...(query !== undefined && { query: definedOnly(query) }),
      };
    }

    const { extra, ...fields } = value;
    const rest = definedOnly(fields);
    for (const param of params) delete rest[param];
    if (extra !== undefined) {
      if (method === 'GET') throw new Error(`${name}: extra is only supported for body requests.`);
      const clash = Object.keys(extra as JsonObject).filter(key => Object.hasOwn(spec.fields, key));
      if (clash.length) throw new InputError(`${name}: extra may not set declared field(s) ${clash.join(', ')}.`);
      Object.assign(rest, extra);
    }
    return method === 'GET' ? { method, path, query: rest } : { method, path, body: rest };
  }

  function handle(raw: unknown, request: OlaRequest): R {
    if (success && raw && typeof raw === 'object' && FAILED.includes((raw as JsonObject)[success] as never)) {
      throw new ApiError(`${request.path}: API reported ${success}=false.`, raw);
    }
    return spec.parse ? spec.parse(raw, request) : (raw as R);
  }

  return {
    name, summary: spec.summary, path: spec.path, mutates: spec.mutates ?? false,
    method: typeof spec.method === 'function' ? 'dynamic' : spec.method,
    schema, sessionFields,
    build: build as Endpoint<F, D, R>['build'],
    handle,
  };
}
