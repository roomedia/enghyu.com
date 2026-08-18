// Android resource 편집: values XML, 컴파일된 resources.arsc, 앱 identity.
import {decoder, encoder} from "./bytes.js";
import {imageSourcesByDensity} from "./theme.js";

const utf16Decoder = new TextDecoder("utf-16le");

function fixedBytesReplace(bytes, source, target) {
  const output = bytes.slice();
  for (const encoding of [value => encoder.encode(value), value => new Uint8Array([...value].flatMap(character => [character.charCodeAt(0) & 255, character.charCodeAt(0) >> 8]))]) {
    const sourceBytes = encoding(source);
    let targetValue = "";
    for (const character of target) {
      if (encoding(targetValue + character).length > sourceBytes.length) break;
      targetValue += character;
    }
    while (encoding(targetValue + " ").length <= sourceBytes.length) targetValue += " ";
    const targetBytes = encoding(targetValue);
    if (sourceBytes.length !== targetBytes.length) throw new Error("APK identity placeholder length mismatch.");
    for (let offset = 0; offset <= output.length - sourceBytes.length; offset += 1) {
      let match = true;
      for (let index = 0; index < sourceBytes.length; index += 1) {
        if (output[offset + index] !== sourceBytes[index]) { match = false; break; }
      }
      if (match) output.set(targetBytes, offset);
    }
  }
  return output;
}

function identityFor(themeName, key) {
  const slug = (themeName.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "themex").padEnd(6, "x");
  return {
    packageName: `com.ktheme.${slug}_${key.slice(0, 9)}`,
    appName: themeName.trim() || "ktheme",
  };
}

function applyIdentity(apk, themeName, key) {
  const identity = identityFor(themeName, key);
  let output = fixedBytesReplace(apk, "com.ktheme.themex_000000000", identity.packageName);
  output = fixedBytesReplace(output, `ktheme-${"0".repeat(57)}`, identity.appName);
  return output;
}

function replaceXmlColors(data, colors) {
  let xml = decoder.decode(data);
  for (const [name, value] of Object.entries(colors)) {
    const pattern = new RegExp(`(<color\\s+name=["']${name}["']>)[^<]*(</color>)`);
    xml = xml.replace(pattern, `$1${value}$2`);
  }
  const additions = Object.entries(colors)
    .filter(([name]) => !xml.includes(`name="${name}"`))
    .map(([name, value]) => `    <color name="${name}">${value}</color>`)
    .join("\n");
  return encoder.encode(additions ? xml.replace("</resources>", `${additions}\n</resources>`) : xml);
}

function readStringPool(data, offset) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const stringCount = view.getUint32(offset + 8, true);
  const flags = view.getUint32(offset + 16, true);
  const stringsStart = view.getUint32(offset + 20, true);
  const utf8 = (flags & 0x100) !== 0;
  const strings = [];
  const readLeb128 = start => {
    let value = 0;
    let shift = 0;
    let cursor = start;
    for (;;) {
      const byte = data[cursor++];
      value |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return [value, cursor];
      shift += 7;
    }
  };
  for (let index = 0; index < stringCount; index += 1) {
    const stringOffset = view.getUint32(offset + 28 + index * 4, true);
    let cursor = offset + stringsStart + stringOffset;
    if (utf8) {
      [, cursor] = readLeb128(cursor);
      const [byteLength, textStart] = readLeb128(cursor);
      strings.push(decoder.decode(data.slice(textStart, textStart + byteLength)));
    } else {
      const charLength = view.getUint16(cursor, true);
      // UTF-16 pool을 UTF-8로 읽으면 문자 사이에 NUL이 남는다. type pool이 이 형식이다.
      strings.push(utf16Decoder.decode(data.slice(cursor + 2, cursor + 2 + charLength * 2)));
    }
  }
  return strings;
}

function nullCompiledResourceValue(data, valueOffset) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  view.setUint16(valueOffset, 8, true);
  data[valueOffset + 2] = 0;
  data[valueOffset + 3] = 0;
  view.setUint32(valueOffset + 4, 0, true);
}

