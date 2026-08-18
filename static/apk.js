// base.apk 로드와 테마 적용 APK 조립. ZIP 정렬까지 담당한다.
import {concat, decoder} from "./bytes.js";
import {toNinePatch} from "./ninepatch.js";
import {
  applyIdentity,
  pruneCompiledResources,
  replaceCompiledColors,
  replaceName,
  replaceXmlColors,
  themeResourcePathsToRemove,
} from "./resources.js";
import {
  bubbleInsetProperties,
  bubbleStretchProperties,
  imageKey,
  imageSourcesByDensity,
  imageTargets,
  parseTheme,
  sourceScaleForPath,
  unsupportedImageInputs,
} from "./theme.js";

const baseCacheName = "ktheme-base-v2";

async function loadBase() {
  const cache = await caches.open(baseCacheName);
  const cached = await cache.match("/base.apk");
  if (cached) return cached.arrayBuffer();
  const response = await fetch("/base.apk", {cache: "no-cache"});
  if (!response.ok) throw new Error("base.apk를 불러오지 못했습니다.");
  await cache.put("/base.apk", response.clone());
  return response.arrayBuffer();
}

async function convertTheme(baseBytes, themeBytes, key) {
  const baseZip = await JSZip.loadAsync(baseBytes);
  const themeZip = await JSZip.loadAsync(themeBytes);
  const cssEntry = themeZip.files["KakaoTalkTheme.css"];
  if (!cssEntry) throw new Error("KakaoTalkTheme.css가 없습니다.");
  const {colors, edgeInsets, stretchPoints, name} = parseTheme(await cssEntry.async("string"));
  const images = {};
  for (const [path, entry] of Object.entries(themeZip.files)) {
    if (!path.startsWith("Images/") || entry.dir) continue;
    const key = imageKey(path);
    const scale = sourceScaleForPath(path);
    images[key] ||= {};
    if (images[key][scale]) throw new Error(`동일 이미지의 density가 중복됩니다: ${path}`);
    images[key][scale] = {entry, scale};
  }
  const unsupported = unsupportedImageInputs(images);
  const removedPaths = themeResourcePathsToRemove(baseZip, images, colors);
  const outputZip = new JSZip();
  let replaced = 0;
  let removed = 0;
  for (const [path, entry] of Object.entries(baseZip.files)) {
    if (removedPaths.has(path)) {
      removed += 1;
      continue;
    }
    let data = await entry.async("uint8array");
    const target = Object.entries(imageTargets).find(([, filename]) => path.endsWith(`/${filename}`));
    const source = target ? imageSourcesByDensity(images, target[0], path) : null;
    if (target && source) {
      if (path.endsWith(".9.png")) {
        const insetProperty = bubbleInsetProperties[path.split("/").pop()];
        const stretchProperty = bubbleStretchProperties[path.split("/").pop()];
        const insets = insetProperty ? edgeInsets[`${insetProperty[0]}:${insetProperty[1]}`] : [1, 1, 1, 1];
        const stretchPoint = stretchProperty ? stretchPoints[`${stretchProperty[0]}:${stretchProperty[1]}`] : [1, 1];
        if (insetProperty && !insets) throw new Error(`${path}에 대응하는 iOS edgeinsets가 없습니다.`);
        if (stretchProperty && !stretchPoint) throw new Error(`${path}에 대응하는 iOS background-image stretch point가 없습니다.`);
        data = await toNinePatch(source.entry, insets, stretchPoint, source.scale);
      } else {
        data = await source.entry.async("uint8array");
      }
      replaced += 1;
    }
    if (path.includes("/values/") && path.endsWith("colors.xml") && data[0] === 60) data = replaceXmlColors(data, colors);
    if (path.includes("/values/") && path.endsWith("strings.xml") && data[0] === 60) data = replaceName(data, name);
    if (path === "resources.arsc") {
      data = pruneCompiledResources(data, removedPaths, colors);
      data = replaceCompiledColors(data, colors);
    }
    if (path === "AndroidManifest.xml" || path === "resources.arsc") data = applyIdentity(data, name, key);
    outputZip.file(path, data, {date: entry.date, compression: path === "resources.arsc" ? "STORE" : "DEFLATE"});
  }
  if (!replaced) throw new Error("base.apk에서 교체 가능한 테마 이미지가 없습니다.");
  return {
    bytes: alignResourceTable(await outputZip.generateAsync({type: "uint8array", compression: "STORE"})),
    name,
    removed,
    warnings: unsupported.map(key => `대응 resource가 없어 출력에서 제외합니다: ${key}`),
  };
}

