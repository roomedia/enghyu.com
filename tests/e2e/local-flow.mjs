import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import {deflateSync} from "node:zlib";
import JSZip from "jszip";
import {chromium} from "playwright";
import {compiledColorValues, replaceCompiledColors} from "../../static/resources.js";
import {parseTheme} from "../../static/theme.js";

const projectRoot = new URL("../..", import.meta.url).pathname;
const cache = new Map();
const themes = new Map();
const requests = [];

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const crcBytes = Buffer.concat([typeBytes, data]);
  let crc = 0xffffffff;
  for (const byte of crcBytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function fixtureBubblePng() {
  const width = 120;
  const height = 120;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      pixels[offset] = x * 8;
      pixels[offset + 1] = y * 8;
      pixels[offset + 2] = 0x80;
      pixels[offset + 3] = 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngDimensions(bytes) {
  return {width: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16, false), height: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20, false)};
}

function pngChunkTypes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const types = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset, false);
    types.push(new TextDecoder().decode(bytes.slice(offset + 4, offset + 8)));
    offset += length + 12;
  }
  return types;
}

function ninePatchMetadata(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type === "npTc") {
      const chunk = offset + 8;
      return {
        width: view.getUint32(16, false),
        height: view.getUint32(20, false),
        xDivs: [32, 36].map(index => new DataView(bytes.buffer, bytes.byteOffset + chunk, 84).getInt32(index, false)),
        yDivs: [40, 44].map(index => new DataView(bytes.buffer, bytes.byteOffset + chunk, 84).getInt32(index, false)),
        padding: [12, 16, 20, 24].map(index => new DataView(bytes.buffer, bytes.byteOffset + chunk, 84).getInt32(index, false)),
      };
    }
    offset += length + 12;
  }
  return null;
}

function localZipEntry(bytes, expectedName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50;) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataOffset = offset + 30 + nameLength + extraLength;
    if (name === expectedName) return {method: view.getUint16(offset + 8, true), dataOffset};
    offset = dataOffset + view.getUint32(offset + 18, true);
  }
  return null;
}

function edgeInsetsFromCss(css, blockName, propertyName) {
  const block = [...css.matchAll(/([\w-]+)\s*\{([\s\S]*?)\}/g)].find(match => match[1] === blockName)?.[2];
  const value = block?.match(new RegExp(`${propertyName}\\s*:\\s*([^;]+);`))?.[1];
  const parts = value?.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  assert.equal(parts?.length, 4);
  const [top, left, bottom, right] = parts;
  return [left, top, right, bottom];
}

function stretchPointFromCss(css, blockName, propertyName) {
  const block = [...css.matchAll(/([\w-]+)\s*\{([\s\S]*?)\}/g)].find(match => match[1] === blockName)?.[2];
  const value = block?.match(new RegExp(`${propertyName}\\s*:\\s*([^;]+);`))?.[1];
  const parts = value?.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s*$/)?.slice(1).map(Number);
  assert.equal(parts?.length, 2);
  return parts;
}

async function fixtureZip(entries) {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(entries)) zip.file(name, data);
  return zip.generateAsync({type: "nodebuffer", compression: "DEFLATE"});
}

