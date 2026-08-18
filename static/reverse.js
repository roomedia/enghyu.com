// Android 테마 APK를 iOS `.ktheme`으로 되돌린다. 정방향에서 쓰는 매핑 표를
// 그대로 뒤집어 쓰므로 표를 한쪽만 고쳐 어긋나는 일이 없다.
import {compiledColorValues, compiledStringValues} from "./resources.js";
import {
  bubbleInsetProperties,
  bubbleStretchProperties,
  colorPropertiesByTarget,
  densityScaleForPath,
  imageKeyForTarget,
  slotsByTarget,
} from "./theme.js";

// CSS는 iOS point, npTc는 bitmap pixel이다. 되돌릴 때 배율로 나누고 소수점 둘째 자리까지 남긴다.
const pointPrecision = 2;

function toPoint(value, scale) {
  return Number((value / scale).toFixed(pointPrecision));
}

function imageFileName(key, scale) {
  return scale === 1 ? `${key}.png` : `${key}@${scale}x.png`;
}

// 정방향은 `<속성>-alpha`를 색에 합성했다. 되돌릴 때 다시 갈라놓아야 왕복이 맞는다.
function splitAlpha(property, value) {
  const alpha = Number.parseInt(value.slice(1, 3), 16);
  const rgb = `#${value.slice(3)}`;
  if (alpha === 255) return [[property, rgb]];
  return [[property, rgb], [property.replace(/-color$/, "-alpha"), (alpha / 255).toFixed(2)]];
}

function readNinePatch(png) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    if (type === "npTc") {
      const chunk = offset + 8;
      // offset 필드만 little-endian이다. padding과 div는 big-endian.
      return {
        padding: [view.getInt32(chunk + 12), view.getInt32(chunk + 16), view.getInt32(chunk + 20), view.getInt32(chunk + 24)],
        stretch: [view.getInt32(chunk + 32), view.getInt32(chunk + 40)],
      };
    }
    if (type === "IEND") break;
    offset += length + 12;
  }
  return null;
}

// 정방향이 붙인 1px 투명 테두리를 걷어내 원본 비트맵을 복원한다.
async function stripNinePatchBorder(bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes], {type: "image/png"}));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width - 2;
  canvas.height = bitmap.height - 2;
  canvas.getContext("2d").drawImage(bitmap, -1, -1);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function cssBlock(name, declarations) {
  return `${name}\n{\n${declarations.map(([property, value]) => `    ${property}: ${value};`).join("\n")}\n}\n`;
}

function buildCss(name, blocks) {
  const manifest = cssBlock("ManifestStyle", [
    ["-kakaotalk-theme-name", `'${name}'`],
    ["-kakaotalk-theme-version", "'1'"],
    ["-kakaotalk-author-name", "'ktheme2apk'"],
  ]);
  const body = [...blocks.entries()]
    .filter(([, declarations]) => declarations.length)
    .map(([blockName, declarations]) => cssBlock(blockName, declarations))
    .join("\n");
  return `${manifest}\n${body}`;
}

// 같은 이미지가 여러 density에 들어 있으면 배율이 큰 쪽을 쓴다. iOS는 한 배율만 받는다.
function bestDensitySources(zip) {
  const sources = {};
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.startsWith("res/")) continue;
    const basename = path.split("/").pop();
    if (!basename.startsWith("theme_") || !basename.endsWith(".png")) continue;
    const scale = densityScaleForPath(path);
    if (!Number.isInteger(scale)) continue;
    if (!sources[basename] || sources[basename].scale < scale) sources[basename] = {entry, scale};
  }
  return sources;
}

async function apkToTheme(apkBytes) {
  const zip = await JSZip.loadAsync(apkBytes);
  const table = zip.files["resources.arsc"];
  if (!table) throw new Error("resources.arsc가 없습니다. 테마 APK가 아닙니다.");
  const tableBytes = await table.async("uint8array");
  const colors = compiledColorValues(tableBytes);
  const strings = compiledStringValues(tableBytes);
  const name = (strings.theme_title || strings.app_name || "Converted Theme").trim();

  const blocks = new Map();
  const declare = (block, property, value) => {
    if (!blocks.has(block)) blocks.set(block, []);
    blocks.get(block).push([property, value]);
  };

  for (const [target, properties] of Object.entries(colorPropertiesByTarget())) {
    const value = colors[target];
    // pruned된 항목은 값이 없다. 빈 선언을 쓰지 않고 그대로 건너뛴다.
    if (!value) continue;
    for (const [block, property] of properties) {
      for (const [declared, resolved] of splitAlpha(property, value)) declare(block, declared, resolved);
    }
  }

  const outputZip = new JSZip();
  const sources = bestDensitySources(zip);
  const slots = slotsByTarget();
  let exported = 0;
  for (const [target, source] of Object.entries(sources)) {
    const key = imageKeyForTarget(target);
    if (!key) continue;
    const fileName = imageFileName(key, source.scale);
    let bytes = await source.entry.async("uint8array");
    let geometry = null;
    if (target.endsWith(".9.png")) {
      geometry = readNinePatch(bytes);
      bytes = await stripNinePatchBorder(bytes);
    }
    outputZip.file(`Images/${fileName}`, bytes);
    exported += 1;
    const stretchSlot = bubbleStretchProperties[target];
    if (geometry && stretchSlot) {
      // 말풍선만 stretch 기준점과 텍스트 인셋을 갖는다. 탭바 셀 같은 나머지 9-patch는 파일만 참조한다.
      const [x, y] = geometry.stretch;
      declare(stretchSlot[0], stretchSlot[1], `'${fileName}' ${toPoint(x - 1, source.scale)}px ${toPoint(y - 1, source.scale)}px`);
      const insetSlot = bubbleInsetProperties[target];
      const [left, right, top, bottom] = geometry.padding;
      if (insetSlot) {
        declare(insetSlot[0], insetSlot[1], [top, left, bottom, right].map(value => `${toPoint(value, source.scale)}px`).join(" "));
      }
      continue;
    }
    for (const slot of slots[target] || []) {
      const [block, property] = slot.split(":");
      declare(block, property, `'${fileName}'`);
    }
  }
  if (!exported) throw new Error("APK에서 테마 이미지를 찾지 못했습니다.");

  outputZip.file("KakaoTalkTheme.css", buildCss(name, blocks));
  return {
    bytes: await outputZip.generateAsync({type: "uint8array", compression: "DEFLATE"}),
    name,
    colors: Object.keys(colors).length,
    images: exported,
  };
}

export {apkToTheme};
