/*
 * Ola API logger — Dart-layer hook on Dio (com.olaachat 27.7.8 / vc405, Dart 3.10, arm64).
 *
 * Layout verified by hexdump on device (probe_v7.js). dae's frida.js Classes table is
 * off by 4 bytes because it assumes a 4-byte object header; real header is 8 bytes:
 *   _OneByteString (94): len Smi @+8,  data @+16
 *   _TwoByteString (95): len Smi @+8,  data @+16
 *   _List (90)/_ImmutableList (91): typeArgs @+8, len Smi @+12, data @+16
 *   _GrowableList (92): typeArgs @+8, len Smi @+12, backing _List @+16
 *   _Map (86)/_ConstMap (87): typeArgs @+8, hashMask @+12, data @+16, used Smi @+20
 *   _CompactLinkedCustomHashMap (6322, Dio's case-insensitive header map): data _List @+0x14
 * Instance-field offsets from text/fields.txt are correct as-is.
 *
 * Dart AOT passes args on the Dart stack (x15), last arg at [x15+0].
 * Heap base = x28 << 32 (x28 = write_barrier_mask<<32 | heap_base>>32).
 *
 * Redaction policy (docs/03-api-calls-and-hooks.md): Authorization / cookie / token /
 * password values are never printed.
 */
'use strict';

var OFF = {
    post: 0x6d4d80, get: 0x932898, put: 0xb0c93c, del: 0xabd670,
    request: 0x6d4ebc, fetch: 0x6d4fec, dispatch: 0x6d87a4,
    exploreResponse: 0x9910f0,  // ExploreProvider.fetchData, after `await dio.post`
    // socket_io_common / socket_io_client — hooked at the wire-text level (see Socket.IO section)
    sioEncode: 0x7cd740, sioDecode: 0x7daf78, sioUri: 0x7d67f8
};

var CID = {
    Null: 171, Smi: 60, Mint: 61, Double: 62, Bool: 63, Closure: 57,
    Str: 94, Str2: 95, List: 90, ImmList: 91, GList: 92, Map: 86, ConstMap: 87,
    Response: 5400, RequestOptions: 5404, Options: 5406, BaseOptions: 5405,
    MultipartFile: 5408, FormData: 5410, CancelToken: 5427, DioForNative: 5424,
    SioSocket: 451, SioManager: 452,
    CustomMap: 6322
};
var CID_NAME = {};
Object.keys(CID).forEach(function (k) { CID_NAME[CID[k]] = k; });

/* RequestOptions fields (inherited from _RequestConfig / OptionsMixin) */
var RO = { method: 0x8, headers: 0xc, extra: 0x2c, baseUrl: 0x48, query: 0x4c };

var libapp = null;
var HEAP = ptr(0);
var MAX_DEPTH = 4;

/* ---------- primitives ---------- */
function initHeap(ctx) {
    if (HEAP.isNull()) HEAP = ctx.x28.shl(32);
}
function isHeapObj(v) { return (v.toInt32() & 1) === 1; }
function untag(v) { return HEAP.add(v.toInt32() >>> 0).sub(1); }  // raw object address
function cidOf(p) { return (p.readU32() >>> 12) & 0xfffff; }
function smi(p) { return p.readS32() >> 1; }
function field(p, off) { return p.add(off).readU32(); }  // compressed pointer as u32

function decodeCompressed(u32, depth) {
    // u32 is a compressed pointer read from an object field
    return decode(ptr(u32), depth);
}

