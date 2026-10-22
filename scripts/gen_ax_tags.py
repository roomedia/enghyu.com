#!/usr/bin/env python3
"""ax 포스트의 태그를 모아 태그 페이지들을 생성한다.

- ax/tags/index.html: 전체 태그 목록 (글 수와 함께)
- ax/tag/<slug>/index.html: 태그별 글 목록

포스트 HTML의 <p class="tags"><a href="/ax/tag/<slug>/">태그</a>...</p>에서 읽는다.
배포 전 gen_ax_index.py와 함께 실행한다.
"""
import html
import json
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(PROJECT_ROOT, "ax")

GA_SNIPPET = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-G5WKCES0DY"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-G5WKCES0DY');</script>
"""

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

BASE_STYLE = """
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --text: #1a1a1a; --muted: #666;
    --border: #e5e5e5; --card: #fafafa; --accent: #0b6efd;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #101216; --text: #e8e8e8; --muted: #9a9a9a;
      --border: #2a2d33; --card: #17191e; --accent: #5b9dff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 16px/1.6 -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  .wrap { max-width: 800px; margin: 0 auto; padding: 40px 20px 80px; }
  .topnav { margin-bottom: 20px; }
  .topnav a { color: var(--muted); font-size: 14px; text-decoration: none; }
  .topnav a:hover { color: var(--accent); text-decoration: underline; }
  h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
  p.lead { margin: 0 0 28px; color: var(--muted); }
  .card { display: block; margin: 0 0 16px; border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden; background: var(--card);
          color: inherit; text-decoration: none; }
  .card:hover { border-color: var(--accent); }
  .card img { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover;
              border-bottom: 1px solid var(--border); }
  .card-body { padding: 18px 20px; }
  .card-body .num { display: inline-block; margin-bottom: 6px; padding: 2px 8px;
                    border-radius: 999px; background: var(--border);
                    font-size: 12px; color: var(--muted); }
  .card-body strong { display: block; margin-bottom: 6px; font-size: 17px; line-height: 1.45; }
  .card-body .desc { display: block; color: var(--muted); font-size: 14px; line-height: 1.6; }
  .tagchip { display: inline-block; margin: 0 8px 10px 0; padding: 6px 16px;
             border: 1px solid var(--border); border-radius: 999px;
             color: var(--text); text-decoration: none; font-size: 15px; }
  .tagchip:hover { border-color: var(--accent); color: var(--accent); }
  .tagchip .cnt { color: var(--muted); font-size: 13px; margin-left: 4px; }
"""


def load_pool():
    """태그 풀 로드 → {별칭: 정식명} 매핑. _ 로 시작하는 키는 메타데이터."""
    pool_path = os.path.join(PROJECT_ROOT, "scripts", "tag_pool.json")
    try:
        with open(pool_path, encoding="utf-8") as fp:
            pool = json.load(fp)
    except (OSError, ValueError):
        return {}
    mapping = {}
    for canonical, aliases in pool.items():
        if canonical.startswith("_"):
            continue
        mapping[canonical] = canonical
        for a in aliases or []:
            mapping[a] = canonical
    return mapping


TAG_POOL = load_pool()
TAG_SLUGS = {}
try:
    with open(os.path.join(PROJECT_ROOT, "scripts", "tag_pool.json"), encoding="utf-8") as fp:
        TAG_SLUGS = json.load(fp).get("_slugs", {}) or {}
except (OSError, ValueError):
    pass


def canonical_tag(tag):
    return TAG_POOL.get(tag, tag)


def tag_slug(tag):
    """정식 태그명을 URL 슬러그로. _slugs에 명시된 ASCII 슬러그 우선,
    없으면 소문자·공백→하이픈·특수문자 제거 (한글은 ASCII 슬러그 필수)."""
    canon = canonical_tag(tag)
    explicit = TAG_SLUGS.get(canon)
    if explicit:
        return explicit
    return re.sub(r"[^a-z0-9]+", "-", canon.strip().lower()).strip("-")


def parse_post(slug):
    path = os.path.join(AX_DIR, slug, "index.html")
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    title = re.search(r"<title>(.*?)</title>", src, re.S)
    desc = re.search(r'<meta name="description" content="(.*?)"', src, re.S)
    img = re.search(r'<meta property="og:image" content="(.*?)"', src, re.S)
    tags = []
    m = re.search(r'<p class="tags">(.*?)</p>', src, re.S)
    if m:
        tags = re.findall(r'<a href="/ax/tag/[^"]+/">(.*?)</a>', m.group(1))
        # 구형 <span> 태그도 호환
        if not tags:
            tags = re.findall(r"<span>(.*?)</span>", m.group(1))
    return {
        "slug": slug,
        "num": slug.split("-")[0],
        "title": html.unescape(title.group(1)) if title else slug,
        "desc": html.unescape(desc.group(1)) if desc else "",
        "img": img.group(1) if img else "",
        "tags": tags,
    }


def card(p):
    img_tag = (
        f'<img src="{html.escape(p["img"])}" '
        f'alt="{html.escape(p["title"], quote=True)}" loading="lazy">'
        if p["img"] else ""
    )
    return f"""      <a class="card" href="/ax/{p['slug']}/">
        {img_tag}
        <div class="card-body">
          <span class="num">#{p['num']}</span>
          <strong>{html.escape(p['title'])}</strong>
          <span class="desc">{html.escape(p['desc'])}</span>
        </div>
      </a>"""


def page(title, desc, body_html, path="", noindex=False):
    og = ""
    if path:
        og = f"""