async function createFixtures() {
  if (process.env.BASE_PATH && process.env.THEME_PATH) {
    return {basePath: process.env.BASE_PATH, themePath: process.env.THEME_PATH};
  }
  const directory = await mkdtemp(join(tmpdir(), "ktheme-e2e-"));
  const bubble = fixtureBubblePng();
  const base = await fixtureZip({
    "AndroidManifest.xml": "manifest",
    "resources.arsc": "resource-table",
    "res/values/colors.xml": "<resources><color name=\"theme_background_color\">#FFFFFF</color></resources>",
    "res/values/strings.xml": "<resources><string name=\"app_name\">Base</string></resources>",
    "res/drawable-xhdpi/theme_background_image.png": "base-image-xhdpi",
    "res/drawable-xxhdpi/theme_background_image.png": "base-image",
    "res/drawable/theme_background_image.xml": "base-background-fallback",
    "res/drawable-xxhdpi/theme_maintab_ico_local_image.png": "base-local-fallback",
    "res/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png": "base-bubble",
    "res/drawable-xxhdpi/theme_chatroom_bubble_me_02_image.9.png": "base-bubble",
    "res/drawable-xxhdpi/theme_chatroom_bubble_you_01_image.9.png": "base-bubble",
    "res/drawable-xxhdpi/theme_chatroom_bubble_you_02_image.9.png": "base-bubble",
  });
  const theme = await fixtureZip({
    "KakaoTalkTheme.css": "ManifestStyle { -kakaotalk-theme-name: 'E2E'; } MainViewStyle-Primary { background-color: #123456; } MessageCellStyle-Send { -ios-text-color: #112233; -ios-title-edgeinsets: 2.5px 3.25px 4.5px 5.75px; -ios-group-title-edgeinsets: 2.5px 3.25px 4.5px 5.75px; -ios-background-image: url(send.png) 15px 20px; -ios-group-background-image: url(send-group.png) 15px 20px; } MessageCellStyle-Receive { -ios-text-color: #445566; -ios-title-edgeinsets: 2.5px 3.25px 4.5px 5.75px; -ios-group-title-edgeinsets: 2.5px 3.25px 4.5px 5.75px; -ios-background-image: url(receive.png) 15px 20px; -ios-group-background-image: url(receive-group.png) 15px 20px; }",
    "Images/mainBgImage@2x.png": "theme-image-xhdpi",
    "Images/mainBgImage@3x.png": "theme-image",
    "Images/commonIcoTheme.png": "optional-unsupported-image",
    "Images/chatroomBubbleSend01@3x.png": bubble,
    "Images/chatroomBubbleSend02@3x.png": bubble,
    "Images/chatroomBubbleReceive01@3x.png": bubble,
    "Images/chatroomBubbleReceive02@3x.png": bubble,
  });
  const basePath = join(directory, "base.apk");
  const themePath = join(directory, "theme.ktheme");
  await writeFile(basePath, base);
  await writeFile(themePath, theme);
  return {basePath, themePath};
}

function server() {
  return createServer(async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    const path = request.url.split("?")[0];
    if (path === "/") {
      response.setHeader("content-type", "text/html");
      response.end(await readFile(join(projectRoot, "index.html")));
      return;
    }
    const module = path.match(/^\/static\/([a-z-]+\.js)$/);
    if (module) {
      response.setHeader("content-type", "text/javascript");
      response.end(await readFile(join(projectRoot, "static", module[1])));
      return;
    }
    if (path === "/base.apk") {
      response.setHeader("content-type", "application/vnd.android.package-archive");
      response.end(await readFile(globalThis.fixtureBasePath));
      return;
    }
    const match = path.match(/^\/shared-cache\/([a-f0-9]{64})$/);
    if (match && request.method === "GET") {
      const result = cache.get(match[1]);
      if (!result) { response.writeHead(404); response.end(); return; }
      response.setHeader("content-type", "application/vnd.android.package-archive");
      response.end(result);
      return;
    }
    if (match && request.method === "PUT") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      if (!cache.has(match[1])) cache.set(match[1], Buffer.concat(chunks));
      response.writeHead(204);
      response.end();
      return;
    }
    const themeMatch = path.match(/^\/shared-theme\/([a-f0-9]{64})$/);
    if (themeMatch && request.method === "GET") {
      const result = themes.get(themeMatch[1]);
      if (!result) { response.writeHead(404); response.end(); return; }
      response.setHeader("content-type", "application/zip");
      if (result.name) response.setHeader("x-theme-name", result.name);
      response.end(result.bytes);
      return;
    }
    if (themeMatch && request.method === "PUT") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      if (!themes.has(themeMatch[1])) themes.set(themeMatch[1], {bytes: Buffer.concat(chunks), name: request.headers["x-theme-name"]});
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
}