// resources.arsc의 global string pool과 package 안 type/key pool, type chunk 위치를 한 번에 읽는다.
function compiledTables(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 12 || view.getUint16(0, true) !== 0x0002) return null;
  let globalStrings = null;
  let packageOffset = -1;
  for (let offset = 12; offset + 8 <= data.length;) {
    const type = view.getUint16(offset, true);
    const size = view.getUint32(offset + 4, true);
    if (!size || offset + size > data.length) break;
    if (type === 0x0001 && !globalStrings) globalStrings = readStringPool(data, offset);
    if (type === 0x0200) { packageOffset = offset; break; }
    offset += size;
  }
  if (!globalStrings || packageOffset < 0) return null;
  const packageEnd = packageOffset + view.getUint32(packageOffset + 4, true);
  let typeStrings = null;
  let keyStrings = null;
  const typeChunks = [];
  for (let offset = packageOffset + view.getUint16(packageOffset + 2, true); offset + 8 <= packageEnd;) {
    const type = view.getUint16(offset, true);
    const size = view.getUint32(offset + 4, true);
    if (!size || offset + size > packageEnd) break;
    if (type === 0x0001) {
      if (!typeStrings) typeStrings = readStringPool(data, offset);
      else if (!keyStrings) keyStrings = readStringPool(data, offset);
    } else if (type === 0x0201) {
      typeChunks.push(offset);
    }
    offset += size;
  }
  if (!typeStrings || !keyStrings) return null;
  return {view, globalStrings, typeStrings, keyStrings, typeChunks};
}

// resource 이름과 entry id는 template마다 다르다. 표를 코드에 박아 두면 template을
// 바꿀 때 조용히 어긋나므로 base.apk에서 직접 읽는다.
function compiledEntryIds(data, typeName) {
  const tables = compiledTables(data);
  if (!tables) return {};
  const {view, typeStrings, keyStrings, typeChunks} = tables;
  const wanted = typeStrings.indexOf(typeName) + 1;
  const ids = {};
  for (const chunk of typeChunks) {
    if (data[chunk + 8] !== wanted) continue;
    const entryCount = view.getUint32(chunk + 12, true);
    const entriesStart = view.getUint32(chunk + 16, true);
    const headerSize = view.getUint16(chunk + 2, true);
    for (let entryId = 0; entryId < entryCount; entryId += 1) {
      const entryOffset = view.getUint32(chunk + headerSize + entryId * 4, true);
      if (entryOffset === 0xffffffff) continue;
      const name = keyStrings[view.getUint32(chunk + entriesStart + entryOffset + 4, true)];
      if (name && !(name in ids)) ids[name] = entryId;
    }
  }
  return ids;
}

// 컴파일된 resource table에서 색상 값을 읽는다. 변환 결과 검증과 역방향 변환이 함께 쓴다.
function compiledColorValues(data) {
  const tables = compiledTables(data);
  if (!tables) return {};
  const {view, typeStrings, keyStrings, typeChunks} = tables;
  const wanted = typeStrings.indexOf("color") + 1;
  const values = {};
  for (const chunk of typeChunks) {
    if (data[chunk + 8] !== wanted) continue;
    const entryCount = view.getUint32(chunk + 12, true);
    const entriesStart = view.getUint32(chunk + 16, true);
    const headerSize = view.getUint16(chunk + 2, true);
    for (let entryId = 0; entryId < entryCount; entryId += 1) {
      const entryOffset = view.getUint32(chunk + headerSize + entryId * 4, true);
      if (entryOffset === 0xffffffff) continue;
      const entry = chunk + entriesStart + entryOffset;
      if (view.getUint16(entry + 2, true) & 0x0001) continue;
      const name = keyStrings[view.getUint32(entry + 4, true)];
      const valueOffset = entry + view.getUint16(entry, true);
      if (!name || valueOffset + 8 > data.length) continue;
      // 0x1c = TYPE_INT_COLOR_ARGB8. 그 외는 @null이거나 색상이 아니다.
      if (data[valueOffset + 3] !== 0x1c) continue;
      values[name] = `#${view.getUint32(valueOffset + 4, true).toString(16).padStart(8, "0").toUpperCase()}`;
    }
  }
  return values;
}

// 컴파일된 resource table의 문자열 값. 역방향 변환이 테마 이름을 여기서 읽는다.
function compiledStringValues(data) {
  const tables = compiledTables(data);
  if (!tables) return {};
  const {view, globalStrings, typeStrings, keyStrings, typeChunks} = tables;
  const wanted = typeStrings.indexOf("string") + 1;
  const values = {};
  for (const chunk of typeChunks) {
    if (data[chunk + 8] !== wanted) continue;
    const entryCount = view.getUint32(chunk + 12, true);
    const entriesStart = view.getUint32(chunk + 16, true);
    const headerSize = view.getUint16(chunk + 2, true);
    for (let entryId = 0; entryId < entryCount; entryId += 1) {
      const entryOffset = view.getUint32(chunk + headerSize + entryId * 4, true);
      if (entryOffset === 0xffffffff) continue;
      const entry = chunk + entriesStart + entryOffset;
      if (view.getUint16(entry + 2, true) & 0x0001) continue;
      const name = keyStrings[view.getUint32(entry + 4, true)];
      const valueOffset = entry + view.getUint16(entry, true);
      if (!name || valueOffset + 8 > data.length) continue;
      // 0x03 = TYPE_STRING. 값은 global string pool의 index다.
      if (data[valueOffset + 3] !== 0x03) continue;
      const text = globalStrings[view.getUint32(valueOffset + 4, true)];
      if (text !== undefined) values[name] = text;
    }
  }
  return values;
}

