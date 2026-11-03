import { createHash } from 'node:crypto';

export interface SignInput {
  token?: string;
  key2: string;
  deviceId: string;
  appVersion: string;
  /** Unix seconds: server time for API calls, local time for getTimes itself. */
  timestamp: number;
  requestPath: string;
}

// ApiClient request interceptor, app 27.7.8: the hash covers only the last path
// segment, so query parameters can be appended after signing.
export function olaHeaders({ token, key2, deviceId, appVersion, timestamp, requestPath }: SignInput): Record<string, string> {
  const slash = requestPath.lastIndexOf('/');
  const suffix = slash < 0 ? '' : requestPath.slice(slash);
  // UTF8 -> MD5 -> lowercase hex.
  const hash = createHash('md5').update(`${timestamp - 888}${deviceId}${suffix}`, 'utf8').digest('hex');
  return {
    key2, deviceid: deviceId, os: 'android', ver: appVersion,
    timestamp: String(timestamp), hash,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** One path segment: [A-Za-z0-9_.-], never "." or ".." (fetch would normalize those away). */
export function isPathSegment(part: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(part) && !/^\.+$/.test(part);
}

// napi/... or faApi2/... made of valid segments, so the request (and its
// signature) cannot end up at a different path.
export function assertApiPath(path: string): string {
  const [root, ...rest] = path.split('/');
  const ok = (root === 'napi' || root === 'faApi2') && rest.length > 0 && rest.every(isPathSegment);
  if (!ok) throw new Error(`Invalid Ola API path: ${JSON.stringify(path)}.`);
  return path;
}