const fixtures = await createFixtures();
globalThis.fixtureBasePath = fixtures.basePath;
const expectedApkName = `${basename(fixtures.themePath).replace(/\.[^.]*$/, "")}.apk`;
const fixtureColors = parseTheme(await (await JSZip.loadAsync(await readFile(fixtures.themePath))).files["KakaoTalkTheme.css"].async("string")).colors;
// 내부 색 형식은 Android `#AARRGGBB`다. 브라우저가 돌려주는 computed 값과 맞추려면 순서를 바꿔야 한다.
const computedRgb = color => {
  const opaque = color.length === 9 ? color.slice(3) : color.slice(1);
  const [red, green, blue] = [0, 2, 4].map(index => Number.parseInt(opaque.slice(index, index + 2), 16));
  return `rgb(${red}, ${green}, ${blue})`;
};
// compiled resource table 치환 회귀 가드. 실제 base.apk로 직접 검증하므로 fixture 구성과 무관하다.
{
  const baseZip = await JSZip.loadAsync(await readFile(join(projectRoot, "base.apk")));
  const arsc = await baseZip.files["resources.arsc"].async("uint8array");
  const names = compiledColorValues(arsc);
  assert.ok(Object.keys(names).length > 10, "base.apk에서 compiled color를 읽지 못했습니다");
  assert.ok(names.theme_title_color);
  const patched = compiledColorValues(replaceCompiledColors(arsc, {theme_title_color: "#FF010203"}));
  assert.equal(patched.theme_title_color, "#FF010203", "compiled color 치환이 동작하지 않습니다");
}

const httpServer = server();
await new Promise(resolve => httpServer.listen(0, "127.0.0.1", resolve));
const port = httpServer.address().port;
const browser = await chromium.launch({headless: true});

