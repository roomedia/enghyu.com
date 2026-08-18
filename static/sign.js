// 브라우저 RSA 키로 만드는 자체 서명 인증서와 APK Signature Scheme v2 블록.
import {apkContentDigest, concat, encoder, lengthPrefixed, u64} from "./bytes.js";
import {apkSections} from "./apk.js";

function derLength(length) {
  if (length < 128) return new Uint8Array([length]);
  const bytes = []; let value = length;
  while (value) { bytes.unshift(value & 255); value >>>= 8; }
  return concat(new Uint8Array([0x80 | bytes.length]), new Uint8Array(bytes));
}
const der = (tag, value) => concat(new Uint8Array([tag]), derLength(value.length), value);
const sequence = (...values) => der(0x30, concat(...values));
const integer = value => der(0x02, value[0] & 0x80 ? concat(new Uint8Array([0]), value) : value);
const oid = value => der(0x06, new Uint8Array(value));
const nullValue = () => new Uint8Array([0x05, 0]);
const rsaAlgorithm = () => sequence(oid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]), nullValue());
const bitString = value => der(0x03, concat(new Uint8Array([0]), value));
const utf8 = value => der(0x0c, encoder.encode(value));

async function certificate(keyPair, publicKey) {
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
  const commonName = sequence(oid([0x55, 0x04, 0x03]), utf8("ktheme browser"));
  const name = sequence(der(0x31, commonName));
  const formatDate = date => date.toISOString().replace(/[-:TZ.]/g, "").slice(2, 14) + "Z";
  const now = new Date(); const later = new Date(now.getTime() + 31536000000);
  const validity = sequence(der(0x17, encoder.encode(formatDate(now))), der(0x17, encoder.encode(formatDate(later))));
  const tbs = sequence(der(0xa0, integer(new Uint8Array([2]))), integer(new Uint8Array([1])), rsaAlgorithm(), name, validity, name, spki);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, tbs));
  return sequence(tbs, rsaAlgorithm(), bitString(signature));
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function bytesFromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function signingKey() {
  const stored = localStorage.getItem("ktheme-signing-key-v1");
  if (stored) {
    const record = JSON.parse(stored);
    return {
      privateKey: await crypto.subtle.importKey("pkcs8", bytesFromBase64(record.privateKey), {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, true, ["sign"]),
      publicKey: await crypto.subtle.importKey("spki", bytesFromBase64(record.publicKey), {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, true, ["verify"]),
    };
  }
  const pair = await crypto.subtle.generateKey({name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256"}, true, ["sign", "verify"]);
  localStorage.setItem("ktheme-signing-key-v1", JSON.stringify({
    privateKey: base64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))),
    publicKey: base64(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))),
  }));
  return pair;
}

function signingBlock(signedData, signature, spki, blockId = new Uint8Array([0x1a, 0x87, 0x09, 0x71])) {
  const algorithm = new Uint8Array([0x03, 0x01, 0, 0]);
  const signer = concat(lengthPrefixed(signedData), lengthPrefixed(lengthPrefixed(concat(algorithm, lengthPrefixed(signature)))), lengthPrefixed(spki));
  const value = lengthPrefixed(lengthPrefixed(signer));
  const pair = concat(u64(4 + value.length), blockId, value);
  const size = pair.length + 24;
  return concat(u64(size), pair, u64(size), encoder.encode("APK Sig Block 42"));
}

function signedDataFor(apkDigest, cert) {
  const algorithm = new Uint8Array([0x03, 0x01, 0, 0]);
  return concat(lengthPrefixed(lengthPrefixed(concat(algorithm, lengthPrefixed(apkDigest)))), lengthPrefixed(lengthPrefixed(cert)), lengthPrefixed(new Uint8Array()));
}

async function signApk(apk) {
  const keyPair = await signingKey();
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const cert = await certificate(keyPair, keyPair.publicKey);
  const {prefix, central, eocd} = apkSections(apk);
  const placeholderData = signedDataFor(new Uint8Array(32), cert);
  const placeholderBlock = signingBlock(placeholderData, new Uint8Array(256), spki);
  const adjustedEocd = eocd.slice();
  // The digest covers each APK content section independently. The EOCD used
  // for the digest points to the original central-directory offset; the final
  // EOCD is adjusted after the signing block has been inserted.
  new DataView(adjustedEocd.buffer, adjustedEocd.byteOffset, adjustedEocd.byteLength).setUint32(16, prefix.length, true);
  const apkDigest = await apkContentDigest([prefix, central, adjustedEocd]);
  const signedData = signedDataFor(apkDigest, cert);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, signedData));
  const finalBlock = signingBlock(signedData, signature, spki);
  if (finalBlock.length !== placeholderBlock.length) throw new Error("APK 서명 크기 계산 오류");
  adjustedEocd.set(eocd);
  new DataView(adjustedEocd.buffer, adjustedEocd.byteOffset, adjustedEocd.byteLength).setUint32(16, prefix.length + finalBlock.length, true);
  return concat(prefix, finalBlock, central, adjustedEocd);
}

export {signApk};