function decode(v, depth) {
    if (depth === undefined) depth = MAX_DEPTH;
    // Dart Smi(0) is the zero pointer; Dart null is a tagged heap object (CID.Null).
    if (v.isNull()) return 0;
    if (!isHeapObj(v)) return v.toInt32() >> 1;            // Smi
    var p;
    try { p = untag(v); } catch (e) { return '<bad ptr>'; }
    var cid;
    try { cid = cidOf(p); } catch (e) { return '<unreadable>'; }
    try {
        switch (cid) {
        case CID.Null: return null;
        case CID.Bool: return p.add(8).readU8() !== 0;
        case CID.Mint: {
            var integerText = p.add(8).readS64().toString();
            var integer = Number(integerText);
            return Number.isSafeInteger(integer) ? integer : integerText;
        }
        case CID.Double: return p.add(8).readDouble();
        case CID.Str: {
            var n = smi(p.add(8));
            if (n < 0 || n > 65536) return '<str len ' + n + '>';
            return p.add(16).readUtf8String(Math.min(n, 4096));
        }
        case CID.Str2: {
            var m = smi(p.add(8));
            if (m < 0 || m > 65536) return '<str2 len ' + m + '>';
            return p.add(16).readUtf16String(Math.min(m, 4096));
        }
        case CID.List: case CID.ImmList:
            return depth <= 0 ? '<List>' : readArray(p.add(16), smi(p.add(12)), depth);
        case CID.GList: {
            if (depth <= 0) return '<List>';
            var len = smi(p.add(12));
            var back = untag(ptr(field(p, 16)));
            return readArray(back.add(16), len, depth);
        }
        case CID.Map: case CID.ConstMap:
            return depth <= 0 ? '<Map>' : readMap(p, depth);
        case CID.CustomMap:
            return depth <= 0 ? '<Map>' : readCustomMap(p, depth);
        case CID.Closure: return '<Closure>';
        case CID.FormData: return depth <= 0 ? '<FormData>' : readFormData(p, depth);
        case CID.MultipartFile: return '<MultipartFile>';
        }
    } catch (e) { return '<err ' + e.message + '>'; }
    return '<' + (CID_NAME[cid] || ('cid' + cid)) + '>';
}

function readArray(data, len, depth) {
    if (len < 0 || len > 1024) return '<len ' + len + '>';
    var out = [];
    for (var i = 0; i < Math.min(len, 64); i++) out.push(decodeCompressed(field(data, i * 4), depth - 1));
    if (len > 64) out.push('…+' + (len - 64));
    return out;
}

function readMap(p, depth) {
    var used = smi(p.add(20));
    if (used < 0 || used > 2048) return '<map used ' + used + '>';
    var dv = field(p, 16);
    if ((dv & 1) === 0) return {};
    var arr = untag(ptr(dv));
    var base = arr.add(16);
    var out = {};
    for (var i = 0; i + 1 < used; i += 2) {
        var k = decodeCompressed(field(base, i * 4), depth - 1);
        var v = decodeCompressed(field(base, (i + 1) * 4), depth - 1);
        if (k === null && v === null) continue;  // deleted slot
        out[String(k)] = v;
    }
    return out;
}

/* Custom-equality LinkedHashMap: key/value pairs in a _List at +0x14; deleted slots are null. */
function readCustomMap(p, depth) {
    var dv = field(p, 0x14);
    if ((dv & 1) === 0) return {};
    var arr = untag(ptr(dv));
    if (cidOf(arr) !== CID.List) return '<custom map?>';
    var len = smi(arr.add(12)), base = arr.add(16), out = {};
    for (var i = 0; i + 1 < Math.min(len, 256); i += 2) {
        var k = decodeCompressed(field(base, i * 4), depth - 1);
        if (k === null) continue;
        out[String(k)] = decodeCompressed(field(base, (i + 1) * 4), depth - 1);
    }
    return out;
}

/* FormData: dio keeps `fields` (List<MapEntry<String,String>>) and `files`.
   Offsets aren't in fields.txt, so scan the first few slots for lists. */
function readFormData(p, depth) {
    var res = {};
    for (var off = 8; off <= 0x20; off += 4) {
        var v = field(p, off);
        if ((v & 1) === 0) continue;
        var d = decodeCompressed(v, depth - 1);
        if (d !== null && typeof d !== 'undefined' && d !== '') res['@' + off.toString(16)] = d;
    }
    return { FormData: res };
}