function pruneCompiledResources(data, removedPaths, colors) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 12 || view.getUint16(0, true) !== 0x0002) return data;
  let globalStrings = null;
  let packageOffset = -1;
  for (let offset = 12; offset + 8 <= data.length;) {
    const type = view.getUint16(offset, true);
    const size = view.getUint32(offset + 4, true);
    if (!size || offset + size > data.length) break;
    if (type === 0x0001 && !globalStrings) globalStrings = readStringPool(data, offset);
    if (type === 0x0200) { packageOffset = offset; break; }
    offset += size;
  }
  if (!globalStrings || packageOffset < 0) return data;
  const packageHeaderSize = view.getUint16(packageOffset + 2, true);
  const packageEnd = packageOffset + view.getUint32(packageOffset + 4, true);
  let typeStrings = null;
  let keyStrings = null;
  const typeChunks = [];
  for (let offset = packageOffset + packageHeaderSize; offset + 8 <= packageEnd;) {
    const type = view.getUint16(offset, true);
    const size = view.getUint32(offset + 4, true);
    if (!size || offset + size > packageEnd) break;
    if (type === 0x0001) {
      if (!typeStrings) typeStrings = readStringPool(data, offset);
      else if (!keyStrings) keyStrings = readStringPool(data, offset);
    } else if (type === 0x0201) {
      typeChunks.push(offset);
    }
    offset += size;
  }
  if (!typeStrings || !keyStrings) return data;
  for (const chunk of typeChunks) {
    const typeId = data[chunk + 8];
    const entryCount = view.getUint32(chunk + 12, true);
    const entriesStart = view.getUint32(chunk + 16, true);
    const headerSize = view.getUint16(chunk + 2, true);
    for (let entryId = 0; entryId < entryCount; entryId += 1) {
      const entryOffset = view.getUint32(chunk + headerSize + entryId * 4, true);
      if (entryOffset === 0xffffffff) continue;
      const entry = chunk + entriesStart + entryOffset;
      const entrySize = view.getUint16(entry, true);
      const entryFlags = view.getUint16(entry + 2, true);
      const keyIndex = view.getUint32(entry + 4, true);
      const keyName = keyStrings[keyIndex];
      const valueOffsets = [];
      if (entryFlags & 0x0001) {
        const mapCount = view.getUint32(entry + 12, true);
        for (let mapIndex = 0; mapIndex < mapCount; mapIndex += 1) valueOffsets.push(entry + 16 + mapIndex * 12 + 4);
      } else {
        valueOffsets.push(entry + entrySize);
      }
      for (const valueOffset of valueOffsets) {
        if (valueOffset + 8 > data.length) continue;
        const valueType = data[valueOffset + 3];
        const valueData = view.getUint32(valueOffset + 4, true);
        if (valueType === 0x03 && removedPaths.has(globalStrings[valueData])) nullCompiledResourceValue(data, valueOffset);
        if (typeId === 1 && keyName?.startsWith("theme_") && !Object.hasOwn(colors, keyName)) nullCompiledResourceValue(data, valueOffset);
      }
    }
  }
  return data;
}

// selector XML은 normal/focused 이미지가 둘 다 있어야 의미가 있다.
const tabIconHelpers = {
  "theme_tab_call_icon.xml": ["theme_maintab_ico_call_image.png", "theme_maintab_ico_call_focused_image.png"],
  "theme_tab_chats_icon.xml": ["theme_maintab_ico_chats_image.png", "theme_maintab_ico_chats_focused_image.png"],
  "theme_tab_friend_icon.xml": ["theme_maintab_ico_friends_image.png", "theme_maintab_ico_friends_focused_image.png"],
  "theme_tab_more_icon.xml": ["theme_maintab_ico_more_image.png", "theme_maintab_ico_more_focused_image.png"],
  "theme_tab_now_icon.xml": ["theme_maintab_ico_now_image.png", "theme_maintab_ico_now_focused_image.png"],
  "theme_tab_piccoma_icon.xml": ["theme_maintab_ico_piccoma_image.png", "theme_maintab_ico_piccoma_focused_image.png"],
  "theme_tab_shopping_icon.xml": ["theme_maintab_ico_shopping_image.png", "theme_maintab_ico_shopping_focused_image.png"],
};
const addFriendImages = ["theme_find_add_friend_button_image.png", "theme_find_add_friend_button_pressed_image.png"];

