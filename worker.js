import {acceptedConverterVersions} from "./static/converter-version.js";

const keyPattern = /^[a-f0-9]{64}$/;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Theme-Name",
  "Access-Control-Expose-Headers": "X-Theme-Name",
};
const apkType = "application/vnd.android.package-archive";
const themeType = "application/zip";
const maxBodySize = 64 * 1024 * 1024;

function responseHeaders(extra = {}) {
  return {...corsHeaders, ...extra};
}

// 공유 링크가 가리키는 원본 .ktheme과 변환 결과 APK를 같은 hash key로 보관한다.
// 방문자는 .ktheme만 받아도 브라우저에서 직접 변환할 수 있다.
const buckets = {
  "shared-cache": {objectKey: key => `signed/${key}.apk`, contentType: apkType},
  "shared-theme": {objectKey: key => `theme/${key}.ktheme`, contentType: themeType},
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: responseHeaders({"Content-Type": "application/json", "Cache-Control": "no-store"}),
});

// R2 무료 등급(저장 10GB, Class A 100만/월) 안에서만 돌게 상한을 코드에 박는다.
// Cloudflare에는 지출 하드 캡이 없어서 넘기지 않는 책임이 이쪽에 있다.
// 상한에 닿으면 쓰기를 멈추고 읽기만 계속한다 — 다운로드 자체는 안 막힌다.
const budget = {
  storageBytes: 8 * 1024 * 1024 * 1024,
  monthlyWrites: 600000,
  // 쓰기 카운터를 매 요청마다 갱신하면 그 갱신이 또 Class A다. 표본으로 센다.
  writeSampleRate: 50,
  cacheTtlMs: 60000,
};
let writeStateCache = {monthKey: "", exhausted: false, checkedAt: 0};
// 예산 판정을 60초 캐시하므로 테스트에서 예산을 갈아끼울 때 이걸 비운다.
const resetBudgetCache = () => { writeStateCache = {monthKey: "", exhausted: false, checkedAt: 0}; };

const monthKey = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const previousMonthKey = date => monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));

async function readJson(env, objectKey) {
  const object = await env.KTHEME_CACHE.get(objectKey);
  if (!object) return null;
  return object.json().catch(() => null);
}

// lifecycle 규칙이 오래된 객체를 지우므로 누적 카운터는 시간이 지나면 실제보다
// 커진다. 월별로 나눠 두고 보존 기간에 걸친 달만 더해서 그 어긋남을 없앤다.
async function storedBytes(env, now) {
  const keys = [`budget/storage-${monthKey(now)}.json`, `budget/storage-${previousMonthKey(now)}.json`];
  const records = await Promise.all(keys.map(key => readJson(env, key)));
  return records.reduce((sum, record) => sum + (record?.bytes || 0), 0);
}

async function addStoredBytes(env, now, delta) {
  const objectKey = `budget/storage-${monthKey(now)}.json`;
  const record = await readJson(env, objectKey);
  const next = {bytes: (record?.bytes || 0) + delta, objects: (record?.objects || 0) + 1, updatedAt: now.toISOString()};
  await env.KTHEME_CACHE.put(objectKey, JSON.stringify(next), {httpMetadata: {contentType: "application/json"}});
}

async function writesExhausted(env, now) {
  const key = monthKey(now);
  if (writeStateCache.monthKey === key && now.getTime() - writeStateCache.checkedAt < budget.cacheTtlMs) {
    return writeStateCache.exhausted;
  }
  const record = await readJson(env, `budget/writes-${key}.json`);
  const exhausted = (record?.writes || 0) >= budget.monthlyWrites;
  writeStateCache = {monthKey: key, exhausted, checkedAt: now.getTime()};
  return exhausted;
}