<meta property="og:title" content="{html.escape(title, quote=True)}">
<meta property="og:description" content="{html.escape(desc, quote=True)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://enghyu.com{path}">
<meta property="og:image" content="https://enghyu.com/site-cover.png">
<link rel="canonical" href="https://enghyu.com{path}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title, quote=True)}">
<meta name="twitter:description" content="{html.escape(desc, quote=True)}">
<meta name="twitter:image" content="https://enghyu.com/site-cover.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/site-logo.png">
<link rel="alternate" type="application/rss+xml" title="AX 트렌드 RSS" href="/ax/feed.xml">"""
    robots = '\n<meta name="robots" content="noindex,follow">' if noindex else ""
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
{GA_SNIPPET}<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">{robots}{og}
<style>{BASE_STYLE}</style>
</head>
<body>
  <div class="wrap">
{body_html}
  </div>
{BEACON}</body>
</html>
"""


def main():
    slugs = sorted(
        (d for d in os.listdir(AX_DIR)
         if os.path.isdir(os.path.join(AX_DIR, d))
         and d not in ("tag", "tags", "stats", "__pycache__")
         and os.path.isfile(os.path.join(AX_DIR, d, "index.html"))),
        key=lambda s: int(s.split("-")[0]) if s.split("-")[0].isdigit() else 0,
        reverse=True,
    )
    posts = [parse_post(s) for s in slugs]

    # 태그 → 글 매핑 (표시명 기준, 슬러그는 정규화)
    tag_map = {}
    for p in posts:
        for t in p["tags"]:
            slug = tag_slug(t)
            if slug not in tag_map:
                tag_map[slug] = {"name": t, "posts": []}
            tag_map[slug]["posts"].append(p)

    # 1. 태그별 페이지
    tag_dir = os.path.join(AX_DIR, "tag")
    os.makedirs(tag_dir, exist_ok=True)
    for slug, info in tag_map.items():
        cards = "\n".join(card(p) for p in info["posts"])
        body = f"""    <nav class="topnav"><a href="/ax/">&larr; AX 트렌드 목록</a> · <a href="/ax/tags/">태그 전체</a></nav>
    <h1>#{html.escape(info['name'])}</h1>
    <p class="lead">{len(info['posts'])}개의 글</p>
{cards}"""
        out = os.path.join(tag_dir, slug)
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as fp:
            fp.write(page(f"#{info['name']} — AX 트렌드 태그",
                          f"'{info['name']}' 태그가 붙은 AX 트렌드 글 모음.", body,
                          path=f"/ax/tag/{slug}/",
                          noindex=len(info["posts"]) < 3))
    print(f"태그별 페이지: {len(tag_map)}개")

    # 2. 태그 모아보기 페이지
    chips = "\n".join(
        f'      <a class="tagchip" href="/ax/tag/{slug}/">{html.escape(info["name"])}'
        f'<span class="cnt">{len(info["posts"])}</span></a>'
        for slug, info in sorted(tag_map.items(),
                                key=lambda kv: (-len(kv[1]["posts"]), kv[1]["name"]))
    )
    body = f"""    <nav class="topnav"><a href="/ax/">&larr; AX 트렌드 목록</a></nav>
    <h1>태그</h1>
    <p class="lead">AX 트렌드 글의 태그 모음. 눌러서 해당 태그의 글을 모아본다.</p>
    <div>
{chips}
    </div>"""
    tags_dir = os.path.join(AX_DIR, "tags")
    os.makedirs(tags_dir, exist_ok=True)
    with open(os.path.join(tags_dir, "index.html"), "w", encoding="utf-8") as fp:
        fp.write(page("태그 — AX 트렌드", "AX 트렌드 글의 태그 모음.", body,
                      path="/ax/tags/"))
    print("ax/tags/index.html 생성")


if __name__ == "__main__":
    main()