const colorHelpers = {
  "res/color/theme_description_color_selector.xml": ["theme_description_color", "theme_description_pressed_color"],
  "res/color/theme_feature_gift_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_feature_music_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_feature_primary_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_paragraph_color_selector.xml": ["theme_paragraph_color", "theme_paragraph_pressed_color"],
  "res/color/theme_passcode_keypad_color_selector.xml": ["theme_passcode_keypad_color", "theme_passcode_keypad_pressed_color"],
  "res/color/theme_title_color_selector.xml": ["theme_title_color", "theme_title_pressed_color"],
};

function themeResourcePathsToRemove(baseZip, images, colors, byTarget) {
  const remove = new Set();
  const imageKeys = new Set(Object.keys(images));
  const hasAll = targets => targets.every(target => imageKeys.has(byTarget[target]));
  const colorHasAll = keys => keys.every(key => Object.hasOwn(colors, key));
  for (const path of Object.keys(baseZip.files)) {
    if (baseZip.files[path].dir) continue;
    const basename = path.split("/").pop();
    const key = byTarget[basename];
    if (key && !imageSourcesByDensity(images, key, path)) remove.add(path);
    if (path === "res/drawable/theme_background_image.xml") remove.add(path);
    if (basename === "theme_find_add_friend_button_image_selector.xml" && !hasAll(addFriendImages)) remove.add(path);
    if (tabIconHelpers[basename] && !hasAll(tabIconHelpers[basename])) remove.add(path);
    if (colorHelpers[path] && !colorHasAll(colorHelpers[path])) remove.add(path);
    if (path === "res/drawable/theme_body_cell_color_selector.xml" && !colorHasAll(["theme_body_cell_color", "theme_body_cell_pressed_color"])) remove.add(path);
    if (path === "res/drawable/theme_notification_background.xml" && !colorHasAll(["theme_notification_background_color", "theme_notification_background_pressed_color"])) remove.add(path);
    if (path === "res/drawable/theme_passcode_keypad_background_color_land.xml" && !colorHasAll(["theme_passcode_keypad_background_color"])) remove.add(path);
    if (path === "res/drawable/theme_passcode_keypad_pressed_background_color_selector.xml" && !colorHasAll(["theme_passcode_keypad_pressed_background_color"])) remove.add(path);
  }
  return remove;
}

function replaceName(data, name) {
  return encoder.encode(decoder.decode(data).replace(/(<string\s+name=["'](?:app_name|theme_title)["']>)[^<]*(<\/string>)/g, `$1${name}$2`));
}

function compiledColorValue(value) {
  const normalized = value.slice(1);
  return Number.parseInt(normalized.length === 6 ? `ff${normalized}` : normalized, 16);
}

function replaceCompiledColors(data, colors) {
  const output = data.slice();
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const colorIds = compiledEntryIds(data, "color");
  const replacements = Object.entries(colors)
    .filter(([name]) => name in colorIds)
    .map(([name, value]) => [colorIds[name], compiledColorValue(value)]);
  for (let offset = 12; offset + 8 <= output.length;) {
    const type = view.getUint16(offset, true);
    const size = view.getUint32(offset + 4, true);
    if (!size) break;
    if (type === 0x0200) {
      const packageEnd = offset + size;
      for (let child = offset + view.getUint16(offset + 2, true); child + 20 <= packageEnd;) {
        const childType = view.getUint16(child, true);
        const childSize = view.getUint32(child + 4, true);
        if (childType === 0x0201) {
          const typeId = output[child + 8];
          const entryCount = view.getUint32(child + 12, true);
          const entriesStart = view.getUint32(child + 16, true);
          for (const [entryId, value] of replacements) {
            if (typeId !== 1 || entryId >= entryCount) continue;
            const entryOffset = view.getUint32(child + view.getUint16(child + 2, true) + entryId * 4, true);
            if (entryOffset === 0xffffffff) continue;
            const valueOffset = child + entriesStart + entryOffset + 8;
            if (view.getUint16(valueOffset, true) === 8 && output[valueOffset + 3] === 0x1c) view.setUint32(valueOffset + 4, value, true);
          }
        }
        child += childSize;
      }
    }
    offset += size;
  }
  return output;
}

export {
  applyIdentity,
  compiledColorValues,
  compiledStringValues,
  pruneCompiledResources,
  replaceCompiledColors,
  replaceName,
  replaceXmlColors,
  themeResourcePathsToRemove,
};
