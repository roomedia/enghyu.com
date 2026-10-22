// 배포할 정적 자산만 public/ 으로 모은다.
// 레포 루트를 그대로 올리면 node_modules·tests·docs까지 자산이 되므로 목록을 명시한다.
//
// 배치가 두 층이다. 루트에는 허브 페이지 하나만 두고 변환기는 `/ktheme/` 아래로 넣는다.
// 자산 매니페스트 경로가 곧 URL 이라서, 이렇게 두면 Worker 가 경로를 다시 쓰지 않아도
// `enghyu.com/ktheme/` 가 그대로 열린다. 애드센스가 크롤하는 사이트 루트는 허브 쪽이다.
import {cp, mkdir, readdir, rm} from "node:fs/promises";
import {join} from "node:path";

const projectRoot = new URL("..", import.meta.url).pathname;
const outDir = join(projectRoot, "public");
const mountDir = "ktheme";
// [원본, public/ 안의 목적지]
const entries = [
  ["hub.html", "index.html"],
  ["about.html", "about/index.html"],
  ["404.html", "404.html"],
  ["favicon.ico", "favicon.ico"],
  ["index.html", `${mountDir}/index.html`],
  ["privacy.html", `${mountDir}/privacy.html`],
  ["base.apk", `${mountDir}/base.apk`],
  ["static", `${mountDir}/static`],
  ["ax", "ax"],
  // 사이트 레벨 SEO 파일 (루트에서 서빙)
  ["robots.txt", "robots.txt"],
  ["llms.txt", "llms.txt"],
  ["sitemap.xml", "sitemap.xml"],
  ["site-cover.png", "site-cover.png"],
  ["site-logo.png", "site-logo.png"],
  ["9ca9258f5d624b6ca7f3fb6697862437.txt", "9ca9258f5d624b6ca7f3fb6697862437.txt"],
];

await rm(outDir, {recursive: true, force: true});
await mkdir(join(outDir, mountDir), {recursive: true});
for (const [source, target] of entries) {
  await cp(join(projectRoot, source), join(outDir, target), {recursive: true});
}

const listed = [];
for (const [, target] of entries) {
  const children = await readdir(join(outDir, target)).catch(() => null);
  listed.push(children ? `${target}/ (${children.length}개)` : target);
}
console.log(`public/ 준비: ${listed.join(", ")}`);