/* ---------- redaction ---------- */
var SECRET = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|auth[_-]?token|fcm[_-]?token|device[_-]?token|password|pass|passwd|pwd|new_?password|old_?password|otp|pin|secret|signature|sig|session(id)?|key2|hash)$/i;
function scrub(v, key) {
    if (key !== undefined && SECRET.test(String(key))) {
        return (v === null || v === '' ) ? v : '***';
    }
    if (typeof v === 'string') {
        if (/^(Bearer|Basic)\s/i.test(v) || /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\./.test(v)) return '***';
        if (/^[A-Za-z0-9_-]{11,}:APA91b/.test(v)) return '***fcm***';     // FCM registration token
        if (/^[A-Za-z0-9_\-+/=]{80,}$/.test(v)) return '***long-opaque***'; // other opaque secrets
        return v.length > 600 ? v.slice(0, 600) + '…(' + v.length + ')' : v;
    }
    if (v && typeof v === 'object') {
        if (Array.isArray(v)) return v.map(function (x) { return scrub(x); });
        var o = {};
        Object.keys(v).forEach(function (k) { o[k] = scrub(v[k], k); });
        // updatePost.php-style {action:"token", value:<secret>}
        if (typeof v.action === 'string' && SECRET.test(v.action) && 'value' in o) o.value = '***';
        return o;
    }
    return v;
}

/* ---------- RequestOptions ---------- */
var calibrated = 0;
function readRequestOptions(p) {
    var r = {
        method: decodeCompressed(field(p, RO.method), 1),
        baseUrl: decodeCompressed(field(p, RO.baseUrl), 1),
        headers: decodeCompressed(field(p, RO.headers), 3),
        query: decodeCompressed(field(p, RO.query), 3),
        path: null, data: undefined
    };
    // path / data live in RequestOptions' own fields, after OptionsMixin (>0x4c)
    var scan = {};
    for (var off = 0x50; off <= 0x80; off += 4) {
        var raw = field(p, off);
        if (raw === 0) continue;
        var val = decodeCompressed(raw, 3);
        scan[off] = val;
        if (r.path === null && typeof val === 'string' && val !== r.baseUrl &&
            (/^(https?:\/\/|\/)/.test(val) || /^[A-Za-z0-9_\-]+\/[^\s]*$/.test(val) || /\.php(\?|$)/.test(val))) {
            r.path = val; r._pathOff = off;
        }
    }
    if (r._pathOff !== undefined) {
        // `data` is declared right before `path` in dio 5 RequestOptions
        var cand = scan[r._pathOff - 4];
        if (cand !== undefined && !(typeof cand === 'number')) r.data = cand;
    }
    if (calibrated < 2) {
        calibrated++;
        console.log('[calib] RequestOptions fields 0x50..0x80: ' + JSON.stringify(scrub(scan)).slice(0, 1500));
    }
    return r;
}

