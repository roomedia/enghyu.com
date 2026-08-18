// 바이트 조립과 SHA-256 유틸. APK 서명·해시 계산이 공유한다.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const u32 = value => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes; };
const u64 = value => { const bytes = new Uint8Array(8); new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true); return bytes; };
const concat = (...parts) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};
const lengthPrefixed = value => concat(u32(value.length), value);
const digest = async value => new Uint8Array(await crypto.subtle.digest("SHA-256", value));
async function apkContentDigest(sections) {
  const chunkSize = 1024 * 1024;
  const chunkDigests = [];
  for (const section of sections) {
    for (let offset = 0; offset < section.length; offset += chunkSize) {
      const chunk = section.slice(offset, Math.min(offset + chunkSize, section.length));
      chunkDigests.push(await digest(concat(new Uint8Array([0xa5]), u32(chunk.length), chunk)));
    }
  }
  return digest(concat(new Uint8Array([0x5a]), u32(chunkDigests.length), ...chunkDigests));
}
const hex = value => [...value].map(item => item.toString(16).padStart(2, "0")).join("");

export {apkContentDigest, concat, decoder, digest, encoder, hex, lengthPrefixed, u64};
