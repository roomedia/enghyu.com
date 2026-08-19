// GA4 이벤트 전송과 다운로드 집계. measurement ID가 비면 아무 요청도 안 나간다.
// 파일명은 사용자가 만든 문자열이라 그대로 싣지 않고 정규화해서 보낸다.
import {basePath} from "./base-path.js";

const measurementId = () => window.KTHEME_GA_ID || "";
const countUrl = () => window.KTHEME_DOWNLOAD_COUNT_URL || (location.hostname === "localhost" ? "http://localhost:8787/download-count" : `${basePath}download-count`);
const nameLimit = 60;
let gtagReady = false;

function ensureGtag() {
  const id = measurementId();
  if (!id || gtagReady) return gtagReady;
  // 각 페이지 head가 같은 태그를 정적으로 싣는다. 이미 있으면 스크립트를 두 번 넣지 않고
  // config도 다시 부르지 않는다. 다시 부르면 페이지 조회가 두 번 집계된다.
  if (typeof window.gtag === "function" && document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    gtagReady = true;
    return true;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
  window.gtag("js", new Date());
  window.gtag("config", id, {send_page_view: true});
  gtagReady = true;
  return true;
}

// 확장자를 떼고 공백을 정리한 뒤 길이를 자른다. 경로 구분자와 제어문자는 지운다.
function normalizeThemeName(fileName) {
  const withoutExtension = String(fileName || "").replace(/\.[^.]*$/, "");
  const flattened = withoutExtension
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flattened.slice(0, nameLimit) || "untitled";
}

function sizeBucket(bytes) {
  const kb = Math.max(0, Number(bytes) || 0) / 1024;
  if (kb < 256) return "0-256KB";
  if (kb < 1024) return "256KB-1MB";
  if (kb < 4096) return "1-4MB";
  if (kb < 16384) return "4-16MB";
  return "16MB+";
}

function track(name, params = {}) {
  if (!ensureGtag()) return false;
  window.gtag("event", name, params);
  return true;
}

// 테마 이름+SHA별 다운로드 수는 GA 밖에서도 봐야 하므로 worker에도 남긴다.
// GA 쪽은 표본이 잘릴 수 있고, 이 카운터는 무료 1회 판정과 같은 저장소에 있다.
async function reportDownload({sha, name, source, free, outputType}) {
  if (!sha) return null;
  try {
    const response = await fetch(`${countUrl()}/${sha}`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "X-Theme-Name": encodeURIComponent(name || "")},
      body: JSON.stringify({source, free: Boolean(free), outputType: outputType || ""}),
      cache: "no-cache",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // 집계 실패는 다운로드를 막지 않는다.
    return null;
  }
}

export {normalizeThemeName, reportDownload, sizeBucket, track};
