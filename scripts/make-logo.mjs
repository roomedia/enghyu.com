// 600x600 투명 PNG 로고. 다크모드 대비는 노란 면이 스스로 배경을 만드는 방식으로 확보한다.
// 정방형은 콘텐츠 380px, 가로형은 폭 450px 안에 넣는다.
import {chromium} from "playwright";
import {writeFile} from "node:fs/promises";

const YELLOW = "#FEE500";
const INK = "#191919";

const page = (inner) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent;}
  body{width:600px;height:600px;display:grid;place-items:center;}
  .mark{font-family:"Apple SD Gothic Neo","Noto Sans KR",sans-serif;}
</style></head><body>${inner}</body></html>`;

// 정방형: 380x380 라운드 스퀘어 + "카톡"
const square = page(`
<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <rect x="110" y="110" width="380" height="380" rx="112" fill="${YELLOW}"/>
  <text class="mark" x="300" y="300" fill="${INK}" font-size="152" font-weight="900"
        letter-spacing="-6" text-anchor="middle" dominant-baseline="central">카톡</text>
  <text class="mark" x="300" y="392" fill="${INK}" font-size="40" font-weight="800"
        letter-spacing="14" text-anchor="middle" dominant-baseline="central" opacity="0.72">THEME</text>
</svg>`);

// 가로형: 450x146 라운드 필 + 한 줄 워드마크. 텍스트 폭 계측이 필요해 flex로 짠다.
const wide = page(`
<div style="width:450px;height:146px;border-radius:44px;background:${YELLOW};
            display:flex;align-items:center;justify-content:center;gap:22px;">
  <div class="mark" style="width:82px;height:82px;border-radius:24px;background:${INK};color:${YELLOW};
              display:grid;place-items:center;font-size:30px;font-weight:900;letter-spacing:-1px;">카톡</div>
  <div class="mark" style="color:${INK};font-size:34px;font-weight:900;letter-spacing:-1.5px;">카톡 테마 변환기</div>
</div>`);

const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 600, height: 600}, deviceScaleFactor: 1});
const tab = await ctx.newPage();
for (const [name, html] of [["logo-square-600", square], ["logo-wide-600", wide]]) {
  await tab.setContent(html);
  const buf = await tab.screenshot({omitBackground: true});
  await writeFile(new URL(`../${name}.png`, import.meta.url), buf);
  console.log(name, buf.length, "bytes");
}
await browser.close();
