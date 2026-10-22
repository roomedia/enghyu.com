#!/usr/bin/env python3
"""ax 포스트·통계 페이지에 SEO 요소를 전수 주입한다 (멱등, 배포 시마다 실행).

포스트별 처리:
- canonical: 자기 URL로 upsert.
- og:url upsert, og:type 없으면 article 추가.
  (구 글에는 og:type 자체가 없어 기존 replace 앵커가 빗나갔던 것이
  og:url 소급 누락의 원인 — 이제 앵커 없이 직접 upsert한다.)
- twitter:card/title/description/image를 og 값으로 수렴 (없으면 추가,
  있으면 교체).
- favicon link 없으면 추가.
- meta description이 160자를 넘으면 단어 경계에서 절단하고
  BlogPosting LD의 description도 같은 값으로 맞춘다. 50자 미만은
  건드리지 않고 개수만 센다 (보고용).
- BlogPosting JSON-LD: 없으면 생성 (제목·설명·이미지는 포스트 자체 메타,
  datePublished는 enghyu-published.json의 published_at, 없으면 본문
  .meta 날짜로 폴백). dateModified는 datePublished와 같은 값으로 채운다.
- BreadcrumbList JSON-LD (홈 > AX 트렌드 > 글)를 매번 재생성한다.
- 본문 <img>에 width/height가 없으면 실제 파일 치수를 채운다.
  치수는 scripts/image_dims.json에 캐시한다 (원격 이미지는 1회만 받는다).
- 관련 글 섹션: 태그(공통 태그 ax-trend 제외)를 공유하는 다른 글을
  공유 수 내림차순·최신순으로 최대 3개, </main> 직전에 재생성한다.

통계 페이지(ax/stats/)도 canonical·OG·twitter·favicon을 같은 규칙으로 맞춘다.
"""
import html
import io
import json
import os
import re
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(PROJECT_ROOT, "ax")
SITE = "https://enghyu.com"
ORG_ID = f"{SITE}/#org"
COVER = f"{SITE}/site-cover.png"
PUBLISHED_JSON = os.environ.get(
    "ENGHYU_PUBLISHED_JSON",
    os.path.expanduser(
        "~/workspace/goals/ax-trend-research-digests/hidden_files/enghyu-published.json"
    ),
)
DIMS_JSON = os.path.join(PROJECT_ROOT, "scripts", "image_dims.json")
DESC_LIMIT = 160
DESC_MIN = 50
GENERIC_TAG_SLUGS = {"ax-trend"}
FAVICON_TAGS = [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" href="/site-logo.png">',
]


def load_published():
    try:
        with open(PUBLISHED_JSON, encoding="utf-8") as fp:
            data = json.load(fp)["published"]
        return {r["slug"]: r for r in data}
    except (OSError, ValueError, KeyError):
        return {}


# ---- 메타 태그 upsert -------------------------------------------------------

def _meta_pat(attr, key):
    return re.compile(
        r'<meta %s="%s" content=".*?">' % (attr, re.escape(key)), re.S)


def get_meta(src, attr, key):
    m = _meta_pat(attr, key).search(src)
    if not m:
        return None
    tag = m.group(0)
    c = re.search(r'content="(.*?)"', tag, re.S)
    return html.unescape(c.group(1)) if c else None


def upsert_meta(src, queue, attr, key, content):
    """있으면 교체, 없으면 queue에 모아 </head> 직전에 한 번에 넣는다."""
    tag = '<meta %s="%s" content="%s">' % (
        attr, key, html.escape(content, quote=True))
    pat = _meta_pat(attr, key)
    if pat.search(src):
        return pat.sub(lambda _m: tag, src, count=1)
    if tag not in queue:
        queue.append(tag)
    return src


def ensure_meta(src, queue, attr, key, content):
    """없을 때만 추가하고 기존 값은 건드리지 않는다."""
    if not _meta_pat(attr, key).search(src) and \
            not any(f'{attr}="{key}"' in t for t in queue):
        queue.append('<meta %s="%s" content="%s">' % (
            attr, key, html.escape(content, quote=True)))
    return src


