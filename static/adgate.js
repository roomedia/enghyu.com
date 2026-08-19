// 다운로드 보상형 광고 게이트.
//
// 정책은 확정된 네 항목이다.
// - 재생 수단: Google Ad Placement API(adsbygoogle adBreak)
// - 무료 기준: 입력 파일 sha256당 전 세계 첫 다운로드만 무료
// - 파일 식별: 고른 파일 바이트의 sha256. 변환기 판이 바뀌어도 같은 파일이다
// - 적용 범위: 브라우저 캐시 히트·공용 캐시·신규 변환·역변환 네 경로 전부
//
// worker가 안 닿으면 무료 여부를 알 수 없다. 그때는 광고를 강제하고,
// 광고도 못 띄우면 통과시킨다. 다운로드 자체를 막지는 않는다.
import {basePath} from "./base-path.js";

const adsenseClient = () => window.KTHEME_ADSENSE_CLIENT || "";
const claimUrl = () => window.KTHEME_FREE_CLAIM_URL || (location.hostname === "localhost" ? "http://localhost:8787/free-claim" : `${basePath}free-claim`);
const adTimeoutMs = 45000;
let adScriptState = "";

// 무료 1회는 worker가 원자적으로 발급한다. free는 이 다운로드가 무료라는 뜻이고
// known은 판정 자체를 받았는지다. known이 false면 광고를 강제한다.
async function claimFree(sha) {
  try {
    const response = await fetch(`${claimUrl()}/${sha}`, {method: "POST", cache: "no-cache"});
    if (!response.ok) return {free: false, known: false};
    const body = await response.json();
    return {free: Boolean(body.free), known: true};
  } catch {
    return {free: false, known: false};
  }
}

function loadAdScript() {
  const client = adsenseClient();
  if (!client) return Promise.resolve(false);
  if (adScriptState === "ready") return Promise.resolve(true);
  if (adScriptState === "failed") return Promise.resolve(false);
  // index.html이 사이트 확인용으로 같은 스크립트를 head에 정적으로 넣는다. 이미 있으면
  // 두 번 넣지 않는다. 로딩이 끝난 태그에는 load 리스너를 붙여도 안 불리므로 존재만으로
  // ready로 보고, 아직 안 붙은 경우는 adBreak 쪽 타임아웃이 받는다.
  if (document.querySelector('script[src*="adsbygoogle.js"]')) {
    adScriptState = "ready";
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.adFrequencyHint = "30s";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.addEventListener("load", () => { adScriptState = "ready"; resolve(true); });
    script.addEventListener("error", () => { adScriptState = "failed"; resolve(false); });
    document.head.append(script);
  });
}

// adBreak은 콜백으로만 결과를 알려주고 아무 콜백도 안 오는 경우가 있다.
// 그래서 타임아웃을 걸고 그때는 unavailable로 본다.
async function playRewarded() {
  if (!await loadAdScript()) return "unavailable";
  if (typeof window.adBreak !== "function") return "unavailable";
  return new Promise(resolve => {
    let settled = false;
    const settle = result => { if (!settled) { settled = true; resolve(result); } };
    const timer = setTimeout(() => settle("unavailable"), adTimeoutMs);
    const done = result => { clearTimeout(timer); settle(result); };
    try {
      window.adBreak({
        type: "reward",
        name: "download-reward",
        beforeReward: showAdFn => showAdFn(),
        adDismissed: () => done("dismissed"),
        adViewed: () => done("granted"),
        adBreakDone: placementInfo => {
          if (placementInfo?.breakStatus === "viewed") done("granted");
          else if (placementInfo?.breakStatus === "dismissed") done("dismissed");
          else done("unavailable");
        },
      });
    } catch {
      done("unavailable");
    }
  });
}

// 반환값의 allowed가 false면 다운로드를 내보내지 않는다.
// free는 집계용이고 reason은 스낵바 문구를 고르는 데 쓴다.
async function gateDownload({sha, onEvent = () => {}}) {
  if (!sha) return {allowed: true, free: true, reason: "no-hash"};
  const claim = await claimFree(sha);
  if (claim.free) {
    onEvent("free_download_claimed", {});
    return {allowed: true, free: true, reason: "first-download"};
  }
  onEvent("ad_gate_required", {claim_known: claim.known});
  const result = await playRewarded();
  onEvent(`ad_${result}`, {claim_known: claim.known});
  if (result === "granted") return {allowed: true, free: false, reason: "reward-granted"};
  if (result === "unavailable") return {allowed: true, free: false, reason: "ad-unavailable"};
  return {allowed: false, free: false, reason: "ad-dismissed"};
}

export {claimFree, gateDownload, playRewarded};
