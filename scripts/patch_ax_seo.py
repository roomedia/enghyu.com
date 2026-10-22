#!/usr/bin/env python3
"""기존·신규 ax 포스트에 SEO 요소를 주입한다 (멱등, 배포 시마다 실행).

- <script type="application/ld+json"> BlogPosting — 제목·설명·이미지는 포스트
  자체 메타에서, datePublished는 enghyu-published.json의 published_at에서 읽는다
  (없으면 본문에 보이는 .meta 날짜로 폴백, 그것도 없으면 생략).
  가시 텍스트와 다른 값은 넣지 않는다.
- og:url이 없으면 추가한다.

이미 BlogPosting JSON-LD가 있는 글은 건드리지 않는다.
"""
import html
import json
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(PROJECT_ROOT, "ax")
SITE = "https://enghyu.com"
ORG_ID = f"{SITE}/#org"
PUBLISHED_JSON = os.environ.get(
    "ENGHYU_PUBLISHED_JSON",
    os.path.expanduser(
        "~/workspace/goals/ax-trend-research-digests/hidden_files/enghyu-published.json"
    ),
)


def load_published():
    try:
        with open(PUBLISHED_JSON, encoding="utf-8") as fp:
            data = json.load(fp)["published"]
        return {r["slug"]: r for r in data}
    except (OSError, ValueError, KeyError):
        return {}


def patch_post(path, slug, published):
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    orig = src
    url = f"{SITE}/ax/{slug}/"

    # 1. og:url 보강
    if 'property="og:url"' not in src:
        src = src.replace(
            '<meta property="og:type"',
            f'<meta property="og:url" content="{url}">\n<meta property="og:type"',
            1,
        )

    # 2. BlogPosting JSON-LD
    if "BlogPosting" not in src:
        title_m = re.search(r"<title>(.*?)</title>", src, re.S)
        desc_m = re.search(r'<meta name="description" content="(.*?)"', src, re.S)
        img_m = re.search(r'<meta property="og:image" content="(.*?)"', src, re.S)
        if title_m:
            ld = {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": html.unescape(title_m.group(1)),
                "mainEntityOfPage": url,
                "url": url,
                "author": {"@id": ORG_ID},
                "publisher": {"@id": ORG_ID},
            }
            if desc_m:
                ld["description"] = html.unescape(desc_m.group(1))
            if img_m:
                ld["image"] = img_m.group(1)
            rec = published.get(slug)
            if rec and rec.get("published_at"):
                ld["datePublished"] = rec["published_at"]
            else:
                meta_m = re.search(
                    r'<div class="meta">(\d{4}-\d{2}-\d{2})', src)
                if meta_m:
                    ld["datePublished"] = meta_m.group(1)
            script = ('<script type="application/ld+json">\n'
                      + json.dumps(ld, ensure_ascii=False, indent=2)
                      + "\n</script>\n")
            src = src.replace("</head>", script + "</head>", 1)

    if src != orig:
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(src)
        return True
    return False


def main():
    published = load_published()
    patched = []
    for d in sorted(os.listdir(AX_DIR)):
        pdir = os.path.join(AX_DIR, d)
        idx = os.path.join(pdir, "index.html")
        if os.path.isdir(pdir) and os.path.isfile(idx) \
                and d not in ("tag", "tags", "stats", "__pycache__"):
            if patch_post(idx, d, published):
                patched.append(d)
    print(f"SEO 패치 완료: {len(patched)}개 글 갱신")


if __name__ == "__main__":
    main()