def upsert_canonical(src, queue, url):
    tag = f'<link rel="canonical" href="{url}">'
    pat = re.compile(r'<link rel="canonical" href=".*?">')
    if pat.search(src):
        return pat.sub(lambda _m: tag, src, count=1)
    if tag not in queue:
        queue.append(tag)
    return src


def ensure_favicon(src, queue):
    if 'rel="icon"' not in src:
        for t in FAVICON_TAGS:
            if t not in queue:
                queue.append(t)
    return src


def flush_queue(src, queue):
    if queue:
        src = src.replace("</head>", "\n".join(queue) + "\n</head>", 1)
    return src


def social_patch(src, url, og_type, title, desc, image):
    """canonical·og·twitter·favicon을 주어진 값으로 수렴시킨다."""
    queue = []
    src = upsert_canonical(src, queue, url)
    src = upsert_meta(src, queue, "property", "og:url", url)
    src = ensure_meta(src, queue, "property", "og:type", og_type)
    src = upsert_meta(src, queue, "property", "og:title", title)
    src = upsert_meta(src, queue, "property", "og:description", desc)
    src = upsert_meta(src, queue, "property", "og:image", image)
    src = upsert_meta(src, queue, "name", "twitter:card", "summary_large_image")
    src = upsert_meta(src, queue, "name", "twitter:title", title)
    src = upsert_meta(src, queue, "name", "twitter:description", desc)
    src = upsert_meta(src, queue, "name", "twitter:image", image)
    src = ensure_favicon(src, queue)
    return flush_queue(src, queue)


# ---- 설명 규격화 ------------------------------------------------------------

def normalize_desc(desc):
    """160자 초과 시 단어 경계(공백)에서 절단. 반환: (새 값, 잘렸는지)"""
    if desc is None or len(desc) <= DESC_LIMIT:
        return desc, False
    cut = desc[:DESC_LIMIT]
    idx = cut.rfind(" ")
    if idx >= DESC_LIMIT // 2:
        cut = cut[:idx]
    return cut.rstrip(" ,.·—-"), True


# ---- JSON-LD ----------------------------------------------------------------

LD_PAT = re.compile(
    r'<script type="application/ld\+json">(.*?)</script>', re.S)


def _ld_blocks(src):
    """(match, parsed dict or None) 목록."""
    out = []
    for m in LD_PAT.finditer(src):
        try:
            data = json.loads(m.group(1))
        except ValueError:
            data = None
        out.append((m, data))
    return out


def _ld_script(data):
    return ('<script type="application/ld+json">\n'
            + json.dumps(data, ensure_ascii=False, indent=2)
            + "\n</script>\n")


def patch_blogposting_ld(src, slug, url, published, desc):
    """BlogPosting LD를 갱신(없으면 생성)하고 dateModified를 채운다."""
    for m, data in _ld_blocks(src):
        if isinstance(data, dict) and data.get("@type") == "BlogPosting":
            if desc:
                data["description"] = desc
            if data.get("datePublished"):
                data["dateModified"] = data["datePublished"]
            new = ('<script type="application/ld+json">\n'
                   + json.dumps(data, ensure_ascii=False, indent=2)
                   + "\n</script>")
            return src[:m.start()] + new + src[m.end():]

    title_m = re.search(r"<title>(.*?)</title>", src, re.S)
    if not title_m:
        return src
    ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": html.unescape(title_m.group(1)),
        "mainEntityOfPage": url,
        "url": url,
        "author": {"@id": ORG_ID},
        "publisher": {"@id": ORG_ID},
    }
    if desc:
        ld["description"] = desc
    img = get_meta(src, "property", "og:image")
    if img:
        ld["image"] = img
    rec = published.get(slug)
    if rec and rec.get("published_at"):
        ld["datePublished"] = rec["published_at"]
    else:
        meta_m = re.search(r'<div class="meta">(\d{4}-\d{2}-\d{2})', src)
        if meta_m:
            ld["datePublished"] = meta_m.group(1)
    if ld.get("datePublished"):
        ld["dateModified"] = ld["datePublished"]
    return src.replace("</head>", _ld_script(ld) + "</head>", 1)


