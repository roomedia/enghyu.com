// 실제 `base.apk` + 실제 `.ktheme` 로 만든 APK 를 Android 도구 사슬에 통과시킨다.
// 브라우저 E2E 는 자기가 만든 바이트를 자기가 읽어 검증하므로, 그 APK 를 안드로이드가
// 받아 주는지는 확인하지 못한다. 이 게이트가 그 자리를 메운다 — aapt2 가 manifest 와
// resource table 을 읽고, apksigner 가 서명을 검증하고, 기기가 설치까지 받는지 본다.
//
// 사용:
//   THEME_PATH=~/Downloads/뚱카츄.ktheme node tests/apk-gate.mjs
//   APK_PATH=/tmp/theme.apk node tests/apk-gate.mjs      # 이미 만든 APK 로
//
// 환경변수:
//   THEME_PATH             입력 `.ktheme`. APK_PATH 가 없으면 필수
//   BASE_PATH              기본값은 저장소의 `base.apk`
//   APK_PATH               변환을 건너뛰고 이 APK 를 검사
//   ANDROID_SDK_ROOT       없으면 ANDROID_HOME, 그다음 ~/Library/Android/sdk
//   ADB_SERIAL             기기를 지정. 없으면 붙어 있는 첫 기기
//   APK_GATE_SKIP_DEVICE   1 이면 설치 단계를 건너뛴다 (CI 기본 경로)

import {execFileSync} from "node:child_process";
import {existsSync, mkdtempSync, readdirSync, statSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import process from "node:process";

const repoRoot = resolve(import.meta.dirname, "..");
const steps = [];

function record(name, status, detail) {
  steps.push({name, status, detail});
  const mark = status === "pass" ? "✓" : status === "skip" ? "-" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  record(name, "fail", detail);
  throw new Error(`${name}: ${detail}`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options});
}

// SDK 는 기기마다 다른 자리에 깔린다. 경로를 박아 두면 CI 에서 바로 깨진다.
function sdkRoot() {
  const candidates = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME, join(homedir(), "Library/Android/sdk")];
  const found = candidates.find(path => path && existsSync(path));
  if (!found) throw new Error("Android SDK 를 찾지 못했습니다. ANDROID_SDK_ROOT 를 지정하세요.");
  return found;
}

// build-tools 는 여러 판이 함께 깔린다. 필요한 도구를 다 갖춘 것 중 최신을 고른다.
function buildTools(root) {
  const directory = join(root, "build-tools");
  if (!existsSync(directory)) throw new Error(`build-tools 가 없습니다: ${directory}`);
  const versions = readdirSync(directory)
    .filter(name => statSync(join(directory, name)).isDirectory())
    .filter(name => ["aapt2", "apksigner", "zipalign"].every(tool => existsSync(join(directory, name, tool))))
    .sort((left, right) => {
      const parse = value => value.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
      const [a, b] = [parse(left), parse(right)];
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
      }
      return 0;
    });
  if (!versions.length) throw new Error(`aapt2·apksigner·zipalign 을 갖춘 build-tools 가 없습니다: ${directory}`);
  const version = versions.at(-1);
  return {version, tool: name => join(directory, version, name)};
}

// 검사 대상은 이 도구가 실제로 뱉는 APK 여야 한다. 그래서 브라우저 E2E 를 그대로 태워
// 산출물을 받는다 — 별도 변환 경로를 하나 더 두면 그 경로가 검증되지 않은 채 남는다.
function buildApk(themePath, basePath) {
  const output = join(mkdtempSync(join(tmpdir(), "ktheme-gate-")), "gate.apk");
  run("node", [join(repoRoot, "tests/e2e/local-flow.mjs")], {
    cwd: repoRoot,
    env: {...process.env, BASE_PATH: basePath, THEME_PATH: themePath, E2E_OUTPUT: output},
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (!existsSync(output)) throw new Error("E2E 가 APK 를 내보내지 않았습니다.");
  return output;
}

function parseBadging(text) {
  const packageName = text.match(/package: name='([^']+)'/)?.[1];
  const label = text.match(/application-label:'([^']*)'/)?.[1];
  const minSdk = text.match(/minSdkVersion:'(\d+)'/)?.[1];
  return {packageName, label, minSdk};
}

