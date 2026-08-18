const keyPattern = /^[a-f0-9]{64}$/;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Theme-Name",
  "Access-Control-Expose-Headers": "X-Theme-Name",
};
const apkType = "application/vnd.android.package-archive";
const themeType = "application/zip";
const maxBodySize = 64 * 1024 * 1024;

function responseHeaders(extra = {}) {
  return {...corsHeaders, ...extra};
}

// 공유 링크가 가리키는 원본 .ktheme과 변환 결과 APK를 같은 hash key로 보관한다.
// 방문자는 .ktheme만 받아도 브라우저에서 직접 변환할 수 있다.
const buckets = {
  "shared-cache": {objectKey: key => `signed/${key}.apk`, contentType: apkType},
  "shared-theme": {objectKey: key => `theme/${key}.ktheme`, contentType: themeType},
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {headers: responseHeaders()});
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(shared-cache|shared-theme)\/([a-f0-9]{64})$/);
    if (!match) return new Response("Not found", {status: 404, headers: responseHeaders()});
    if (!keyPattern.test(match[2])) return new Response("Bad cache key", {status: 400, headers: responseHeaders()});

    const bucket = buckets[match[1]];
    const objectKey = bucket.objectKey(match[2]);
    if (request.method === "GET") {
      const object = await env.KTHEME_CACHE.get(objectKey);
      if (!object) return new Response("Cache miss", {status: 404, headers: responseHeaders()});
      const name = object.customMetadata?.name;
      return new Response(object.body, {headers: responseHeaders({
        "Content-Type": bucket.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "HIT",
        ...(name ? {"X-Theme-Name": name} : {}),
      })});
    }
    if (request.method === "PUT") {
      const body = await request.arrayBuffer();
      if (body.byteLength > maxBodySize) return new Response("Body too large", {status: 413, headers: responseHeaders()});
      const existing = await env.KTHEME_CACHE.head(objectKey);
      // 파일명은 HTTP 헤더가 ASCII만 허용하므로 클라이언트가 percent-encoding한 값을 그대로 보관한다.
      const name = request.headers.get("X-Theme-Name") || undefined;
      if (!existing) await env.KTHEME_CACHE.put(objectKey, body, {httpMetadata: {contentType: bucket.contentType}, customMetadata: name ? {name} : undefined});
      return new Response(null, {status: 204, headers: responseHeaders({"X-Cache": existing ? "EXISTS" : "STORED"})});
    }
    return new Response("Method not allowed", {status: 405, headers: responseHeaders({Allow: "GET, PUT, OPTIONS"})});
  },
};
