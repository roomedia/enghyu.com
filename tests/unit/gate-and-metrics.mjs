// 광고 게이트와 지표 수집의 서버 쪽 판정을 검증한다. 브라우저 없이 돌린다.
// worker는 R2 바인딩만 쓰므로 조건부 PUT 의미까지 흉내낸 가짜 버킷을 물린다.
import assert from "node:assert/strict";
import worker, {budget, resetBudgetCache} from "../../worker.js";
import {normalizeThemeName, sizeBucket} from "../../static/analytics.js";
// PUT 검증이 예산 가드보다 앞에 있다. 예산·용량을 보려면 본문이 먼저 통과해야 한다.
import {seedTheme, signedApkBytes} from "./apk-fixtures.mjs";

function fakeBucket({conditionalWrites = true} = {}) {
  const store = new Map();
  return {
    store,
    async head(key) { return store.has(key) ? {key} : null; },
    async get(key) {
      if (!store.has(key)) return null;
      const body = store.get(key);
      return {key, json: async () => JSON.parse(body), text: async () => body};
    },
    async put(key, value, options = {}) {
      if (options.onlyIf) {
        if (!conditionalWrites) throw new Error("conditional writes unsupported");
        if (options.onlyIf.etagDoesNotMatch === "*" && store.has(key)) return null;
      }
      store.set(key, typeof value === "string" ? value : String(value));
      return {key};
    },
  };
}

const sha = "a".repeat(64);
const call = (bucket, path, init) => worker.fetch(new Request(`https://example.test${path}`, init), {KTHEME_CACHE: bucket});

async function claimIsOncePerHash() {
  const bucket = fakeBucket();
  const first = await (await call(bucket, `/free-claim/${sha}`, {method: "POST"})).json();
  const second = await (await call(bucket, `/free-claim/${sha}`, {method: "POST"})).json();
  assert.equal(first.free, true, "첫 다운로드는 무료다");
  assert.equal(second.free, false, "같은 hash의 두 번째는 무료가 아니다");
  assert.equal(bucket.store.has(`claim/${sha}`), true);
}

async function claimSurvivesWithoutConditionalWrites() {
  const bucket = fakeBucket({conditionalWrites: false});
  const first = await (await call(bucket, `/free-claim/${sha}`, {method: "POST"})).json();
  const second = await (await call(bucket, `/free-claim/${sha}`, {method: "POST"})).json();
  assert.equal(first.free, true, "조건부 쓰기를 모르는 런타임에서도 첫 건은 무료다");
  assert.equal(second.free, false, "head 결과만으로도 두 번째는 막힌다");
}

async function claimRejectsWrongMethodAndPath() {
  const bucket = fakeBucket();
  assert.equal((await call(bucket, `/free-claim/${sha}`, {method: "GET"})).status, 405);
  assert.equal((await call(bucket, "/free-claim/not-a-hash", {method: "POST"})).status, 404);
}

async function downloadCountAggregates() {
  const bucket = fakeBucket();
  const name = encodeURIComponent("바다 테마");
  const post = detail => call(bucket, `/download-count/${sha}`, {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-Theme-Name": name},
    body: JSON.stringify(detail),
  });
  await post({source: "fresh_convert", free: true, outputType: "apk"});
  const second = await (await post({source: "shared_cache", free: false, outputType: "apk"})).json();
  assert.equal(second.count, 2);
  assert.equal(second.freeCount, 1, "무료로 나간 건수만 따로 센다");
  assert.deepEqual(second.sources, {fresh_convert: 1, shared_cache: 1});
  assert.equal(decodeURIComponent(second.name), "바다 테마", "테마 이름이 SHA와 함께 남는다");
  assert.equal(second.firstAt <= second.lastAt, true);

  const read = await call(bucket, `/download-count/${sha}`, {method: "GET"});
  assert.equal(read.status, 200);
  assert.equal((await read.json()).count, 2);
  const missing = await call(bucket, `/download-count/${"b".repeat(64)}`, {method: "GET"});
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).count, 0);
}

async function sharedCacheStillWorks() {
  const bucket = fakeBucket();
  assert.equal((await call(bucket, `/shared-cache/${sha}`, {method: "GET"})).status, 404, "캐시 미스는 그대로 404다");
  assert.equal((await call(bucket, "/nope", {method: "GET"})).status, 404);
}

const monthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

function exhaustWriteBudget(bucket) {
  bucket.store.set(`budget/writes-${monthKey()}.json`, JSON.stringify({writes: budget.monthlyWrites}));
  resetBudgetCache();
}

async function budgetStopsWritesAndKeepsReads() {
  const bucket = fakeBucket();
  exhaustWriteBudget(bucket);
  const claimed = await (await call(bucket, `/free-claim/${sha}`, {method: "POST"})).json();
  assert.equal(claimed.free, false, "예산이 다하면 무료를 발급하지 않는다");
  assert.equal(bucket.store.has(`claim/${sha}`), false, "발급을 안 했으니 객체도 안 쓴다");

  const counted = await (await call(bucket, `/download-count/${sha}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({source: "fresh_convert", free: false}),
  })).json();
  assert.equal(counted.budgetPaused, true);
  assert.equal(bucket.store.has(`stats/${sha}.json`), false, "집계도 멈춘다");

  seedTheme(bucket, sha);
  const put = await call(bucket, `/shared-cache/${sha}`, {method: "PUT", body: signedApkBytes});
  assert.equal(put.headers.get("X-Cache"), "BUDGET", "캐시 저장도 건너뛴다");
  assert.equal(bucket.store.has(`signed/${sha}.apk`), false);

  resetBudgetCache();
}

async function storageCapStopsCachePut() {
  const bucket = fakeBucket();
  bucket.store.set(`budget/storage-${monthKey()}.json`, JSON.stringify({bytes: budget.storageBytes, objects: 1}));
  resetBudgetCache();
  seedTheme(bucket, sha);
  const put = await call(bucket, `/shared-cache/${sha}`, {method: "PUT", body: signedApkBytes});
  assert.equal(put.headers.get("X-Cache"), "FULL", "저장 상한을 넘기면 저장하지 않는다");
  assert.equal(bucket.store.has(`signed/${sha}.apk`), false);
}

async function cachePutTracksStoredBytes() {
  const bucket = fakeBucket();
  resetBudgetCache();
  seedTheme(bucket, sha);
  const put = await call(bucket, `/shared-cache/${sha}`, {method: "PUT", body: signedApkBytes});
  assert.equal(put.headers.get("X-Cache"), "STORED");
  const usage = JSON.parse(bucket.store.get(`budget/storage-${monthKey()}.json`));
  assert.equal(usage.bytes, signedApkBytes.length, "저장한 만큼 누적 바이트가 올라간다");
  assert.equal(usage.objects, 1);
}

function themeNameIsNormalized() {
  assert.equal(normalizeThemeName("바다 테마.ktheme"), "바다 테마");
  assert.equal(normalizeThemeName("dir/sub\\name.apk"), "dir sub name");
  assert.equal(normalizeThemeName("  앞뒤   공백  .ktheme"), "앞뒤 공백");
  assert.equal(normalizeThemeName("탭\t줄바꿈\n섞임.ktheme"), "탭 줄바꿈 섞임");
  assert.equal(normalizeThemeName(".ktheme"), "untitled", "확장자만 있으면 대체 이름을 쓴다");
  assert.equal(normalizeThemeName(`${"가".repeat(120)}.ktheme`).length, 60, "길이를 자른다");
}

function sizeBucketsAreOrdered() {
  assert.equal(sizeBucket(0), "0-256KB");
  assert.equal(sizeBucket(300 * 1024), "256KB-1MB");
  assert.equal(sizeBucket(2 * 1024 * 1024), "1-4MB");
  assert.equal(sizeBucket(9 * 1024 * 1024), "4-16MB");
  assert.equal(sizeBucket(40 * 1024 * 1024), "16MB+");
}

const checks = [
  budgetStopsWritesAndKeepsReads,
  storageCapStopsCachePut,
  cachePutTracksStoredBytes,
  claimIsOncePerHash,
  claimSurvivesWithoutConditionalWrites,
  claimRejectsWrongMethodAndPath,
  downloadCountAggregates,
  sharedCacheStillWorks,
  themeNameIsNormalized,
  sizeBucketsAreOrdered,
];

for (const check of checks) {
  await check();
  console.log(`PASS ${check.name}`);
}
console.log("UNIT PASS: 무료 1회 claim·다운로드 집계·파일명 정규화");
