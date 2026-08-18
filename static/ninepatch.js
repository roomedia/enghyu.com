// iOS 말풍선 PNG를 Android 9-patch(npTc)로 다시 쓴다.
import {concat, encoder} from "./bytes.js";

function pngChunk(type, data) {
  const bytes = concat(encoder.encode(type), data);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const checksum = new Uint8Array(4);
  new DataView(checksum.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  return concat(length, bytes, checksum);
}

function scaledInsets(insets, scale) {
  return insets.map(value => Math.round(value * scale));
}

function ninePatchChunk(width, height, insets, stretchPoint) {
  const chunk = new Uint8Array(84);
  const [left, top, right, bottom] = insets;
  const [stretchX, stretchY] = stretchPoint;
  const xStart = Math.round(stretchX) + 1;
  const yStart = Math.round(stretchY) + 1;
  // Match iOS CSS: repeat only one source cell.
  const xEnd = xStart + 1;
  const yEnd = yStart + 1;
  if (xStart < 1 || xStart >= xEnd || xEnd > width - 1 || yStart < 1 || yStart >= yEnd || yEnd > height - 1) {
    throw new Error("iOS 말풍선 stretch point가 이미지 경계를 벗어났습니다.");
  }
  if (left < 0 || right < 0 || top < 0 || bottom < 0 || left + right > width - 2 || top + bottom > height - 2) {
    throw new Error("iOS 말풍선 edgeinsets가 이미지 영역보다 큽니다.");
  }
  chunk.set([0, 2, 2, 9], 0);
  const view = new DataView(chunk.buffer);
  // Android's serialized Res_png_9patch keeps the three in-memory offset
  // fields in host/little-endian form, while deviceToFile() converts padding,
  // divs, and colors to network/big-endian form. PNG chunk length/CRC fields
  // remain big-endian as usual.
  view.setInt32(4, 32, true);
  view.setInt32(8, 40, true);
  view.setInt32(12, left, false);
  view.setInt32(16, right, false);
  view.setInt32(20, top, false);
  view.setInt32(24, bottom, false);
  view.setInt32(28, 48, true);
  view.setInt32(32, xStart, false);
  view.setInt32(36, xEnd, false);
  view.setInt32(40, yStart, false);
  view.setInt32(44, yEnd, false);
  for (let offset = 48; offset < chunk.length; offset += 4) view.setInt32(offset, 1, false);
  return pngChunk("npTc", chunk);
}

function ninePatchOutlineChunk() {
  // Keep the same optional outline chunk emitted by Android's aapt. Older
  // readers ignore it; Android 16's NinePatch peeker expects the canonical
  // npOl -> npTc ordering before the image data chunks.
  return pngChunk("npOl", new Uint8Array(24));
}

async function toNinePatch(entry, insets, stretchPoint, scale = 1) {
  const blob = await entry.async("blob");
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width + 2;
  canvas.height = bitmap.height + 2;
  canvas.getContext("2d").drawImage(bitmap, 1, 1);
  bitmap.close();
  const encoded = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  const png = new Uint8Array(await encoded.arrayBuffer());
  let end = png.length;
  let firstIdat = -1;
  for (let offset = 8; offset < png.length;) {
    const length = new DataView(png.buffer, png.byteOffset + offset).getUint32(0);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    if (type === "IDAT" && firstIdat < 0) firstIdat = offset;
    if (type === "IEND") { end = offset; break; }
    offset += length + 12;
  }
  if (firstIdat < 0) throw new Error("PNG IDAT chunk을 찾지 못했습니다.");
  return concat(
    png.slice(0, firstIdat),
    ninePatchOutlineChunk(),
    ninePatchChunk(canvas.width, canvas.height, scaledInsets(insets, scale), stretchPoint.map(value => value * scale)),
    png.slice(firstIdat),
  );
}

export {toNinePatch};
