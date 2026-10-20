#!/usr/bin/env python3
"""기존 ax 포스트 패치:
1. 글 상단에 '← AX 트렌드 목록' nav 추가
2. 푸터 태그 <span> → 태그 페이지 링크 <a>로 변경
3. 통계 비콘 스크립트 삽입 (POST /ax/api/track)
4. ax/index.html 목록 페이지에도 비콘 삽입
"""
import os
import re
import urllib.parse

AX_DIR = os.path.dirname(os.path.abspath(__file__)) + "/../ax"
AX_DIR = os.path.normpath(AX_DIR)


def tag_slug(tag):
    s = tag.strip().lower()
    s = re.sub(r"[^a-z0-9가-힣]+", "-", s).strip("-")
    return urllib.parse.quote(s, safe="-")


NAV_CSS = """
  .topnav { margin-bottom: 20px; }
  .topnav a { color: var(--muted); font-size: 14px; text-decoration: none; }
  .topnav a:hover { color: var(--accent); text-decoration: underline; }
  .tags a {
    display: inline-block; border: 1px solid var(--border); border-radius: 999px;
    padding: 3px 12px; font-size: 13px; margin: 0 6px 6px 0;
    color: var(--text); text-decoration: none;
  }
  .tags a:hover { border-color: var(--accent); color: var(--accent); }
"""

NAV_HTML = '<nav class="topnav"><a href="/ax/">&larr; AX 트렌드 목록</a></nav>'

BEACON = """<script>
(function(){
  try {
    var data = JSON.stringify({p: location.pathname, r: document.referrer || ""});
    if (navigator.sendBeacon) { navigator.sendBeacon("/ax/api/track", data); }
    else { fetch("/ax/api/track", {method: "POST", body: data, keepalive: true}); }
  } catch (e) {}
})();
</script>
"""


def patch_post(path):
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    orig = src

    # 1. CSS 추가 (</style> 직전)
    if ".topnav" not in src:
        src = src.replace("</style>", NAV_CSS + "</style>", 1)

    # 2. nav 삽입 (<main> 바로 뒤)
    if 'class="topnav"' not in src:
        src = src.replace("<main>", "<main>\n  " + NAV_HTML, 1)

    # 3. 태그 링크화: <p class="tags"> 안의 <span>태그</span> → <a href>
    def tag_repl(m):
        inner = m.group(1)

        def span_repl(sm):
            tag = sm.group(1)
            return f'<a href="/ax/tag/{tag_slug(tag)}/">{tag}</a>'

        inner = re.sub(r"<span>(.*?)</span>", span_repl, inner)
        return f'<p class="tags">{inner}</p>'

    src = re.sub(r'<p class="tags">(.*?)</p>', tag_repl, src, flags=re.S)

    # 4. 비콘 삽입 (</body> 직전)
    if "/ax/api/track" not in src:
        src = src.replace("</body>", BEACON + "</body>", 1)

    if src != orig:
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(src)
        return True
    return False


def main():
    patched = []
    for d in sorted(os.listdir(AX_DIR)):
        pdir = os.path.join(AX_DIR, d)
        idx = os.path.join(pdir, "index.html")
        if os.path.isdir(pdir) and os.path.isfile(idx):
            if patch_post(idx):
                patched.append(d)
    # 목록 페이지에도 비콘
    list_path = os.path.join(AX_DIR, "index.html")
    if patch_post(list_path):
        patched.append("(ax/index.html 목록)")
    print(f"패치 완료: {len(patched)}개")
    for p in patched:
        print(f"  - {p}")


if __name__ == "__main__":
    main()
