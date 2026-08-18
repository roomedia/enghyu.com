// Android resource 편집: values XML, 컴파일된 resources.arsc, 앱 identity.
import {decoder, encoder} from "./bytes.js";
import {imageSourcesByDensity, imageTargets} from "./theme.js";

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
      strings.push(decoder.decode(data.slice(cursor + 2, cursor + 2 + charLength * 2)));
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

const tabIconHelpers = {
  "theme_tab_call_icon.xml": ["maintabIcoCall", "maintabIcoCallSelected"],
  "theme_tab_chats_icon.xml": ["maintabIcoChats", "maintabIcoChatsSelected"],
  "theme_tab_friend_icon.xml": ["maintabIcoFriends", "maintabIcoFriendsSelected"],
  "theme_tab_more_icon.xml": ["maintabIcoMore", "maintabIcoMoreSelected"],
  "theme_tab_now_icon.xml": ["maintabIcoNow", "maintabIcoNowSelected"],
  "theme_tab_piccoma_icon.xml": ["maintabIcoPiccoma", "maintabIcoPiccomaSelected"],
  "theme_tab_shopping_icon.xml": ["maintabIcoShopping", "maintabIcoShoppingSelected"],
};

const colorHelpers = {
  "res/color/theme_description_color_selector.xml": ["theme_description_color", "theme_description_pressed_color"],
  "res/color/theme_feature_gift_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_feature_music_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_feature_primary_color_selector.xml": ["theme_feature_primary_color", "theme_feature_primary_pressed_color"],
  "res/color/theme_paragraph_color_selector.xml": ["theme_paragraph_color", "theme_paragraph_pressed_color"],
  "res/color/theme_passcode_keypad_color_selector.xml": ["theme_passcode_keypad_color", "theme_passcode_keypad_pressed_color"],
  "res/color/theme_title_color_selector.xml": ["theme_title_color", "theme_title_pressed_color"],
};

function themeResourcePathsToRemove(baseZip, images, colors) {
  const remove = new Set();
  const imageKeys = new Set(Object.keys(images));
  const hasAll = keys => keys.every(key => imageKeys.has(key));
  const colorHasAll = keys => keys.every(key => Object.hasOwn(colors, key));
  for (const path of Object.keys(baseZip.files)) {
    if (baseZip.files[path].dir) continue;
    const target = Object.entries(imageTargets).find(([, filename]) => path.endsWith(`/${filename}`));
    if (target && !imageSourcesByDensity(images, target[0], path)) remove.add(path);
    const basename = path.split("/").pop();
    if (path === "res/drawable/theme_background_image.xml") remove.add(path);
    if (path.includes("/theme_find_add_friend_button_") || path.endsWith("/theme_find_add_friend_button_image_selector.xml")) remove.add(path);
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

const compiledColorIds = {
  theme_background_color: 0x03,
  theme_body_secondary_cell_color: 0x07,
  theme_body_cell_color: 0x05,
  theme_body_cell_pressed_color: 0x06,
  theme_chatroom_background_color: 0x08,
  theme_chatroom_bubble_me_color: 0x09,
  theme_chatroom_bubble_you_color: 0x0a,
  theme_chatroom_input_bar_background_color: 0x0b,
  theme_chatroom_input_bar_color: 0x0c,
  theme_chatroom_input_bar_menu_button_color: 0x0d,
  theme_chatroom_input_bar_menu_icon_color: 0x0e,
  theme_chatroom_input_bar_send_button_color: 0x0f,
  theme_chatroom_input_bar_send_icon_color: 0x10,
  theme_chatroom_unread_count_color: 0x11,
  theme_description_color: 0x12,
  theme_description_pressed_color: 0x14,
  theme_direct_share_background_color: 0x15,
  theme_direct_share_button_color: 0x16,
  theme_direct_share_color: 0x17,
  theme_feature_primary_color: 0x1c,
  theme_header_color: 0x20,
  theme_maintab_cell_color: 0x21,
  theme_notification_background_color: 0x22,
  theme_notification_color: 0x24,
  theme_paragraph_color: 0x25,
  theme_paragraph_pressed_color: 0x27,
  theme_passcode_background_color: 0x28,
  theme_passcode_keypad_background_color: 0x2a,
  theme_passcode_keypad_color: 0x2b,
  theme_section_title_color: 0x30,
  theme_title_color: 0x33,
  theme_title_pressed_color: 0x35,
};

function compiledColorValue(value) {
  const normalized = value.slice(1);
  return Number.parseInt(normalized.length === 6 ? `ff${normalized}` : normalized, 16);
}

function replaceCompiledColors(data, colors) {
  const output = data.slice();
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const replacements = Object.entries(colors)
    .filter(([name]) => compiledColorIds[name])
    .map(([name, value]) => [compiledColorIds[name], compiledColorValue(value)]);
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
  pruneCompiledResources,
  replaceCompiledColors,
  replaceName,
  replaceXmlColors,
  themeResourcePathsToRemove,
};