async function noteWrites(env, now, count) {
  // 표본이라 실제 쓰기 수보다 최대 writeSampleRate만큼 어긋난다. 예산이
  // 무료 한도보다 40만 낮게 잡혀 있어서 그 오차는 과금까지 가지 않는다.
  if (Math.floor(Math.random() * budget.writeSampleRate) !== 0) return;
  const objectKey = `budget/writes-${monthKey(now)}.json`;
  const record = await readJson(env, objectKey);
  const writes = (record?.writes || 0) + count * budget.writeSampleRate;
  await env.KTHEME_CACHE.put(objectKey, JSON.stringify({writes, updatedAt: now.toISOString()}), {httpMetadata: {contentType: "application/json"}});
  writeStateCache = {monthKey: monthKey(now), exhausted: writes >= budget.monthlyWrites, checkedAt: now.getTime()};
}

// 입력 파일 sha256당 전 세계 첫 다운로드만 무료다. 판정은 한 번만 통과해야
// 하므로 조건부 PUT으로 원자성을 얻는다. 런타임이 조건부 쓰기를 모르면 head
// 결과에 의존하고, 그때는 동시 요청 몇 건이 같이 무료로 빠질 수 있다.
async function claimFreeDownload(env, sha, now) {
  const objectKey = `claim/${sha}`;
  if (await env.KTHEME_CACHE.head(objectKey)) return false;
  // 예산이 다했으면 발급하지 않는다. 무료로 열어 주는 쪽이 아니라 광고를 보는
  // 쪽으로 떨어뜨린다 — 상한 때문에 수익 경로가 열리면 상한의 뜻이 뒤집힌다.
  if (await writesExhausted(env, now)) return false;
  const body = JSON.stringify({sha, claimedAt: new Date().toISOString()});
  const options = {httpMetadata: {contentType: "application/json"}};
  try {
    const created = await env.KTHEME_CACHE.put(objectKey, body, {...options, onlyIf: {etagDoesNotMatch: "*"}});
    if (created !== null) await noteWrites(env, now, 1);
    return created !== null;
  } catch {
    await env.KTHEME_CACHE.put(objectKey, body, options);
    await noteWrites(env, now, 1);
    return true;
  }
}

// 테마 이름+SHA별 다운로드 수. 읽고-쓰기라서 동시 요청이 겹치면 몇 건이
// 유실된다. 지표용이라 그 오차를 감수하고, 무료 판정은 위 claim이 따로 든다.
async function bumpDownloadCount(env, sha, name, detail, now) {
  const objectKey = `stats/${sha}.json`;
  const previous = await readJson(env, objectKey);
  if (await writesExhausted(env, now)) return {...(previous || {sha, count: 0}), budgetPaused: true};
  const record = {
    sha,
    name: name || previous?.name || "",
    count: (previous?.count || 0) + 1,
    freeCount: (previous?.freeCount || 0) + (detail.free ? 1 : 0),
    sources: {...(previous?.sources || {}), [detail.source || "unknown"]: ((previous?.sources || {})[detail.source || "unknown"] || 0) + 1},
    outputType: detail.outputType || previous?.outputType || "",
    firstAt: previous?.firstAt || now.toISOString(),
    lastAt: now.toISOString(),
  };
  await env.KTHEME_CACHE.put(objectKey, JSON.stringify(record), {httpMetadata: {contentType: "application/json"}});
  await noteWrites(env, now, 1);
  return record;
}

// ---- PUT 본문 검증 ---------------------------------------------------------
// 검증 없이 받으면 아무나 아무 바이트나 공용 캐시에 밀어 넣을 수 있고, 다음 방문자는
// 그걸 APK 로 받아 간다. 저장 전에 본문이 정말 그 key 의 산출물인지 본다.

const signingBlockMagic = "APK Sig Block 42";
const v2SignatureId = 0x7109871a;
const encoder = new TextEncoder();

// ZIP 은 끝에서부터 읽는다. 중앙 디렉터리 위치가 EOCD 안에 있고, APK 서명 블록도
// 그 위치를 기준으로 붙는다.
function readCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const limit = Math.max(0, bytes.length - 22 - 65535);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= limit; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  const start = view.getUint32(eocd + 16, true);
  if (start >= bytes.length) return null;
  const names = [];
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    names.push(new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return {names, start};
}

