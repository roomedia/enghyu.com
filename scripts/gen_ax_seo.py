#!/usr/bin/env python3
"""사이트 레벨 SEO 파일을 생성한다 (배포 시 gen_ax_index·gen_ax_tags 다음에 실행).

- sitemap.xml (레포 루트): 홈·/ax/·태그 모아보기·태그별 페이지·전체 글.
  글 lastmod는 enghyu-published.json의 published_at 기준. published.json이
  없으면(레포 단독 실행) 글 목록은 ax/ 디렉토리에서, lastmod 없이 만든다.
- ax/feed.xml: 최신 글 20건 RSS 2.0 피드.

글 메타(제목·설명)는 포스트 HTML에서 읽는다 (gen_ax_index.parse_post와 동일 방식).
"""
import html
import json
import os
import re
from datetime import datetime
from email.utils import format_datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(PROJECT_ROOT, "ax")
SITE = "https://enghyu.com"
PUBLISHED_JSON = os.environ.get(
    "ENGHYU_PUBLISHED_JSON",
    os.path.expanduser(
        "~/workspace/goals/ax-trend-research-digests/hidden_files/enghyu-published.json"
    ),
)


def load_published():
    """{slug: {published_at, url}} — 파일이 없으면 빈 dict."""
    try:
        with open(PUBLISHED_JSON, encoding="utf-8") as fp:
            data = json.load(fp)["published"]
        return {r["slug"]: r for r in data}
    except (OSError, ValueError, KeyError):
        return {}


def list_post_slugs():
    return sorted(
        (d for d in os.listdir(AX_DIR)
         if os.path.isdir(os.path.join(AX_DIR, d))
         and d not in ("tag", "tags", "stats", "__pycache__")
         and os.path.isfile(os.path.join(AX_DIR, d, "index.html"))),
        key=lambda s: int(s.split("-")[0]) if s.split("-")[0].isdigit() else 0,
        reverse=True,
    )


def parse_post(slug):
    path = os.path.join(AX_DIR, slug, "index.html")
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    title = re.search(r"<title>(.*?)</title>", src, re.S)
    desc = re.search(r'<meta name="description" content="(.*?)"', src, re.S)
    return {
        "slug": slug,
        "title": html.unescape(title.group(1)) if title else slug,
        "desc": html.unescape(desc.group(1)) if desc else "",
    }


def iso_date(published_at):
    return published_at[:10] if published_at else None


def gen_sitemap(posts, published):
    latest = None
    for p in posts:
        rec = published.get(p["slug"])
        if rec and rec.get("published_at"):
            d = iso_date(rec["published_at"])
            if latest is None or d > latest:
                latest = d

    urls = []  # (loc, lastmod or None)

    def add(loc, lastmod=None):
        urls.append((loc, lastmod))

    add(f"{SITE}/", latest)
    add(f"{SITE}/ax/", latest)
    add(f"{SITE}/ax/tags/")
    tag_root = os.path.join(AX_DIR, "tag")
    if os.path.isdir(tag_root):
        for t in sorted(os.listdir(tag_root)):
            if os.path.isfile(os.path.join(tag_root, t, "index.html")):
                add(f"{SITE}/ax/tag/{t}/")
    for p in posts:
        rec = published.get(p["slug"])
        add(f"{SITE}/ax/{p['slug']}/",
            iso_date(rec["published_at"]) if rec else None)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(loc)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    out = os.path.join(PROJECT_ROOT, "sitemap.xml")
    with open(out, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    print(f"sitemap.xml 생성: {len(urls)}개 URL")


def gen_feed(posts, published):
    items = []
    for p in posts[:20]:
        rec = published.get(p["slug"])
        pub = ""
        if rec and rec.get("published_at"):
            dt = datetime.fromisoformat(rec["published_at"])
            pub = f"\n      <pubDate>{format_datetime(dt)}</pubDate>"
        link = f"{SITE}/ax/{p['slug']}/"
        items.append(f"""    <item>
      <title>{html.escape(p['title'])}</title>
      <link>{link}</link>
      <guid isPermaLink="true">{link}</guid>{pub}
      <description>{html.escape(p['desc'])}</description>
    </item>""")
    feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AX 트렌드 — enghyu</title>
    <link>{SITE}/ax/</link>
    <atom:link href="{SITE}/ax/feed.xml" rel="self" type="application/rss+xml"/>
    <description>AI/AX 트렌드를 개발자 관점에서 정리한 글 모음.</description>
    <language>ko</language>
{chr(10).join(items)}
  </channel>
</rss>
"""
    out = os.path.join(AX_DIR, "feed.xml")
    with open(out, "w", encoding="utf-8") as fp:
        fp.write(feed)
    print(f"ax/feed.xml 생성: {len(items)}개 글")


def main():
    published = load_published()
    posts = [parse_post(s) for s in list_post_slugs()]
    gen_sitemap(posts, published)
    gen_feed(posts, published)


if __name__ == "__main__":
    main()