try {
  const firstContext = await browser.newContext({acceptDownloads: true});
  await firstContext.addInitScript(() => {
    window.copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: async text => { window.copiedTexts.push(text); }}});
  });
  const firstPage = await firstContext.newPage();
  await firstPage.goto(`http://127.0.0.1:${port}/`);
  assert.equal(await firstPage.locator("button[type=submit]").isDisabled(), true);
  await firstPage.locator("#theme-file").setInputFiles(fixtures.themePath);
  assert.equal(await firstPage.locator("button[type=submit]").isDisabled(), false);
  assert.equal(await firstPage.locator("button[type=submit]").textContent(), "다운로드");
  assert.equal(await firstPage.locator("#snackbar").getAttribute("aria-hidden"), "true");
  assert.equal(await firstPage.locator("#snackbar").isVisible(), false);
  await assert.doesNotReject(async () => firstPage.locator(".chat-header").waitFor());
  assert.match(await firstPage.locator("#preview-device").innerText(), /테마/);
  assert.match(await firstPage.locator("#preview-device").innerText(), /새로운 메시지가 도착했습니다/);
  assert.equal(await firstPage.locator(".chat-header .mode-toggle").count(), 1);
  // 친구·더보기·잠금화면 프리뷰. 매핑된 색과 이미지가 실제로 반영되는지 본다.
  await firstPage.locator('.tab[data-screen="friends"]').click();
  await firstPage.locator(".screen-header").waitFor();
  assert.match(await firstPage.locator("#preview-device").innerText(), /친구/);
  const mappedBackground = await firstPage.locator(".screen-body").evaluate(element => getComputedStyle(element).backgroundColor);
  assert.equal(mappedBackground, computedRgb(fixtureColors.theme_background_color));
  await firstPage.locator('.tab[data-screen="more"]').click();
  await firstPage.locator('[data-screen="passcode"]').waitFor();
  assert.match(await firstPage.locator("#preview-device").innerText(), /잠금화면/);
  await firstPage.locator('[data-screen="passcode"]').click();
  await firstPage.locator(".keypad").waitFor();
  assert.equal(await firstPage.locator(".bullet").count(), 4);
  assert.equal(await firstPage.locator(".tab-bar").count(), 0);
  await firstPage.locator('[data-screen="more"]').click();
  await firstPage.locator('.tab[data-screen="chats"]').click();
  await firstPage.locator(".chat").waitFor();
  assert.equal(await firstPage.locator(".screen-header").count(), 0);

  // 다크모드 토글. 카카오톡 chrome만 어두워지고 테마가 준 색은 유지돼야 한다.
  await firstPage.locator(".mode-toggle").click();
  await firstPage.locator('#preview-device.is-dark .mode-toggle[aria-pressed="true"]').waitFor();
  assert.equal(await firstPage.locator(".chat-header").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(27, 29, 31)");
  await firstPage.locator('.tab[data-screen="friends"]').click();
  await firstPage.locator(".screen-header").waitFor();
  assert.equal(await firstPage.locator(".screen-body").evaluate(element => getComputedStyle(element).backgroundColor), mappedBackground);
  await firstPage.locator(".mode-toggle").click();
  await firstPage.locator('#preview-device:not(.is-dark) .mode-toggle[aria-pressed="false"]').waitFor();
  await firstPage.locator('.tab[data-screen="chats"]').click();
  await firstPage.locator(".chat").waitFor();

  const enterMessage = "엔터 한 번";
  await firstPage.locator("#preview-message-input").fill(enterMessage);
  await firstPage.locator("#preview-message-input").press("Enter");
  await firstPage.locator(".bubble-text").filter({hasText: enterMessage}).waitFor();
  assert.equal(await firstPage.locator(".bubble-text").filter({hasText: enterMessage}).count(), 1);
  const imeMessage = "한글 조합";
  await firstPage.locator("#preview-message-input").evaluate((input, text) => {
    input.value = text;
    input.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true}));
    input.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true}));
    for (const isComposing of [true, false]) {
      input.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, key: "Enter", code: "Enter", keyCode: 13, which: 13, isComposing}));
    }
  }, imeMessage);
  await firstPage.locator(".bubble-text").filter({hasText: imeMessage}).waitFor();
  assert.equal(await firstPage.locator(".bubble-text").filter({hasText: imeMessage}).count(), 1);
  await firstPage.locator("#preview-message-input").fill("두글");
  await firstPage.locator(".preview-send").click();
  const shortBubble = firstPage.locator(".bubble.me.group").last();
  await shortBubble.locator(".bubble-text").filter({hasText: "두글"}).waitFor();
  const shortBubbleWidth = Number.parseFloat(await shortBubble.evaluate(element => element.style.width));
  const shortBubbleHeight = Number.parseFloat(await shortBubble.evaluate(element => element.style.height));
  const shortTextLineCount = await shortBubble.locator(".bubble-text").evaluate(element => element.getClientRects().length);
  if (process.env.THEME_PATH) assert.ok(shortBubbleWidth >= 40);
  else assert.equal(shortBubbleWidth, 40);
  assert.equal(shortTextLineCount, 1);
  assert.ok(shortBubbleHeight > 0);
  if (!process.env.THEME_PATH) {
    assert.deepEqual(await shortBubble.locator(".bubble-text").evaluate(element => ({
      left: element.style.left,
      top: element.style.top,
      right: element.style.right,
    })), {left: "3.25px", top: "2.5px", right: "5.75px"});
  }
  const groupBounds = await shortBubble.evaluate(element => {
    const bubble = element.getBoundingClientRect();
    const text = element.querySelector(".bubble-text").getBoundingClientRect();
    const style = element.querySelector(".bubble-text").style;
    return {bubble, text, left: Number.parseFloat(style.left), top: Number.parseFloat(style.top), right: Number.parseFloat(style.right)};
  });
  assert.ok(groupBounds.text.left >= groupBounds.bubble.left + groupBounds.left - 0.5);
  assert.ok(groupBounds.text.top >= groupBounds.bubble.top + groupBounds.top - 0.5);
  assert.ok(groupBounds.text.right <= groupBounds.bubble.right - groupBounds.right + 0.5);
  await firstPage.locator("#preview-message-input").fill("긴 메시지\n늘림 검증");
  await firstPage.locator(".preview-send").click();
  const longBubble = firstPage.locator(".bubble.me.group").last();
  await longBubble.locator(".bubble-text").filter({hasText: "긴 메시지"}).waitFor();
  assert.match(await firstPage.locator("#preview-device").innerText(), /테마/);
  assert.match(await firstPage.locator("#preview-device").innerText(), /긴 메시지/);
  await firstPage.locator("#preview-message-input").fill("안전영역을검증하는공백없는아주긴메시지입니다안전영역을검증하는공백없는아주긴메시지입니다");
  await firstPage.locator(".preview-send").click();
  const safeBubble = firstPage.locator(".bubble.me.group").last();
  await safeBubble.locator(".bubble-text").filter({hasText: "안전영역"}).waitFor();
  const safeBounds = await safeBubble.evaluate(element => {
    const bubble = element.getBoundingClientRect();
    const text = element.querySelector(".bubble-text").getBoundingClientRect();
    const style = element.querySelector(".bubble-text").style;
    return {bubble, text, left: Number.parseFloat(style.left), top: Number.parseFloat(style.top), right: Number.parseFloat(style.right)};
  });
  assert.ok(safeBounds.text.left >= safeBounds.bubble.left + safeBounds.left - 0.5);
  assert.ok(safeBounds.text.top >= safeBounds.bubble.top + safeBounds.top - 0.5);
  assert.ok(safeBounds.text.right <= safeBounds.bubble.right - safeBounds.right + 0.5);
  assert.ok(safeBounds.text.bottom <= safeBounds.bubble.bottom + 0.5);
  const phoneHeightBeforeScroll = await firstPage.locator(".phone").evaluate(element => element.getBoundingClientRect().height);
  for (let index = 0; index < 12; index += 1) {
    const scrollMessage = `스크롤 메시지 ${index}`;
    await firstPage.locator("#preview-message-input").fill(scrollMessage);
    await firstPage.locator(".preview-send").click();
    await firstPage.locator(".bubble-text").filter({hasText: scrollMessage}).waitFor({state: "attached"});
  }
  await firstPage.locator(".bubble-text").filter({hasText: "스크롤 메시지 11"}).waitFor({state: "attached"});
  const scrollState = await firstPage.locator(".chat").evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
  }));
  const phoneHeightAfterScroll = await firstPage.locator(".phone").evaluate(element => element.getBoundingClientRect().height);
  assert.equal(phoneHeightAfterScroll, phoneHeightBeforeScroll);
  assert.equal(scrollState.overflowY, "auto");
  assert.ok(scrollState.scrollHeight > scrollState.clientHeight);
  assert.ok(scrollState.scrollTop + scrollState.clientHeight >= scrollState.scrollHeight - 1);
  const latestBubbleGeometry = await firstPage.locator(".bubble.me.group").last().evaluate(element => {
    const bubble = element.getBoundingClientRect();
    const canvas = element.querySelector("canvas").getBoundingClientRect();
    const text = element.querySelector(".bubble-text").getBoundingClientRect();
    return {
      declaredHeight: Number.parseFloat(element.style.height),
      bubbleHeight: bubble.height,
      canvasHeight: canvas.height,
      textBottomGap: bubble.bottom - text.bottom,
    };
  });
  assert.ok(latestBubbleGeometry.bubbleHeight >= Math.max(latestBubbleGeometry.declaredHeight, 44) - 0.5, JSON.stringify(latestBubbleGeometry));
  assert.ok(Math.abs(latestBubbleGeometry.canvasHeight - latestBubbleGeometry.bubbleHeight) < 0.5, JSON.stringify(latestBubbleGeometry));
  assert.ok(latestBubbleGeometry.textBottomGap >= -0.5, JSON.stringify(latestBubbleGeometry));
  const firstDownload = firstPage.waitForEvent("download");
  await firstPage.locator("button[type=submit]").click();
  const firstDownloadEvent = await firstDownload;
  const firstFile = await firstDownloadEvent.path();
  assert.ok(firstFile);
  assert.equal(firstDownloadEvent.suggestedFilename(), expectedApkName);
  await firstPage.locator("#snackbar.is-visible").filter({hasText: "공유 링크를 복사했습니다"}).waitFor({state: "visible"});
  const firstSnackbar = await firstPage.locator("#snackbar").textContent();
  assert.equal(firstSnackbar, `${expectedApkName} 다운로드를 시작하고 공유 링크를 복사했습니다.`);
  assert.match(await firstPage.locator("#snackbar").getAttribute("title"), /commonIcoTheme/);
  assert.equal(await firstPage.locator("#snackbar").getAttribute("aria-hidden"), "false");
  const firstCopied = await firstPage.evaluate(() => window.copiedTexts);
  assert.equal(firstCopied.length, 1);
  assert.match(firstCopied[0], new RegExp(`^${expectedApkName} 공유 링크: http://127\\.0\\.0\\.1:${port}/\\?t=[a-f0-9]{64}$`));
  const shareKey = firstCopied[0].match(/\?t=([a-f0-9]{64})$/)[1];
  assert.equal(themes.size, 1);
  assert.ok(themes.has(shareKey));
  assert.equal(decodeURIComponent(themes.get(shareKey).name), basename(fixtures.themePath));
  const outputZip = await JSZip.loadAsync(await readFile(firstFile));
  const outputBytes = new Uint8Array(await readFile(firstFile));
  const resourceEntry = localZipEntry(outputBytes, "resources.arsc");
  assert.equal(resourceEntry.method, 0);
  assert.equal(resourceEntry.dataOffset % 4, 0);
  assert.equal(outputZip.files["res/drawable/theme_background_image.xml"], undefined);
  assert.equal(outputZip.files["res/drawable-xxhdpi/theme_maintab_ico_local_image.png"], undefined);
  const inputZip = await JSZip.loadAsync(await readFile(fixtures.themePath));
  const inputCss = await inputZip.files["KakaoTalkTheme.css"].async("string");
  // 컴파일된 resource table에 CSS 색이 실제로 기록됐는지 확인한다. 값 검증이 없으면
  // 색상 치환이 통째로 멎어도 다른 assertion이 전부 통과한다.
  const outputColors = compiledColorValues(await outputZip.files["resources.arsc"].async("uint8array"));
  const expectedColors = parseTheme(inputCss).colors;
  assert.ok(Object.keys(expectedColors).length >= 3);
  // fixture base는 compiled table 대신 values XML을 쓴다. 실제 base.apk일 때만 값 대조가 성립한다.
  if (Object.keys(outputColors).length) {
    for (const [name, value] of Object.entries(expectedColors)) {
      assert.equal(outputColors[name], value.length === 7 ? `#FF${value.slice(1)}` : value, `${name} 색상 불일치`);
    }
  }
  const previewInset = await firstPage.locator(".bubble.me:not(.group) .bubble-text").evaluate(element => ({
    left: Number.parseFloat(element.style.left),
    top: Number.parseFloat(element.style.top),
    right: Number.parseFloat(element.style.right),
  }));
  const previewNaturalSize = await firstPage.locator(".bubble.me:not(.group)").evaluate(element => ({
    width: Number.parseFloat(element.dataset.naturalWidth),
    height: Number.parseFloat(element.dataset.naturalHeight),
  }));
  const cssSendInsets = edgeInsetsFromCss(inputCss, "MessageCellStyle-Send", "-ios-title-edgeinsets");
  assert.deepEqual(previewInset, {left: cssSendInsets[0], top: cssSendInsets[1], right: cssSendInsets[2]});
  const xhdpiOutput = outputZip.files["res/drawable-xhdpi/theme_background_image.png"];
  const xhdpiInput = inputZip.files["Images/mainBgImage@2x.png"];
  if (xhdpiOutput && xhdpiInput) {
    assert.deepEqual(await xhdpiOutput.async("uint8array"), await xhdpiInput.async("uint8array"));
  }
  const xxhdpiOutput = outputZip.files["res/drawable-xxhdpi/theme_background_image.png"];
  const xxhdpiInput = inputZip.files["Images/mainBgImage@3x.png"];
  if (xxhdpiOutput && xxhdpiInput) {
    assert.deepEqual(await xxhdpiOutput.async("uint8array"), await xxhdpiInput.async("uint8array"));
  }
  const bubbleProperties = {
    "res/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png": ["MessageCellStyle-Send", "-ios-title-edgeinsets", "-ios-background-image"],
    "res/drawable-xxhdpi/theme_chatroom_bubble_me_02_image.9.png": ["MessageCellStyle-Send", "-ios-group-title-edgeinsets", "-ios-group-background-image"],
    "res/drawable-xxhdpi/theme_chatroom_bubble_you_01_image.9.png": ["MessageCellStyle-Receive", "-ios-title-edgeinsets", "-ios-background-image"],
    "res/drawable-xxhdpi/theme_chatroom_bubble_you_02_image.9.png": ["MessageCellStyle-Receive", "-ios-group-title-edgeinsets", "-ios-group-background-image"],
  };
  for (const [path, [blockName, propertyName, stretchProperty]] of Object.entries(bubbleProperties)) {
    const bubbleEntry = outputZip.files[path];
    if (!bubbleEntry) continue;
    const bubbleBytes = await bubbleEntry.async("uint8array");
    assert.ok(Buffer.from(bubbleBytes).includes(Buffer.from("npTc")));
    const chunkTypes = pngChunkTypes(bubbleBytes);
    assert.ok(chunkTypes.indexOf("npOl") > chunkTypes.indexOf("IHDR"));
    assert.equal(chunkTypes.indexOf("npTc"), chunkTypes.indexOf("npOl") + 1);
    assert.ok(chunkTypes.indexOf("npTc") < chunkTypes.indexOf("IDAT"));
    const metadata = ninePatchMetadata(bubbleBytes);
    const padding = edgeInsetsFromCss(inputCss, blockName, propertyName);
    const point = stretchPointFromCss(inputCss, blockName, stretchProperty);
    const scaledPadding = [padding[0], padding[2], padding[1], padding[3]].map(value => Math.round(value * 3));
    const xStart = Math.round(point[0] * 3) + 1;
    const yStart = Math.round(point[1] * 3) + 1;
    assert.deepEqual(metadata.xDivs, [xStart, xStart + 1]);
    assert.deepEqual(metadata.yDivs, [yStart, yStart + 1]);
    assert.deepEqual(metadata.padding, scaledPadding);
    assert.ok(metadata.padding[0] + metadata.padding[1] <= metadata.width - 2);
    assert.ok(metadata.padding[2] + metadata.padding[3] <= metadata.height - 2);
    assert.ok(metadata.width - 2 - metadata.padding[0] - metadata.padding[1] > 0);
    assert.ok(metadata.height - 2 - metadata.padding[2] - metadata.padding[3] > 0);
    if (path === "res/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png") {
      const sourceBytes = await inputZip.files["Images/chatroomBubbleSend01@3x.png"].async("uint8array");
      const sourceSize = pngDimensions(sourceBytes);
      assert.deepEqual(previewNaturalSize, {width: sourceSize.width / 3, height: sourceSize.height / 3});
      assert.deepEqual({width: (metadata.width - 2) / 3, height: (metadata.height - 2) / 3}, previewNaturalSize);
    }
  }
  if (process.env.E2E_OUTPUT) await writeFile(process.env.E2E_OUTPUT, await readFile(firstFile));
  assert.equal(cache.size, 1);
  await firstContext.close();

  const offlineContext = await browser.newContext({acceptDownloads: true});
  await offlineContext.addInitScript(() => {
    window.copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: async text => { window.copiedTexts.push(text); }}});
  });
  await offlineContext.addInitScript(() => {
    window.KTHEME_SHARED_CACHE_URL = "http://127.0.0.1:1/shared-cache";
  });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(`http://127.0.0.1:${port}/`);
  await offlinePage.locator("#theme-file").setInputFiles({name: "뚱카츄.ktheme", mimeType: "application/zip", buffer: await readFile(fixtures.themePath)});
  const offlineDownload = offlinePage.waitForEvent("download");
  await offlinePage.locator("button[type=submit]").click();
  const offlineDownloadEvent = await offlineDownload;
  const offlineFile = await offlineDownloadEvent.path();
  assert.ok(offlineFile);
  assert.equal(offlineDownloadEvent.suggestedFilename(), "뚱카츄.apk");
  await offlinePage.locator("#snackbar.is-visible").filter({hasText: "링크를 복사했습니다"}).waitFor({state: "visible"});
  assert.equal(await offlinePage.locator("#snackbar").textContent(), "뚱카츄.apk 다운로드를 시작하고 이 탭에서만 유효한 링크를 복사했습니다.");
  assert.match((await offlinePage.evaluate(() => window.copiedTexts))[0], /^blob:/);
  await offlineContext.close();

  const secondContext = await browser.newContext({acceptDownloads: true});
  await secondContext.addInitScript(() => {
    window.copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: async text => { window.copiedTexts.push(text); }}});
  });
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`http://127.0.0.1:${port}/`);
  await secondPage.locator("#theme-file").setInputFiles(fixtures.themePath);
  const secondDownload = secondPage.waitForEvent("download");
  await secondPage.locator("button[type=submit]").click();
  const secondDownloadEvent = await secondDownload;
  const secondFile = await secondDownloadEvent.path();
  assert.ok(secondFile);
  assert.equal(secondDownloadEvent.suggestedFilename(), expectedApkName);
  await secondPage.locator("#snackbar.is-visible").filter({hasText: "공유 링크를 복사했습니다"}).waitFor({state: "visible"});
  assert.match(await secondPage.locator("#snackbar").textContent(), /공유 링크를 복사했습니다\.$/);
  assert.equal(await secondPage.locator("#snackbar").getAttribute("title"), null);
  assert.equal((await secondPage.evaluate(() => window.copiedTexts))[0], firstCopied[0]);
  assert.equal(themes.size, 1);
  assert.equal(requests.filter(request => request.startsWith("PUT /shared-cache/")).length, 1);
  assert.equal(requests.filter(request => request.startsWith("GET /shared-cache/")).length, 2);
  await secondContext.close();

  const sharedContext = await browser.newContext({acceptDownloads: true});
  await sharedContext.addInitScript(() => {
    window.copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: async text => { window.copiedTexts.push(text); }}});
  });
  const sharedPage = await sharedContext.newPage();
  await sharedPage.goto(`http://127.0.0.1:${port}/?t=${shareKey}`);
  await sharedPage.locator(".chat-header").waitFor();
  assert.match(await sharedPage.locator("#preview-device").innerText(), /새로운 메시지가 도착했습니다/);
  assert.equal(await sharedPage.locator("button[type=submit]").isDisabled(), false);
  assert.equal(await sharedPage.locator("#theme-file").evaluate(input => input.files[0].name), basename(fixtures.themePath));
  const sharedDownload = sharedPage.waitForEvent("download");
  await sharedPage.locator("button[type=submit]").click();
  assert.equal((await sharedDownload).suggestedFilename(), expectedApkName);
  await sharedPage.locator("#snackbar.is-visible").filter({hasText: "공유 링크를 복사했습니다"}).waitFor({state: "visible"});
  assert.equal((await sharedPage.evaluate(() => window.copiedTexts))[0], firstCopied[0]);
  await sharedContext.close();

  // Android → iOS 역변환. 방금 만든 APK를 되돌려 원본이 보존됐는지 본다.
  const reverseContext = await browser.newContext({acceptDownloads: true});
  await reverseContext.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: async () => {}}});
  });
  const reversePage = await reverseContext.newPage();
  await reversePage.goto(`http://127.0.0.1:${port}/`);
  await reversePage.locator("#theme-file").setInputFiles({name: "themed.apk", mimeType: "application/vnd.android.package-archive", buffer: Buffer.from(outputBytes)});
  await reversePage.locator(".chat-header").waitFor();
  const reverseDownload = reversePage.waitForEvent("download");
  await reversePage.locator("button[type=submit]").click();
  const reverseEvent = await reverseDownload;
  assert.equal(reverseEvent.suggestedFilename(), "themed.ktheme");
  const rebuilt = await JSZip.loadAsync(await readFile(await reverseEvent.path()));
  const rebuiltCss = await rebuilt.files["KakaoTalkTheme.css"].async("string");
  assert.match(rebuiltCss, /ManifestStyle/);
  assert.ok(Object.keys(rebuilt.files).filter(name => name.startsWith("Images/")).length > 0);
  const rebuiltTheme = parseTheme(rebuiltCss);
  const sourceTheme = parseTheme(inputCss);
  // Android가 보존한 부분집합이 기준이다. 대응 resource가 없는 선언은 왕복에서 사라지는 게 정상이다.
  for (const [name, value] of Object.entries(rebuiltTheme.colors)) {
    const expected = sourceTheme.colors[name];
    if (!expected) continue;
    const normalize = color => (color.length === 7 ? `#FF${color.slice(1)}` : color).toUpperCase();
    assert.equal(normalize(value), normalize(expected), `${name} 왕복 색상 불일치`);
  }
  for (const [slot, insets] of Object.entries(rebuiltTheme.edgeInsets)) {
    if (sourceTheme.edgeInsets[slot]) assert.deepEqual(insets, sourceTheme.edgeInsets[slot], `${slot} 왕복 인셋 불일치`);
  }
  for (const [slot, point] of Object.entries(rebuiltTheme.stretchPoints)) {
    if (sourceTheme.stretchPoints[slot]) assert.deepEqual(point, sourceTheme.stretchPoints[slot], `${slot} 왕복 stretch 불일치`);
  }
  await reverseContext.close();
  console.log("E2E PASS: 최초 변환·공용 저장·다른 사용자 즉시 다운로드");
} finally {
  await browser.close();
  await new Promise(resolve => httpServer.close(resolve));
}
