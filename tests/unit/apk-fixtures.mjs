// 단위 테스트가 공유하는 ZIP·APK 조각. worker 의 PUT 검증이 통과하려면 본문이 실제
// ZIP 이고 APK 는 서명 블록까지 있어야 하므로, 그 모양을 여기서 한 번만 만든다.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import JSZip from "jszip";
import {converterVersion} from "../../static/converter-version.js";

const encoder = new TextEncoder();
const v2SignatureId = 0x7109871a;

const baseBytes = new Uint8Array(await readFile(new URL("../../base.apk", import.meta.url)));

function concat(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");

// 브라우저의 `cacheKey()` 와 같은 식이다 — sha256(입력 파일 ++ base.apk ++ 변환기 판).
const cacheKeyFor = async bytes =>
  hex(await crypto.subtle.digest("SHA-256", concat(bytes, baseBytes, encoder.encode(converterVersion))));

async function zipBytes(entries) {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(entries)) zip.file(name, data);
  return new Uint8Array(await zip.generateAsync({type: "uint8array"}));
}

// APK 서명 블록은 중앙 디렉터리 바로 앞에 들어가고 그만큼 EOCD 가 가리키는 시작
// 위치가 밀린다. 규격대로 만들어야 worker 의 파서를 진짜로 검증한다.
function insertSigningBlock(bytes, signatureId = v2SignatureId) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  assert.notEqual(eocd, -1, "EOCD 를 찾지 못했습니다");
  const centralDirectoryStart = view.getUint32(eocd + 16, true);
  const value = encoder.encode("signature");
  const pair = new Uint8Array(8 + 4 + value.length);
  const pairView = new DataView(pair.buffer);
  pairView.setBigUint64(0, BigInt(4 + value.length), true);
  pairView.setUint32(8, signatureId, true);
  pair.set(value, 12);
  const size = pair.length + 8 + 16;
  const block = new Uint8Array(8 + size);
  const blockView = new DataView(block.buffer);
  blockView.setBigUint64(0, BigInt(size), true);
  block.set(pair, 8);
  blockView.setBigUint64(8 + pair.length, BigInt(size), true);
  block.set(encoder.encode("APK Sig Block 42"), 8 + pair.length + 8);
  const out = concat(bytes.subarray(0, centralDirectoryStart), block, bytes.subarray(centralDirectoryStart));
  new DataView(out.buffer).setUint32(eocd + block.length + 16, centralDirectoryStart + block.length, true);
  return out;
}

const themeBytes = await zipBytes({"KakaoTalkTheme.css": "ManifestStyle { -kakaotalk-theme-name: 'unit'; }"});
const themeKey = await cacheKeyFor(themeBytes);
const signedApkBytes = insertSigningBlock(await zipBytes({
  "AndroidManifest.xml": "binary-xml",
  "resources.arsc": "resource-table",
}));

// APK PUT 은 같은 key 의 원본 테마가 이미 있어야 통과한다. 예산·용량 검사를 보려는
// 테스트가 그 앞단에 걸리지 않도록 버킷에 테마를 미리 놓아 준다.
const seedTheme = (bucket, key) => bucket.store.set(`theme/${key}.ktheme`, themeBytes);

export {baseBytes, cacheKeyFor, concat, insertSigningBlock, seedTheme, signedApkBytes, themeBytes, themeKey, zipBytes};