// APK 서명 블록은 중앙 디렉터리 바로 앞에 붙고 끝에 고정 magic 을 둔다. 그 안을
// id-value 쌍으로 걸어가 v2 항목이 있는지 본다.
function hasV2Signature(bytes, centralDirectoryStart) {
  if (centralDirectoryStart < 24) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = new TextDecoder().decode(bytes.subarray(centralDirectoryStart - 16, centralDirectoryStart));
  if (magic !== signingBlockMagic) return false;
  const size = Number(view.getBigUint64(centralDirectoryStart - 24, true));
  const blockStart = centralDirectoryStart - size - 8;
  if (blockStart < 0 || Number(view.getBigUint64(blockStart, true)) !== size) return false;
  let cursor = blockStart + 8;
  const end = centralDirectoryStart - 24;
  while (cursor + 12 <= end) {
    const pairLength = Number(view.getBigUint64(cursor, true));
    if (pairLength < 4 || cursor + 8 + pairLength > end + 12) return false;
    if (view.getUint32(cursor + 8, true) === v2SignatureId) return true;
    cursor += 8 + pairLength;
  }
  return false;
}

// base.apk 는 배포된 정적 자산 그대로다. isolate 안에서 한 번만 받아 둔다.
let cachedBaseBytes = null;
// isolate 안에서만 사는 캐시라 배포에서는 비울 일이 없다. 테스트가 바인딩 없는
// 상태를 다시 만들 때 쓴다 — 예산 캐시와 같은 이유다.
const resetBaseCache = () => { cachedBaseBytes = null; };
async function baseBytes(env, request) {
  if (cachedBaseBytes) return cachedBaseBytes;
  if (!env.ASSETS) throw new Error("ASSETS 바인딩이 없어 base.apk 를 읽을 수 없습니다");
  const response = await env.ASSETS.fetch(new URL("/base.apk", request.url));
  if (!response.ok) throw new Error(`base.apk 를 받지 못했습니다 (${response.status})`);
  cachedBaseBytes = new Uint8Array(await response.arrayBuffer());
  return cachedBaseBytes;
}

const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");

// 브라우저가 만드는 캐시 키와 같은 식이다 — sha256(입력 파일 ++ base.apk ++ 변환기 판).
async function derivedCacheKeys(themeBytes, base) {
  const keys = [];
  for (const version of acceptedConverterVersions) {
    const suffix = encoder.encode(version);
    const input = new Uint8Array(themeBytes.length + base.length + suffix.length);
    input.set(themeBytes, 0);
    input.set(base, themeBytes.length);
    input.set(suffix, themeBytes.length + base.length);
    keys.push(hex(await crypto.subtle.digest("SHA-256", input)));
  }
  return keys;
}

