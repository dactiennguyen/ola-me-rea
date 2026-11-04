// Shared definition of the three Khám phá (Explore) tabs. Each tab is its own
// endpoint file; they differ only in path, `condition` and the online cursor.
// Flow + paging: ../../../../docs/api/luong-kham-pha.md

import { z } from 'zod';
import { ApiError, defineEndpoint, int, text, type JsonObject, type OlaRequest } from '../endpoint.ts';

export type ExploreTab = 'online' | 'verified' | 'avatar';

/** Input for the next page; pass it back to the same endpoint. */
export interface ExploreNext {
  uid: string;
  page: number;
  gender?: 0 | 1 | 2;
  cityID?: string;
  lastSeenPaging?: number;
}

export interface ExploreResult {
  tab: ExploreTab;
  page: number;
  items: unknown[];
  next: ExploreNext | null;
  raw: JsonObject;
}

const CONDITION: Record<ExploreTab, number | undefined> = { online: 2, verified: 1, avatar: undefined };

export function defineExplore(spec: { name: string; summary: string; path: string; tab: ExploreTab }) {
  const { tab } = spec;
  return defineEndpoint({
    ...spec,
    method: 'POST',
    session: { uid: 'localId' },
    fields: {
      uid: text().describe('Người đang xem'),
      page: int().default(0).describe('Trang, bắt đầu từ 0'),
      gender: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal('all')]).optional()
        .describe('0 nữ | 1 nam | 2 LGBT | all (mặc định)'),
      cityID: z.string().regex(/^(?:[1-9]\d*|all|)$/, 'must be a positive decimal string or all').optional()
        .describe('ID tỉnh/thành của app, vd 1 = Hà Nội; all = tất cả'),
      lastSeenPaging: int().optional().describe('Cursor từ response trước (chỉ tab Online)'),
    },
    validate(value) {
      if (value.page === Number.MAX_SAFE_INTEGER) throw new Error('page is too large to advance.');
      if (tab !== 'online' && value.lastSeenPaging !== undefined) {
        throw new Error('lastSeenPaging is only used by the online tab.');
      }
      if (tab === 'online' && value.page > 0 && value.lastSeenPaging === undefined) {
        throw new Error('Online page > 0 requires lastSeenPaging from the previous response.');
      }
    },
    request({ uid, page, gender, cityID, lastSeenPaging }) {
      const body: JsonObject = { uid, os: 'android', page, condition: CONDITION[tab] };
      if (gender !== undefined && gender !== 'all') body.gender = gender;
      if (cityID !== undefined && cityID !== '' && cityID !== 'all') body.cityID = cityID;
      if (tab === 'online') body.lastSeenPaging = lastSeenPaging ?? 0;
      return { body };
    },
    // is_success is checked in exploreResult: false with an empty list means no match.
    success: false,
    parse: (raw, request) => exploreResult(tab, raw, request),
  });
}

const FAILED: unknown[] = [false, 0, '0', 'false'];

function exploreResult(tab: ExploreTab, raw: unknown, request: OlaRequest): ExploreResult {
  const data = raw as JsonObject;
  // A filter nobody matches comes back as {is_success:false, message:"", list_data:[]}
  // (seen on the wire 2026-11-04, Ảnh có mặt + LGBT + one province); the app shows
  // "Không tìm thấy người dùng nào". Only that shape is an empty result.
  if (FAILED.includes(data?.is_success)) {
    const empty = Array.isArray(data.list_data) && data.list_data.length === 0;
    if (!empty) throw new ApiError(`${request.path}: API reported is_success=false.`, raw);
  }
  if (!Array.isArray(data?.list_data)) throw new Error(`${request.path}: expected list_data array.`);
  const body = request.body!;
  const page = body.page as number;
  let next: ExploreNext | null = null;
  if (data.list_data.length) {
    // Keep the viewer: a caller-supplied uid must not fall back to the session on page 2.
    next = { uid: body.uid as string, page: page + 1 };
    if (body.gender !== undefined) next.gender = body.gender as 0 | 1 | 2;
    if (body.cityID !== undefined) next.cityID = body.cityID as string;
    if (tab === 'online') {
      const cursor = data.lastSeenPaging;
      if (!Number.isSafeInteger(cursor) || (cursor as number) < 0) {
        throw new Error('response.lastSeenPaging must be a non-negative safe integer.');
      }
      next.lastSeenPaging = cursor as number;
    }
  }
  return { tab, page, items: data.list_data, next, raw: data };
}
