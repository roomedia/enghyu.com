// 공용 캐시 PUT 검증. 저장 전에 본문이 정말 그 key 의 산출물인지 보는 부분만 다룬다.
// 브라우저 없이 돌린다 — worker 는 R2·ASSETS 바인딩만 쓰므로 둘 다 가짜를 물린다.
//
// 실제 서명 APK 로 도는 검사는 `npm run test:apk` 가 따로 든다. 여기서는 서명 블록을
// 규격대로 만들어 넣어 파서 자체를 본다.
import assert from "node:assert/strict";
import worker, {hasV2Signature, readCentralDirectory, resetBaseCache} from "../../worker.js";
import {baseBytes, cacheKeyFor, insertSigningBlock, signedApkBytes, themeBytes, themeKey, zipBytes} from "./apk-fixtures.mjs";

function fakeBucket() {
  const store = new Map();
  return {
    store,
    async head(key) { return store.has(key) ? {key} : null; },
    async get(key) {
      if (!store.has(key)) return null;
      const value = store.get(key);
      const text = typeof value === "string" ? value : new TextDecoder().decode(value);
      return {key, json: async () => JSON.parse(text), text: async () => text};
    },
    async put(key, value) { store.set(key, value); return {key}; },
  };
}

const fakeAssets = {async fetch() { return new Response(baseBytes); }};
const call = (bucket, path, init, assets = fakeAssets) =>
  worker.fetch(new Request(`https://example.test${path}`, init), {KTHEME_CACHE: bucket, ASSETS: assets});
const put = (bucket, path, body, assets) => call(bucket, path, {method: "PUT", body}, assets);

const apkBytes = signedApkBytes;

async function parserReadsRealBaseApk() {
  const directory = readCentralDirectory(baseBytes);
  assert.ok(directory, "base.apk 의 중앙 디렉터리를 읽지 못했습니다");
  assert.ok(directory.names.includes("AndroidManifest.xml"));
  assert.ok(directory.names.includes("resources.arsc"));
  // base.apk 는 실행 template 일 뿐 서명본이 아니다. 브라우저가 서명한다.
  assert.equal(hasV2Signature(baseBytes, directory.start), false, "base.apk 에는 v2 서명이 없다");
}

async function parserFindsInsertedSignatureBlock() {
  const directory = readCentralDirectory(apkBytes);
  assert.ok(directory, "서명 블록을 넣은 뒤에도 ZIP 을 읽어야 한다");
  assert.deepEqual(directory.names, ["AndroidManifest.xml", "resources.arsc"]);
  assert.equal(hasV2Signature(apkBytes, directory.start), true);
  // v2 가 아닌 id 만 든 블록은 통과하면 안 된다.
  const v3Only = insertSigningBlock(await zipBytes({"AndroidManifest.xml": "x", "resources.arsc": "y"}), 0xf05368c0);
  assert.equal(hasV2Signature(v3Only, readCentralDirectory(v3Only).start), false);
}

async function themeStoresOnlyUnderItsOwnKey() {
  const bucket = fakeBucket();
  const stored = await put(bucket, `/shared-theme/${themeKey}`, themeBytes);
  assert.equal(stored.status, 204);
  assert.equal(stored.headers.get("X-Cache"), "STORED");
  assert.equal(bucket.store.has(`theme/${themeKey}.ktheme`), true);

  const other = fakeBucket();
  const wrong = await put(other, `/shared-theme/${"b".repeat(64)}`, themeBytes);
  assert.equal(wrong.status, 400);
  assert.equal(wrong.headers.get("X-Cache"), "REJECTED");
  assert.match(await wrong.text(), /key/);
  // 거절된 요청은 예산 카운터까지 포함해 아무것도 쓰지 않는다.
  assert.equal(other.store.size, 0, "거절된 PUT 은 쓰기를 하지 않는다");
}

