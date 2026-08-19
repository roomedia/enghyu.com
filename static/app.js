// 진입점: 폼 배선, 변환 파이프라인 호출, 다운로드와 스낵바.
import {concat, digest, encoder, hex} from "./bytes.js";
import {convertTheme, loadBase} from "./apk.js";
import {signApk} from "./sign.js";
import {previewState, refreshPreview} from "./preview.js";
import {apkToTheme} from "./reverse.js";
import {converterVersion} from "./converter-version.js";
import {gateDownload} from "./adgate.js";
import {normalizeThemeName, reportDownload, sizeBucket, track} from "./analytics.js";
import {basePath} from "./base-path.js";

const form = document.getElementById("theme-form");
const fileInput = document.getElementById("theme-file");
const snackbar = document.getElementById("snackbar");
const convertButton = form.querySelector("button[type=submit]");
const cacheName = "ktheme-apk-output-v2";
const sharedCacheUrl = window.KTHEME_SHARED_CACHE_URL || (location.hostname === "localhost" ? "http://localhost:8787/shared-cache" : `${basePath}shared-cache`);
const sharedThemeUrl = window.KTHEME_SHARED_THEME_URL || sharedCacheUrl.replace(/shared-cache$/, "shared-theme");
const shareKeyParam = "t";
let activeDownloadUrl = "";
// .apk를 고르면 역변환 결과를 들고 있다가 다운로드에서 그대로 내보낸다.
let reverseOutput = null;
let snackbarTimer = 0;

async function cacheKey(file, baseBytes) {
  const input = concat(new Uint8Array(await file.arrayBuffer()), new Uint8Array(baseBytes), encoder.encode(converterVersion));
  return hex(await digest(input));
}

async function fetchShared(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch {
    // 공용 캐시는 선택 기능이다. 서버가 없어도 로컬 변환은 계속한다.
    return null;
  }
}

const fetchSharedCache = (key, options) => fetchShared(`${sharedCacheUrl}/${key}`, options);

// 원본 .ktheme을 같은 key로 올려 두면 링크를 받은 사람이 파일 없이도
// 같은 화면을 열고 직접 변환할 수 있다.
async function publishTheme(key, file) {
  const response = await fetchShared(`${sharedThemeUrl}/${key}`, {
    method: "PUT",
    headers: {"Content-Type": "application/zip", "X-Theme-Name": encodeURIComponent(file.name)},
    body: file,
  });
  return Boolean(response?.ok);
}

function shareLinkFor(key) {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set(shareKeyParam, key);
  return url.toString();
}

async function hydrateFromShareLink() {
  const key = new URLSearchParams(location.search).get(shareKeyParam);
  if (!/^[a-f0-9]{64}$/.test(key || "")) return;
  showSnackbar("공유된 테마를 불러오는 중...");
  const response = await fetchShared(`${sharedThemeUrl}/${key}`, {cache: "no-cache"});
  if (!response?.ok) { showSnackbar("공유된 테마를 불러오지 못했습니다.", {duration: 6000}); return; }
  const name = decodeURIComponent(response.headers.get("X-Theme-Name") || "shared.ktheme");
  track("shared_theme_opened", {});
  const transfer = new DataTransfer();
  transfer.items.add(new File([await response.blob()], name, {type: "application/zip"}));
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change"));
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  convertButton.disabled = !file;
  releaseDownloadUrl();
  hideSnackbar();
  reverseOutput = null;
  if (!file) return;
  track("theme_selected", {input_type: file.name.toLowerCase().endsWith(".apk") ? "apk" : "ktheme", size_bucket: sizeBucket(file.size)});
  if (file.name.toLowerCase().endsWith(".apk")) {
    showSnackbar("APK에서 테마를 되돌리는 중...");
    try {
      reverseOutput = await apkToTheme(new Uint8Array(await file.arrayBuffer()));
      hideSnackbar();
      track("reverse_succeeded", {size_bucket: sizeBucket(file.size)});
    } catch (error) {
      track("reverse_failed", {reason: error.message.slice(0, 100)});
      showSnackbar(`역변환 실패: ${error.message}`, {duration: 6000});
      convertButton.disabled = true;
      return;
    }
  }
  // 역변환 결과도 같은 프리뷰를 그린다. 프리뷰는 .ktheme 형식만 안다.
  previewState.themeBytes = reverseOutput ? reverseOutput.bytes : new Uint8Array(await file.arrayBuffer());
  previewState.messages = [
    {direction: "you", text: "안녕하세요. 테마가 적용됐어요."},
    {direction: "me", text: "채팅 화면을 확인해 보세요."},
  ];
  await refreshPreview();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  form.querySelector("button").disabled = true;
  releaseDownloadUrl();
  try {
    // 게이트와 지표는 변환 산출물이 아니라 사용자가 고른 파일의 내용 hash로 센다.
    // 변환기 판이 바뀌어도 같은 파일이면 무료 1회가 되살아나지 않는다.
    const inputSha = hex(await digest(await file.arrayBuffer()));
    if (reverseOutput) {
      const themeName = `${file.name.replace(/\.[^.]*$/, "").trim() || reverseOutput.name || "theme"}.ktheme`;
      await download(new Blob([reverseOutput.bytes], {type: "application/zip"}), themeName, {fileName: themeName, sha: inputSha, source: "reverse", outputType: "ktheme"});
      return;
    }
    showSnackbar("브라우저 캐시 확인 중...");
    const base = await loadBase();
    previewState.themeBytes = new Uint8Array(await file.arrayBuffer());
    await refreshPreview();
    const key = await cacheKey(file, base);
    // 변환과 겹쳐서 올린다. 세 경로 중 어디로 빠지든 같은 공유 링크가 나온다.
    const publishing = publishTheme(key, file);
    const finish = async (blob, source, warnings = []) => {
      const shareUrl = await publishing ? shareLinkFor(key) : "";
      await download(blob, file.name, {warnings, shareUrl, sha: inputSha, source, outputType: "apk"});
    };
    const cache = await caches.open(cacheName);
    const cached = await cache.match(`${basePath}output/${key}`);
    if (cached) { track("cache_hit", {source: "browser_cache"}); await finish(await cached.blob(), "browser_cache"); return; }
    showSnackbar("공용 변환 결과 확인 중...");
    const shared = await fetchSharedCache(key, {cache: "no-cache"});
    if (shared?.ok) {
      const sharedOutput = await shared.blob();
      await cache.put(`${basePath}output/${key}`, new Response(sharedOutput));
      track("cache_hit", {source: "shared_cache"});
      await finish(sharedOutput, "shared_cache");
      return;
    } else {
      showSnackbar("브라우저에서 변환 중...");
      track("convert_started", {size_bucket: sizeBucket(file.size)});
      const convertStartedAt = performance.now();
      const converted = await convertTheme(base, await file.arrayBuffer(), key);
      const unsigned = converted.bytes;
      showSnackbar("브라우저에서 서명 중...");
      const signStartedAt = performance.now();
      const signed = await signApk(unsigned);
      // 서명 시간은 기기 성능에 그대로 비례한다. 체감 대기의 대부분이 여기다.
      track("sign_finished", {duration_ms: Math.round(performance.now() - signStartedAt)});
      const blob = new Blob([signed], {type: "application/vnd.android.package-archive"});
      await fetchSharedCache(key, {method: "PUT", headers: {"Content-Type": "application/vnd.android.package-archive"}, body: blob});
      await cache.put(`${basePath}output/${key}`, new Response(blob));
      track("convert_succeeded", {duration_ms: Math.round(performance.now() - convertStartedAt), warnings_count: converted.warnings.length});
      await finish(blob, "fresh_convert", converted.warnings);
    }
  } catch (error) {
    track("convert_failed", {reason: error.message.slice(0, 100)});
    showSnackbar(`실패: ${error.message}`, {duration: 6000});
  } finally { form.querySelector("button").disabled = false; }
});