async function validatePutBody(env, request, bucketName, key, bytes) {
  const zip = readCentralDirectory(bytes);
  if (!zip) return {ok: false, reason: "ZIP 구조가 아닙니다"};
  if (bucketName === "shared-theme") {
    if (!zip.names.some(name => name.endsWith("KakaoTalkTheme.css"))) return {ok: false, reason: "KakaoTalkTheme.css 가 없습니다"};
    const keys = await derivedCacheKeys(bytes, await baseBytes(env, request));
    if (!keys.includes(key)) return {ok: false, reason: "key 가 본문에서 나온 값이 아닙니다"};
    return {ok: true};
  }
  for (const required of ["AndroidManifest.xml", "resources.arsc"]) {
    if (!zip.names.includes(required)) return {ok: false, reason: `${required} 가 없습니다`};
  }
  if (!hasV2Signature(bytes, zip.start)) return {ok: false, reason: "v2 서명 블록이 없습니다"};
  // APK 의 key 는 입력 테마에서 나오므로 APK 바이트만으로는 되계산할 수 없다. 같은 key 로
  // 이미 검증돼 저장된 원본 테마가 있는지로 대신 묶는다. 브라우저는 테마를 먼저 올린다.
  if (!await env.KTHEME_CACHE.head(buckets["shared-theme"].objectKey(key))) {
    return {ok: false, reason: "같은 key 의 원본 테마가 없습니다"};
  }
  return {ok: true};
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {headers: responseHeaders()});
    const url = new URL(request.url);
    const now = new Date();

    const claim = url.pathname.match(/^\/free-claim\/([a-f0-9]{64})$/);
    if (claim) {
      if (request.method !== "POST") return new Response("Method not allowed", {status: 405, headers: responseHeaders({Allow: "POST, OPTIONS"})});
      return jsonResponse({sha: claim[1], free: await claimFreeDownload(env, claim[1], now)});
    }

    const counter = url.pathname.match(/^\/download-count\/([a-f0-9]{64})$/);
    if (counter) {
      const sha = counter[1];
      const objectKey = `stats/${sha}.json`;
      if (request.method === "GET") {
        const object = await env.KTHEME_CACHE.get(objectKey);
        if (!object) return jsonResponse({sha, count: 0}, 404);
        return jsonResponse(await object.json());
      }
      if (request.method !== "POST") return new Response("Method not allowed", {status: 405, headers: responseHeaders({Allow: "GET, POST, OPTIONS"})});
      const detail = await request.json().catch(() => ({}));
      // 파일명은 클라이언트가 정규화·percent-encoding한 값이다. 그대로 보관한다.
      const name = request.headers.get("X-Theme-Name") || "";
      return jsonResponse(await bumpDownloadCount(env, sha, name, detail, now));
    }

    const match = url.pathname.match(/^\/(shared-cache|shared-theme)\/([a-f0-9]{64})$/);
    if (!match) return new Response("Not found", {status: 404, headers: responseHeaders()});
    if (!keyPattern.test(match[2])) return new Response("Bad cache key", {status: 400, headers: responseHeaders()});

    const bucket = buckets[match[1]];
    const objectKey = bucket.objectKey(match[2]);
    if (request.method === "GET") {
      const object = await env.KTHEME_CACHE.get(objectKey);
      if (!object) return new Response("Cache miss", {status: 404, headers: responseHeaders()});
      const name = object.customMetadata?.name;
      return new Response(object.body, {headers: responseHeaders({
        "Content-Type": bucket.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "HIT",
        ...(name ? {"X-Theme-Name": name} : {}),
      })});
    }
    if (request.method === "PUT") {
      const body = await request.arrayBuffer();
      if (body.byteLength > maxBodySize) return new Response("Body too large", {status: 413, headers: responseHeaders()});
      const existing = await env.KTHEME_CACHE.head(objectKey);
      // 파일명은 HTTP 헤더가 ASCII만 허용하므로 클라이언트가 percent-encoding한 값을 그대로 보관한다.
      const name = request.headers.get("X-Theme-Name") || undefined;
      if (!existing) {
        // 검증을 예산 가드보다 앞에 둔다. 거절된 요청은 쓰기를 한 번도 하지 않는다.
        let verdict;
        try {
          verdict = await validatePutBody(env, request, match[1], match[2], new Uint8Array(body));
        } catch (error) {
          return new Response(`검증할 수 없습니다: ${error.message}`, {status: 503, headers: responseHeaders({"X-Cache": "UNVERIFIED"})});
        }
        if (!verdict.ok) return new Response(verdict.reason, {status: 400, headers: responseHeaders({"X-Cache": "REJECTED"})});
        // 상한에 걸리면 저장을 건너뛴다. 클라이언트는 캐시 미스와 같게 굴러서
        // 로컬 변환으로 계속 다운로드된다.
        if (await writesExhausted(env, now)) return new Response(null, {status: 204, headers: responseHeaders({"X-Cache": "BUDGET"})});
        if (await storedBytes(env, now) + body.byteLength > budget.storageBytes) {
          return new Response(null, {status: 204, headers: responseHeaders({"X-Cache": "FULL"})});
        }
        await env.KTHEME_CACHE.put(objectKey, body, {httpMetadata: {contentType: bucket.contentType}, customMetadata: name ? {name} : undefined});
        await addStoredBytes(env, now, body.byteLength);
        await noteWrites(env, now, 2);
      }
      return new Response(null, {status: 204, headers: responseHeaders({"X-Cache": existing ? "EXISTS" : "STORED"})});
    }
    return new Response("Method not allowed", {status: 405, headers: responseHeaders({Allow: "GET, PUT, OPTIONS"})});
  },
};

export {budget, hasV2Signature, readCentralDirectory, resetBaseCache, resetBudgetCache, validatePutBody};