function apkSections(apk) {
  let eocd = -1;
  for (let index = apk.length - 22; index >= 0; index -= 1) {
    if (apk[index] === 0x50 && apk[index + 1] === 0x4b && apk[index + 2] === 0x05 && apk[index + 3] === 0x06) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("ZIP EOCD를 찾지 못했습니다.");
  const view = new DataView(apk.buffer, apk.byteOffset, apk.byteLength);
  const centralOffset = view.getUint32(eocd + 16, true);
  const commentLength = view.getUint16(eocd + 20, true);
  return {prefix: apk.slice(0, centralOffset), central: apk.slice(centralOffset, eocd), eocd: apk.slice(eocd, eocd + 22 + commentLength)};
}

function alignResourceTable(apk) {
  const view = new DataView(apk.buffer, apk.byteOffset, apk.byteLength);
  let eocd = -1;
  for (let index = apk.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("ZIP EOCD를 찾지 못했습니다.");
  const centralOffset = view.getUint32(eocd + 16, true);
  const insertions = [];
  for (let offset = centralOffset; offset < eocd;) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP central directory entry를 찾지 못했습니다.");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(apk.slice(offset + 46, offset + 46 + nameLength));
    if (name === "resources.arsc") {
      const localOffset = view.getUint32(offset + 42, true);
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("resources.arsc local header를 찾지 못했습니다.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (view.getUint16(offset + 10, true) !== 0) throw new Error("resources.arsc가 STORE 압축이 아닙니다.");
      if (dataOffset % 4 !== 0) {
        const required = 4 - (dataOffset % 4);
        const padding = required < 4 ? required + 4 : required;
        const field = new Uint8Array(padding);
        new DataView(field.buffer).setUint16(0, 0xffff, true);
        new DataView(field.buffer).setUint16(2, padding - 4, true);
        insertions.push({offset: dataOffset, localOffset, padding, field});
      }
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!insertions.length) return apk;
  const localBytes = apk.slice(0, centralOffset);
  for (const insertion of insertions) {
    const localView = new DataView(localBytes.buffer, localBytes.byteOffset, localBytes.byteLength);
    localView.setUint16(insertion.localOffset + 28, localView.getUint16(insertion.localOffset + 28, true) + insertion.padding, true);
  }
  const parts = [];
  let previous = 0;
  for (const insertion of insertions) {
    parts.push(localBytes.slice(previous, insertion.offset), insertion.field);
    previous = insertion.offset;
  }
  parts.push(localBytes.slice(previous));
  const localData = concat(...parts);
  const centralParts = [];
  for (let offset = centralOffset; offset < eocd;) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP central directory entry를 찾지 못했습니다.");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryLength = 46 + nameLength + extraLength + commentLength;
    const entry = apk.slice(offset, offset + entryLength);
    const entryView = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
    const localOffset = entryView.getUint32(42, true);
    const shift = insertions.filter(item => item.offset <= localOffset).reduce((sum, item) => sum + item.padding, 0);
    if (shift) entryView.setUint32(42, localOffset + shift, true);
    const target = insertions.find(item => item.localOffset === localOffset);
    if (target) {
      entryView.setUint16(30, extraLength + target.padding, true);
      centralParts.push(entry.slice(0, 46 + nameLength + extraLength), target.field, entry.slice(46 + nameLength + extraLength));
    } else {
      centralParts.push(entry);
    }
    offset += entryLength;
  }
  const central = concat(...centralParts);
  const adjustedEocd = apk.slice(eocd, eocd + 22 + view.getUint16(eocd + 20, true));
  const adjustedEocdView = new DataView(adjustedEocd.buffer, adjustedEocd.byteOffset, adjustedEocd.byteLength);
  adjustedEocdView.setUint32(12, central.length, true);
  adjustedEocdView.setUint32(16, localData.length, true);
  return concat(localData, central, adjustedEocd);
}

export {apkSections, convertTheme, loadBase};