function downloadFileName(themeFileName) {
  const baseName = themeFileName.replace(/\.[^.]*$/, "").trim();
  return `${baseName || "themed"}.apk`;
}

async function download(blob, themeFileName, {warnings = [], shareUrl = "", fileName: explicitName = "", sha = "", source = "", outputType = ""} = {}) {
  // 게이트는 네 경로가 공유하는 이 출구 하나에만 둔다.
  const gate = await gateDownload({sha, onEvent: (name, params) => track(name, {...params, source})});
  if (!gate.allowed) {
    showSnackbar("광고를 끝까지 봐야 다운로드가 시작됩니다. 다시 시도해 주세요.", {duration: 6000});
    return;
  }
  // if (gate.reason === "ad-unavailable") showSnackbar("광고를 띄우지 못해 이번은 그대로 내보냅니다.", {duration: 4000});
  releaseDownloadUrl();
  activeDownloadUrl = URL.createObjectURL(blob);
  const fileName = explicitName || downloadFileName(themeFileName);
  const link = document.createElement("a");
  link.href = activeDownloadUrl;
  link.download = fileName;
  link.click();
  // 공유 링크가 없으면 이 탭에서만 열리는 blob URL이 최선이다.
  const copied = await copyText(shareUrl ? `${fileName} 공유 링크: ${shareUrl}` : activeDownloadUrl);
  const message = !copied
    ? `${fileName} 다운로드를 시작했습니다. 링크 복사는 실패했습니다.`
    : shareUrl
      ? `${fileName} 다운로드를 시작하고 공유 링크를 복사했습니다.`
      : `${fileName} 다운로드를 시작하고 이 탭에서만 유효한 링크를 복사했습니다.`;
  showSnackbar(message, {duration: 5000, title: warnings.join("\n")});
  const themeName = normalizeThemeName(themeFileName);
  track("download", {theme_name: themeName, theme_sha: sha, source, output_type: outputType, free: gate.free, share_link: Boolean(shareUrl)});
  if (shareUrl && copied) track("share_link_copied", {theme_sha: sha});
  await reportDownload({sha, name: themeName, source, free: gate.free, outputType});
}

// blob URL은 다음 변환 시작 시점까지 살려 둔다. 다운로드 직후 revoke하면
// 브라우저에 따라 저장이 끊기고 복사해 둔 링크도 같이 죽는다.
function releaseDownloadUrl() {
  if (activeDownloadUrl) URL.revokeObjectURL(activeDownloadUrl);
  activeDownloadUrl = "";
}

function showSnackbar(message, {duration = 0, title = ""} = {}) {
  clearTimeout(snackbarTimer);
  snackbar.textContent = message;
  if (title) snackbar.title = title; else snackbar.removeAttribute("title");
  snackbar.classList.add("is-visible");
  snackbar.setAttribute("aria-hidden", "false");
  if (duration > 0) snackbarTimer = setTimeout(hideSnackbar, duration);
}

function hideSnackbar() {
  clearTimeout(snackbarTimer);
  snackbar.classList.remove("is-visible");
  snackbar.setAttribute("aria-hidden", "true");
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* 권한 없는 환경에서는 기존 브라우저 복사 API로 재시도 */ }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* 복사를 지원하지 않는 브라우저 */ }
  textarea.remove();
  return copied;
}


void hydrateFromShareLink();
