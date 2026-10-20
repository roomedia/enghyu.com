#!/usr/bin/env python3
"""기존 포스트의 태그를 tag_pool.json 기준으로 정규화한다.
별칭 → 정식 태그명으로 교체하고, _dropped 태그는 제거한다.
"""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AX_DIR = os.path.join(BASE, "ax")


def load_pool():
    with open(os.path.join(BASE, "scripts", "tag_pool.json"), encoding="utf-8") as fp:
        pool = json.load(fp)
    mapping = {}
    dropped = set(pool.get("_dropped", []))
    for canonical, aliases in pool.items():
        if canonical.startswith("_"):
            continue
        mapping[canonical] = canonical
        for a in aliases or []:
            mapping[a] = canonical
    return mapping, dropped


POOL_SLUGS = {}
try:
    with open(os.path.join(BASE, "scripts", "tag_pool.json"), encoding="utf-8") as fp:
        POOL_SLUGS = json.load(fp).get("_slugs", {}) or {}
except (OSError, ValueError):
    pass


def tag_slug(tag):
    slugs = POOL_SLUGS.get(tag)
    if slugs:
        return slugs
    return re.sub(r"[^a-z0-9]+", "-", tag.strip().lower()).strip("-")


def main():
    mapping, dropped = load_pool()
    changed = []
    for d in sorted(os.listdir(AX_DIR)):
        p = os.path.join(AX_DIR, d, "index.html")
        if not os.path.isfile(p):
            continue
        with open(p, encoding="utf-8") as fp:
            src = fp.read()

        def repl(m):
            name = m.group(1)
            if name in dropped:
                return ""  # 태그 제거
            canon = mapping.get(name, name)
            return f'<a href="/ax/tag/{tag_slug(canon)}/">{canon}</a>'

        new = re.sub(r'<a href="/ax/tag/[^"]+/">(.*?)</a>', repl, src)
        # 구형 span 태그도 처리
        def span_repl(m):
            name = m.group(1)
            if name in dropped:
                return ""
            canon = mapping.get(name, name)
            return f'<a href="/ax/tag/{tag_slug(canon)}/">{canon}</a>'
        new = re.sub(r"<span>(.*?)</span>", span_repl, new)

        if new != src:
            with open(p, "w", encoding="utf-8") as fp:
                fp.write(new)
            changed.append(d)
    print(f"태그 정규화: {len(changed)}개 글")
    for c in changed:
        print(f"  - {c}")


if __name__ == "__main__":
    main()