// `resource 0x… color/theme_x PUBLIC` 다음 줄에 값이 온다. 값 줄만 따로 보면 어느
// resource 것인지 알 수 없으므로 짝을 지어 읽는다.
function parseThemeColors(text) {
  const lines = text.split("\n");
  const colors = {};
  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].match(/^\s*resource 0x[0-9a-f]+ color\/(theme_\w+)\b/)?.[1];
    if (!name) continue;
    const value = lines[index + 1]?.match(/^\s*\([^)]*\)\s+(\S+)/)?.[1];
    if (value) colors[name] = value;
  }
  return colors;
}

function deviceSerial() {
  if (process.env.APK_GATE_SKIP_DEVICE === "1") return null;
  const adb = join(sdkRoot(), "platform-tools/adb");
  if (!existsSync(adb)) return null;
  let listing = "";
  try {
    listing = run(adb, ["devices"]);
  } catch {
    return null;
  }
  const serials = listing.split("\n").slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length === 2 && parts[1] === "device")
    .map(parts => parts[0]);
  if (process.env.ADB_SERIAL) return serials.includes(process.env.ADB_SERIAL) ? process.env.ADB_SERIAL : null;
  return serials[0] || null;
}

try {
const root = sdkRoot();
const tools = buildTools(root);
record("build-tools 선택", "pass", `${tools.version} (${root})`);

const themePath = process.env.THEME_PATH;
const basePath = process.env.BASE_PATH || join(repoRoot, "base.apk");
let apkPath = process.env.APK_PATH;
if (apkPath) {
  if (!existsSync(apkPath)) fail("APK 준비", `APK_PATH 가 가리키는 파일이 없습니다: ${apkPath}`);
  record("APK 준비", "pass", `주어진 APK 사용 (${statSync(apkPath).size} 바이트)`);
} else {
  if (!themePath) fail("APK 준비", "THEME_PATH 또는 APK_PATH 가 필요합니다.");
  if (!existsSync(themePath)) fail("APK 준비", `테마 파일이 없습니다: ${themePath}`);
  if (!existsSync(basePath)) fail("APK 준비", `base.apk 가 없습니다: ${basePath}`);
  apkPath = buildApk(themePath, basePath);
  record("APK 준비", "pass", `브라우저 변환 산출물 ${statSync(apkPath).size} 바이트`);
}

let badging;
try {
  badging = parseBadging(run(tools.tool("aapt2"), ["dump", "badging", apkPath]));
} catch (error) {
  fail("aapt2 badging", error.message.split("\n")[0]);
}
if (!badging.packageName) fail("aapt2 badging", "package name 을 읽지 못했습니다.");
// 고정 package 를 쓰면 테마마다 서로를 덮어쓴다. 입력에서 파생한 이름인지 본다.
if (!/^com\.ktheme\./.test(badging.packageName)) fail("aapt2 badging", `예상 밖 package: ${badging.packageName}`);
if (!badging.label?.trim()) fail("aapt2 badging", "application-label 이 비었습니다.");
if (themePath) {
  const themeName = basename(themePath).replace(/\.ktheme$/i, "");
  if (!badging.label.startsWith(themeName)) fail("aapt2 badging", `label 이 입력 이름과 다릅니다: ${badging.label.trim()} ≠ ${themeName}`);
}
record("aapt2 badging", "pass", `${badging.packageName} · label ${badging.label.trim()} · minSdk ${badging.minSdk}`);

let colors;
try {
  colors = parseThemeColors(run(tools.tool("aapt2"), ["dump", "resources", apkPath]));
} catch (error) {
  fail("aapt2 resources", error.message.split("\n")[0]);
}
const entries = Object.entries(colors);
if (!entries.length) fail("aapt2 resources", "theme 색 resource 를 하나도 읽지 못했습니다.");
// 테마가 안 준 색은 `@null`, 준 색은 `#aarrggbb`, selector 는 XML 파일이다. 그 셋
// 밖의 값(빈 문자열, 깨진 참조)이 나오면 resource table 을 잘못 쓴 것이다.
const applied = entries.filter(([, value]) => /^#[0-9a-f]{8}$/i.test(value));
const fileBacked = entries.filter(([, value]) => value === "(file)");
const malformed = entries.filter(([, value]) => value !== "@null" && value !== "(file)" && !/^#[0-9a-f]{8}$/i.test(value));
if (malformed.length) fail("aapt2 resources", `형식이 깨진 색 ${malformed.length}개: ${malformed.slice(0, 3).map(([name, value]) => `${name}=${value}`).join(", ")}`);
if (!applied.length) fail("aapt2 resources", "적용된 색이 하나도 없습니다.");
record("aapt2 resources", "pass", `theme 색 ${entries.length}개 중 적용 ${applied.length}개, selector ${fileBacked.length}개, 나머지 @null`);

let signing;
try {
  signing = run(tools.tool("apksigner"), ["verify", "--verbose", apkPath]);
} catch (error) {
  fail("apksigner verify", `${error.stdout || ""}${error.stderr || ""}`.split("\n").filter(Boolean)[0] || error.message);
}
// 이 도구는 v2 만 만든다. v2 가 false 로 바뀌면 서명 경로가 깨진 것이다.
if (!/Verified using v2 scheme \(APK Signature Scheme v2\): true/.test(signing)) {
  fail("apksigner verify", `v2 서명이 확인되지 않았습니다: ${signing.split("\n").slice(0, 4).join(" / ")}`);
}
record("apksigner verify", "pass", signing.split("\n").filter(line => /: true$/.test(line)).join(", ") || "v2");

try {
  const aligned = run(tools.tool("zipalign"), ["-c", "-v", "4", apkPath]);
  if (!/Verification successful/.test(aligned)) fail("zipalign", "정렬 검증이 성공으로 끝나지 않았습니다.");
  record("zipalign", "pass", "4바이트 정렬");
} catch (error) {
  if (error.message.startsWith("zipalign:")) throw error;
  fail("zipalign", `${error.stdout || ""}${error.stderr || ""}`.split("\n").filter(Boolean).at(-1) || error.message);
}

const serial = deviceSerial();
if (!serial) {
  record("기기 설치", "skip", process.env.APK_GATE_SKIP_DEVICE === "1" ? "APK_GATE_SKIP_DEVICE=1" : "붙어 있는 기기가 없습니다");
} else {
  const adb = join(root, "platform-tools/adb");
  const target = ["-s", serial];
  // 브라우저마다 서명 키가 달라 같은 package 를 덮어쓸 수 없다. 먼저 지운다.
  try {
    run(adb, [...target, "uninstall", badging.packageName], {stdio: "pipe"});
  } catch {
    // 안 깔려 있으면 실패한다. 정상 경로다.
  }
  try {
    run(adb, [...target, "install", apkPath], {stdio: "pipe"});
  } catch (error) {
    fail("기기 설치", `${error.stdout || ""}${error.stderr || ""}`.split("\n").filter(Boolean).at(-1) || error.message);
  }
  const installed = run(adb, [...target, "shell", "pm", "list", "packages", badging.packageName]);
  if (!installed.includes(`package:${badging.packageName}`)) fail("기기 설치", `설치 후 package 가 보이지 않습니다: ${badging.packageName}`);
  // 게이트가 기기에 앱을 남기지 않는다. 다음 실행이 이전 빌드를 보는 일을 막는다.
  run(adb, [...target, "uninstall", badging.packageName], {stdio: "pipe"});
  record("기기 설치", "pass", `${serial} 에 설치·확인·제거`);
}

} catch (error) {
  // fail() 이 이미 ✗ 줄을 찍었다. 준비 단계에서 던진 것만 여기서 처음 보인다.
  if (!steps.some(step => step.status === "fail")) record("게이트 중단", "fail", error.message.split("\n")[0]);
}

const failed = steps.filter(step => step.status === "fail");
const skipped = steps.filter(step => step.status === "skip");
console.log(`\nAPK GATE ${failed.length ? "FAIL" : "PASS"}: ${steps.length - failed.length - skipped.length}개 통과${skipped.length ? `, ${skipped.length}개 건너뜀` : ""}`);
if (failed.length) process.exitCode = 1;