function joinUrl(base, path) {
    if (!path) return base || '?';
    if (/^https?:\/\//.test(path)) return path;
    if (!base) return path;
    return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/* ---------- reporting ---------- */
var seq = 0;
var distinct = {};

function onFetch(ctx) {
    initHeap(ctx);
    var sp = ctx.x15;
    var ro = null;
    for (var i = 0; i < 4; i++) {
        var v = sp.add(8 * i).readPointer();
        if (!isHeapObj(v)) continue;
        var p = untag(v);
        if (cidOf(p) === CID.RequestOptions) { ro = p; break; }
    }
    if (!ro) return;
    var r = readRequestOptions(ro);
    var url = joinUrl(r.baseUrl, r.path);
    seq++;
    var key = (r.method || '?') + ' ' + url.split('?')[0];
    distinct[key] = (distinct[key] || 0) + 1;

    var lines = ['#' + seq + ' ' + (r.method || '?') + ' ' + url];
    var q = scrub(r.query);
    if (q && typeof q === 'object' && Object.keys(q).length) lines.push('    query: ' + JSON.stringify(q));
    if (r.data !== undefined && r.data !== null && r.data !== '') {
        var d = JSON.stringify(scrub(r.data));
        lines.push('    body : ' + (d.length > 1500 ? d.slice(0, 1500) + '…' : d));
    }
    var h = scrub(r.headers);
    if (h && typeof h === 'object' && Object.keys(h).length) lines.push('    hdrs : ' + JSON.stringify(h));
    console.log(lines.join('\n'));
}

/* _dispatchRequest runs after the interceptor chain, so headers here are what goes on the wire
   (e.g. Authorization added by an interceptor). Only headers not seen at fetch() are printed. */
var STD_HDR = /^(content-type|content-length|accept|user-agent)$/i;
function onDispatch(ctx) {
    initHeap(ctx);
    var sp = ctx.x15, ro = null;
    for (var i = 0; i < 4; i++) {
        var v = sp.add(8 * i).readPointer();
        if (isHeapObj(v) && cidOf(untag(v)) === CID.RequestOptions) { ro = untag(v); break; }
    }
    if (!ro) return;
    var hdrs = decodeCompressed(field(ro, RO.headers), 2);
    if (!hdrs || typeof hdrs !== 'object') return;
    var extra = {};
    Object.keys(hdrs).forEach(function (k) { if (!STD_HDR.test(k)) extra[k] = hdrs[k]; });
    if (!Object.keys(extra).length) return;
    var path = null;
    for (var off = 0x50; off <= 0x80 && path === null; off += 4) {
        var s = decodeCompressed(field(ro, off), 1);
        if (typeof s === 'string' && /\//.test(s) && !/^https?:\/\/[^/]+\/?$/.test(s)) path = s;
    }
    console.log('    ↳ wire hdrs (' + (path || '?') + '): ' + JSON.stringify(scrub(extra)));
}

/* ExploreProvider.fetchData: instruction immediately after awaiting Dio.post.
   27.7.8 arm64 only: x0 is Response; data at raw+0xc, statusCode at raw+0x14.
   Print schema/count/cursor only, never profile values or credentials. */
function onExploreResponse(ctx) {
    initHeap(ctx);
    if (!isHeapObj(ctx.x0)) return;
    var response = untag(ctx.x0);
    if (cidOf(response) !== CID.Response) return;
    var data = decodeCompressed(field(response, 0xc), 5);
    var list = data && data.list_data;
    // readArray keeps 64 items and appends a '…+N' marker string when longer.
    var truncated = Array.isArray(list) && list.length > 64;
    var first = Array.isArray(list) && list.length ? list[0] : null;
    var types = {};
    if (first && typeof first === 'object') Object.keys(first).forEach(function (k) {
        types[k] = first[k] === null ? 'null' : typeof first[k];
    });
    console.log('EXPLORE-RESPONSE ' + JSON.stringify({
        status: decodeCompressed(field(response, 0x14), 1),
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        decodedItems: Array.isArray(list) ? (truncated ? 64 : list.length) : null,
        truncated: truncated,
        lastSeenPaging: data && data.lastSeenPaging,
        firstItemFieldTypes: types
    }));
}

/* ---------- Socket.IO (wire level) ----------
 * Outgoing: Encoder.encodeAsString(packet) returns the wire text  -> hook onLeave, read x0.
 * Incoming: Decoder.decodeString(String)  receives the wire text   -> scan stack for the String.
 * Connect : IOWebSocketTransport.uri() returns ws://host:port/socket.io/?EIO=4&transport=websocket&<query>.
 * Wire format: <type>[<attachments>-][/<nsp>,][<ackId>][<json>]
 */
var SIO_TYPE = { 0: 'CONNECT', 1: 'DISCONNECT', 2: 'EVENT', 3: 'ACK', 4: 'CONNECT_ERROR', 5: 'BINARY_EVENT', 6: 'BINARY_ACK' };
var sioSeq = 0;

function parseWire(w) {
    var m = /^(\d)(?:\d+-)?(\/[^,]*,)?(\d+)?([\s\S]*)$/.exec(w);
    if (!m) return null;
    var r = { type: SIO_TYPE[m[1]] || m[1], nsp: m[2] ? m[2].slice(0, -1) : '/', ack: m[3], payload: null, event: null };
    if (m[4]) { try { r.payload = JSON.parse(m[4]); } catch (e) { r.payload = m[4]; } }
    if ((r.type === 'EVENT' || r.type === 'BINARY_EVENT') && Array.isArray(r.payload) && typeof r.payload[0] === 'string') {
        r.event = r.payload[0];
        r.payload = r.payload.slice(1);
        if (r.payload.length === 1) r.payload = r.payload[0];
        else if (!r.payload.length) r.payload = null;
    }
    return r;
}

function fmtPayload(v) {
    var s = JSON.stringify(scrub(v));
    if (s === undefined) s = String(v);
    return s.length > 800 ? s.slice(0, 800) + '…' : s;
}

function logWire(dir, w) {
    if (typeof w !== 'string') return;
    var r = parseWire(w);
    if (!r) return;
    var name = r.event || r.type;
    sioSeq++;
    var line = 'S' + sioSeq + ' SIO-' + dir + (r.nsp !== '/' ? ' [' + r.nsp + ']' : '') + ' ' + name +
        (r.ack ? ' (ack#' + r.ack + ')' : '');
    if (r.payload !== null && r.payload !== '') line += '\n    data : ' + fmtPayload(r.payload);
    console.log(line);
    var key = 'SIO-' + dir + ' ' + (r.event || r.type);
    distinct[key] = (distinct[key] || 0) + 1;
}

function stackString(ctx, maxSlots) {
    for (var i = 0; i < maxSlots; i++) {
        var v = ctx.x15.add(8 * i).readPointer();
        if (!isHeapObj(v)) continue;
        var c = cidOf(untag(v));
        if (c === CID.Str || c === CID.Str2) return decode(v, 1);
    }
    return null;
}

function redactUrl(u) {
    return typeof u === 'string'
        ? u.replace(/([?&](?:token|access_token|auth|key|sig|signature)=)[^&]*/gi, '$1***') : u;
}

function onSioIn(ctx) { initHeap(ctx); logWire('IN ', stackString(ctx, 4)); }
function onSioOutLeave(ctx) { initHeap(ctx); logWire('OUT', decode(ctx.x0, 1)); }
function onSioUriLeave(ctx) {
    initHeap(ctx);
    var u = decode(ctx.x0, 1);
    if (typeof u !== 'string') return;
    sioSeq++;
    console.log('S' + sioSeq + ' SIO-CONNECT ' + redactUrl(u));
    var key = 'SIO-CONNECT ' + u.split('?')[0];
    distinct[key] = (distinct[key] || 0) + 1;
}

function hook(off, label, fn) {
    try {
        Interceptor.attach(libapp.base.add(off), {
            onEnter: function () { try { fn(this.context); } catch (e) { console.log('[!] ' + label + ': ' + e.message); } }
        });
        console.log('[+] ' + label + ' @ ' + libapp.base.add(off));
    } catch (e) { console.log('[!] attach ' + label + ': ' + e.message); }
}

function hookLeave(off, label, fn) {
    try {
        Interceptor.attach(libapp.base.add(off), {
            onLeave: function () { try { fn(this.context); } catch (e) { console.log('[!] ' + label + ': ' + e.message); } }
        });
        console.log('[+] ' + label + ' (onLeave) @ ' + libapp.base.add(off));
    } catch (e) { console.log('[!] attach ' + label + ': ' + e.message); }
}

function waitFor(n) {
    var m = Process.findModuleByName('libapp.so');
    if (m) {
        libapp = m;
        console.log('[*] libapp.so base=' + m.base);
        hook(OFF.fetch, 'DioMixin.fetch', onFetch);
        hook(OFF.dispatch, 'DioMixin._dispatchRequest', onDispatch);
        hook(OFF.exploreResponse, 'ExploreProvider.fetchData response schema', onExploreResponse);
        hookLeave(OFF.sioEncode, 'Encoder.encodeAsString', onSioOutLeave);
        hook(OFF.sioDecode, 'Decoder.decodeString', onSioIn);
        hookLeave(OFF.sioUri, 'IOWebSocketTransport.uri', onSioUriLeave);
        console.log('[*] armed — use the app; Dio requests (#n) and Socket.IO frames (Sn) are printed');
        return;
    }
    if (n > 400) { console.log('[!] libapp.so never loaded'); return; }
    setTimeout(function () { waitFor(n + 1); }, 250);
}
waitFor(0);

rpc.exports = {
    summary: function () { return distinct; }
};
setInterval(function () {
    var k = Object.keys(distinct);
    if (!k.length) return;
    console.log('[=] ' + seq + ' requests, ' + k.length + ' distinct endpoints:\n    ' + k.sort().join('\n    '));
}, 45000);