async function themeRejectsWrongShapes() {
  const bucket = fakeBucket();
  const garbage = await put(bucket, `/shared-theme/${themeKey}`, new Uint8Array([1, 2, 3, 4]));
  assert.equal(garbage.status, 400);
  assert.match(await garbage.text(), /ZIP/);

  const noCss = await zipBytes({"Images/mainBgImage@3x.png": "not-css"});
  const missing = await put(bucket, `/shared-theme/${await cacheKeyFor(noCss)}`, noCss);
  assert.equal(missing.status, 400);
  assert.match(await missing.text(), /KakaoTalkTheme\.css/);
  assert.equal(bucket.store.size, 0);
}

async function apkNeedsSignatureAndItsTheme() {
  const bucket = fakeBucket();
  // 원본 테마가 아직 없으면 APK 만으로는 key 와의 관계를 확인할 수 없다.
  const orphan = await put(bucket, `/shared-cache/${themeKey}`, apkBytes);
  assert.equal(orphan.status, 400);
  assert.match(await orphan.text(), /원본 테마/);
  assert.equal(bucket.store.size, 0);

  await put(bucket, `/shared-theme/${themeKey}`, themeBytes);
  const accepted = await put(bucket, `/shared-cache/${themeKey}`, apkBytes);
  assert.equal(accepted.status, 204);
  assert.equal(bucket.store.has(`signed/${themeKey}.apk`), true);
}

async function apkRejectsMissingSignatureAndEntries() {
  const bucket = fakeBucket();
  await put(bucket, `/shared-theme/${themeKey}`, themeBytes);

  const unsigned = await put(bucket, `/shared-cache/${themeKey}`, baseBytes);
  assert.equal(unsigned.status, 400);
  assert.match(await unsigned.text(), /v2 서명/);

  const notAnApk = insertSigningBlock(await zipBytes({"KakaoTalkTheme.css": "css"}));
  const shapeless = await put(bucket, `/shared-cache/${themeKey}`, notAnApk);
  assert.equal(shapeless.status, 400);
  assert.match(await shapeless.text(), /AndroidManifest\.xml/);
  assert.equal(bucket.store.has(`signed/${themeKey}.apk`), false);
}

async function alreadyStoredObjectSkipsValidation() {
  const bucket = fakeBucket();
  await put(bucket, `/shared-theme/${themeKey}`, themeBytes);
  // 이미 저장된 key 는 본문을 다시 보지 않는다. 첫 저장이 이미 검증을 통과했다.
  const again = await put(bucket, `/shared-theme/${themeKey}`, new Uint8Array([9, 9, 9]));
  assert.equal(again.status, 204);
  assert.equal(again.headers.get("X-Cache"), "EXISTS");
}

async function missingAssetsBindingFailsClosed() {
  const bucket = fakeBucket();
  // base.apk 는 isolate 안에 캐시된다. 바인딩이 없던 첫 요청 상태를 다시 만든다.
  resetBaseCache();
  const response = await worker.fetch(
    new Request(`https://example.test/shared-theme/${themeKey}`, {method: "PUT", body: themeBytes}),
    {KTHEME_CACHE: bucket},
  );
  // 검증할 수 없으면 저장하지 않는다. 못 여는 쪽이 아무거나 받는 쪽보다 낫다.
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("X-Cache"), "UNVERIFIED");
  assert.equal(bucket.store.size, 0);
}

const tests = [
  parserReadsRealBaseApk,
  parserFindsInsertedSignatureBlock,
  themeStoresOnlyUnderItsOwnKey,
  themeRejectsWrongShapes,
  apkNeedsSignatureAndItsTheme,
  apkRejectsMissingSignatureAndEntries,
  alreadyStoredObjectSkipsValidation,
  missingAssetsBindingFailsClosed,
];

for (const test of tests) {
  await test();
  console.log(`✓ ${test.name}`);
}
console.log(`UNIT PASS: PUT 검증 ${tests.length}건`);