def patch_breadcrumb_ld(src, url, title):
    """BreadcrumbList LD를 지우고 새로 넣는다 (값이 같으면 바이트도 같다)."""
    for m, data in _ld_blocks(src):
        if isinstance(data, dict) and data.get("@type") == "BreadcrumbList":
            src = src[:m.start()] + src[m.end():]
            # 생성 시 붙인 후행 개행이 남으면 함께 정리
            src = src.replace("\n\n</head>", "\n</head>", 1)
            break
    ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈",
             "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "AX 트렌드",
             "item": f"{SITE}/ax/"},
            {"@type": "ListItem", "position": 3, "name": title,
             "item": url},
        ],
    }
    return src.replace("</head>", _ld_script(ld) + "</head>", 1)


# ---- 이미지 치수 --------------------------------------------------------------

class DimsCache:
    def __init__(self):
        self.cache = {}
        self.dirty = False
        self.added = 0
        self.failed = []
        try:
            with open(DIMS_JSON, encoding="utf-8") as fp:
                self.cache = json.load(fp)
        except (OSError, ValueError):
            pass

    def _pil_size(self, blob):
        from PIL import Image
        with Image.open(io.BytesIO(blob)) as im:
            return list(im.size)

    def get(self, src_attr):
        if src_attr in self.cache:
            return self.cache[src_attr]
        size = None
        try:
            if src_attr.startswith(("http://", "https://")):
                req = urllib.request.Request(
                    src_attr, headers={"User-Agent": "enghyu-seo-patch/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    size = self._pil_size(resp.read())
            elif src_attr.startswith("/"):
                path = os.path.join(PROJECT_ROOT, src_attr.lstrip("/"))
                with open(path, "rb") as fp:
                    size = self._pil_size(fp.read())
        except Exception:
            size = None
        if size:
            self.cache[src_attr] = size
            self.dirty = True
        else:
            self.failed.append(src_attr)
        return size

    def save(self):
        if self.dirty:
            with open(DIMS_JSON, "w", encoding="utf-8") as fp:
                json.dump(self.cache, fp, ensure_ascii=False, indent=1,
                          sort_keys=True)


IMG_PAT = re.compile(r"<img\b[^>]*>", re.S)


def patch_images(src, dims):
    def repl(m):
        tag = m.group(0)
        if " width=" in tag:
            return tag
        sm = re.search(r'src="(.*?)"', tag, re.S)
        if not sm:
            return tag
        src_attr = html.unescape(sm.group(1))
        if not src_attr.startswith(("http://", "https://", "/")):
            return tag
        size = dims.get(src_attr)
        if not size:
            return tag
        dims.added += 1
        return tag.replace(
            "<img", f'<img width="{size[0]}" height="{size[1]}"', 1)
    return IMG_PAT.sub(repl, src)


# ---- 관련 글 ------------------------------------------------------------------

def parse_post_meta(path):
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    title_m = re.search(r"<title>(.*?)</title>", src, re.S)
    tags = []
    tm = re.search(r'<p class="tags">(.*?)</p>', src, re.S)
    if tm:
        tags = re.findall(r'href="/ax/tag/([^"]+)/"', tm.group(1))
    return {
        "title": html.unescape(title_m.group(1)) if title_m else "",
        "tags": [t for t in tags if t not in GENERIC_TAG_SLUGS],
    }


def related_for(slug, metas):
    mine = set(metas[slug]["tags"])
    scored = []
    for other, meta in metas.items():
        if other == slug:
            continue
        shared = len(mine & set(meta["tags"]))
        if shared:
            num = int(other.split("-")[0]) if other.split("-")[0].isdigit() else 0
            scored.append((shared, num, other))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    return [s for _c, _n, s in scored[:3]]


RELATED_PAT = re.compile(r'\n?<section class="related">.*?</section>\n?', re.S)


def patch_related(src, slug, metas):
    rel = related_for(slug, metas)
    src = RELATED_PAT.sub("", src, count=1)
    if not rel:
        return src
    items = "\n".join(
        f'    <li><a href="/ax/{s}/">{html.escape(metas[s]["title"])}</a></li>'
        for s in rel)
    section = (f'\n<section class="related">\n  <h2>관련 글</h2>\n  <ul>\n'
               f"{items}\n  </ul>\n</section>\n")
    if "</main>" in src:
        return src.replace("</main>", section + "</main>", 1)
    return src.replace("</body>", section + "</body>", 1)


# ---- 포스트 패치 ---------------------------------------------------------------

def patch_post(path, slug, published, metas, dims, stats):
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    orig = src
    url = f"{SITE}/ax/{slug}/"

    title_m = re.search(r"<title>(.*?)</title>", src, re.S)
    title = html.unescape(title_m.group(1)) if title_m else slug

    # 설명 규격화 (meta description 기준, og/LD는 이를 따라간다)
    desc = get_meta(src, "name", "description")
    if desc is not None:
        new_desc, cut = normalize_desc(desc)
        if cut:
            stats["desc_cut"] += 1
            queue = []
            src = upsert_meta(src, queue, "name", "description", new_desc)
            desc = new_desc
        if len(desc) < DESC_MIN:
            stats["desc_short"].append(slug)
    og_desc = get_meta(src, "property", "og:description") or desc or ""
    og_title = get_meta(src, "property", "og:title") or title
    og_image = get_meta(src, "property", "og:image") or COVER

    src = social_patch(src, url, "article", og_title, og_desc, og_image)
    src = patch_blogposting_ld(src, slug, url, published, desc)
    src = patch_breadcrumb_ld(src, url, title)
    src = patch_images(src, dims)
    src = patch_related(src, slug, metas)

    if src != orig:
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(src)
        return True
    return False


def patch_stats_page(published):
    path = os.path.join(AX_DIR, "stats", "index.html")
    if not os.path.isfile(path):
        return False
    with open(path, encoding="utf-8") as fp:
        src = fp.read()
    orig = src
    title = get_meta(src, "property", "og:title")
    if not title:
        tm = re.search(r"<title>(.*?)</title>", src, re.S)
        title = html.unescape(tm.group(1)) if tm else "통계 — AX 트렌드"
    desc = get_meta(src, "name", "description") or ""
    src = social_patch(src, f"{SITE}/ax/stats/", "website", title, desc, COVER)
    if src != orig:
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(src)
        return True
    return False


def main():
    published = load_published()
    dims = DimsCache()
    stats = {"desc_cut": 0, "desc_short": []}

    slugs = []
    metas = {}
    for d in sorted(os.listdir(AX_DIR)):
        pdir = os.path.join(AX_DIR, d)
        idx = os.path.join(pdir, "index.html")
        if os.path.isdir(pdir) and os.path.isfile(idx) \
                and d not in ("tag", "tags", "stats", "__pycache__"):
            slugs.append(d)
            metas[d] = parse_post_meta(idx)

    patched = []
    for slug in slugs:
        idx = os.path.join(AX_DIR, slug, "index.html")
        if patch_post(idx, slug, published, metas, dims, stats):
            patched.append(slug)
    if patch_stats_page(published):
        patched.append("(stats)")
    dims.save()
    print(f"SEO 패치 완료: {len(patched)}개 페이지 갱신")
    print(f"설명 절단: {stats['desc_cut']}개, "
          f"50자 미만 설명: {len(stats['desc_short'])}개 "
          f"({', '.join(stats['desc_short'])})")
    print(f"이미지 치수 추가: {dims.added}개, 실패: {len(dims.failed)}개")
    for f in dims.failed[:10]:
        print(f"  치수 실패: {f}")


if __name__ == "__main__":
    main()
