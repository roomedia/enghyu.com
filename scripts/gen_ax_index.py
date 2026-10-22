#!/usr/bin/env python3
"""ax/ 하위 포스트를 스캔해 ax/index.html 글 목록 페이지를 생성한다.

각 포스트의 index.html에서 <title>과 meta description, og:image를 읽어
카드 목록으로 만든다. 새 포스트가 추가될 때마다 배포 전에 실행한다.
"""
import html
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(PROJECT_ROOT, "ax")

GA_SNIPPET = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-G5WKCES0DY"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-G5WKCES0DY');</script>
"""

LD_SNIPPET = """<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://enghyu.com/ax/#blog",
  "name": "AX 트렌드",
  "description": "AI/AX 트렌드를 개발자 관점에서 정리한 글 모음.",
  "url": "https://enghyu.com/ax/",
  "inLanguage": "ko",
  "publisher": { "@id": "https://enghyu.com/#org" }
}
</script>
"""


def parse_post(slug):
    path = os.path.join(AX_DIR, slug, "index.html")
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    title = re.search(r"<title>(.*?)</title>", src, re.S)
    desc = re.search(r'<meta name="description" content="(.*?)"', src, re.S)
    img = re.search(r'<meta property="og:image" content="(.*?)"', src, re.S)
    # 이슈 번호는 슬러그 앞부분
    num = slug.split("-")[0]
    return {
        "slug": slug,
        "num": num,
        "title": html.unescape(title.group(1)) if title else slug,
        "desc": html.unescape(desc.group(1)) if desc else "",
        "img": img.group(1) if img else "",
    }


def main():
    slugs = sorted(
        (d for d in os.listdir(AX_DIR)
         if os.path.isdir(os.path.join(AX_DIR, d)) and d != "__pycache__"
         and d not in ("tag", "tags", "stats")),
        key=lambda s: int(s.split("-")[0]) if s.split("-")[0].isdigit() else 0,
        reverse=True,
    )
    posts = [parse_post(s) for s in slugs]

    cards = []
    for p in posts:
        img_tag = (
            f'<img src="{html.escape(p["img"])}" alt="" loading="lazy">'
            if p["img"] else ""
        )
        cards.append(f"""      <a class="card" href="/ax/{p['slug']}/">
        {img_tag}
        <div class="card-body">
          <span class="num">#{p['num']}</span>
          <strong>{html.escape(p['title'])}</strong>
          <span class="desc">{html.escape(p['desc'])}</span>
        </div>
      </a>""")

    page = f"""<!DOCTYPE html>
<html lang="ko">
<head>
{GA_SNIPPET}<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AX 트렌드 — enghyu</title>
<meta name="description" content="AI/AX 트렌드를 개발자 관점에서 정리한 글 모음.">
<meta property="og:title" content="AX 트렌드 — enghyu">
<meta property="og:description" content="AI/AX 트렌드를 개발자 관점에서 정리한 글 모음.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://enghyu.com/ax/">
<meta property="og:image" content="https://enghyu.com/site-cover.png">
<link rel="alternate" type="application/rss+xml" title="AX 트렌드 RSS" href="/ax/feed.xml">
{LD_SNIPPET}
<style>
  :root {{
    color-scheme: light dark;
    --bg: #ffffff;
    --text: #1a1a1a;
    --muted: #666;
    --border: #e5e5e5;
    --card: #fafafa;
    --accent: #0b6efd;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #101216;
      --text: #e8e8e8;
      --muted: #9a9a9a;
      --border: #2a2d33;
      --card: #17191e;
      --accent: #5b9dff;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--text);
         font: 16px/1.6 -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }}
  .wrap {{ max-width: 800px; margin: 0 auto; padding: 40px 20px 80px; }}
  header.top {{ display: flex; align-items: center; justify-content: space-between;
               margin-bottom: 8px; }}
  header.top a.home {{ color: var(--muted); text-decoration: none; font-size: 14px; }}
  h1 {{ margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }}
  p.lead {{ margin: 0 0 28px; color: var(--muted); }}
  .card {{ display: block; margin: 0 0 16px; border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden; background: var(--card);
          color: inherit; text-decoration: none; }}
  .card:hover {{ border-color: var(--accent); }}
  .card img {{ display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover;
              border-bottom: 1px solid var(--border); }}
  .card-body {{ padding: 18px 20px; }}
  .card-body .num {{ display: inline-block; margin-bottom: 6px; padding: 2px 8px;
                    border-radius: 999px; background: var(--border);
                    font-size: 12px; color: var(--muted); }}
  .card-body strong {{ display: block; margin-bottom: 6px; font-size: 17px;
                      line-height: 1.45; }}
  .card-body .desc {{ display: block; color: var(--muted); font-size: 14px;
                     line-height: 1.6; }}
</style>
</head>
<body>
  <div class="wrap">
    <header class="top"><a class="home" href="/">&larr; enghyu</a><span><a class="home" href="/ax/tags/">태그</a> · <a class="home" href="/ax/stats/">통계</a></span></header>
    <h1>AX 트렌드</h1>
    <p class="lead">AI/AX 트렌드를 개발자 관점에서 정리한 글 모음.</p>
{chr(10).join(cards)}
  </div>
<script>
(function(){{
  try {{
    var data = JSON.stringify({{p: location.pathname, r: document.referrer || ""}});
    if (navigator.sendBeacon) {{ navigator.sendBeacon("/ax/api/track", data); }}
    else {{ fetch("/ax/api/track", {{method: "POST", body: data, keepalive: true}}); }}
  }} catch (e) {{}}
}})();
</script>
</body>
</html>
"""
    out = os.path.join(AX_DIR, "index.html")
    with open(out, "w", encoding="utf-8") as fp:
        fp.write(page)
    print(f"ax/index.html 생성: {len(posts)}개 글")


if __name__ == "__main__":
    main()
