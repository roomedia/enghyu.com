#!/usr/bin/env python3
"""enghyu.com Cloudflare Worker 배포 스크립트 (API 직접 호출).

흐름:
1. assets-upload-session에 manifest 제출 → JWT + 업로드 필요 파일 목록 수신
2. 필요한 파일들을 base64로 업로드
3. worker.js와 함께 PUT으로 Worker 배포 (multipart)

인증: Secure Vault의 custom.cloudflare 커넥터 (서러게이트 방식).
"""
import base64
import hashlib
import io
import json
import os
import sys
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

ACCOUNT_ID = "80f690a6b3418501f6949dc6015ed970"
SCRIPT_NAME = "ktheme-converter"
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
WORKER_JS = os.path.join(PROJECT_ROOT, "worker.js")
API_BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def api_json(method, path, payload=None, bearer=None):
    """JSON API 호출. bearer가 None이면 서러게이트(저장된 API 토큰) 사용."""
    url = f"https://api.cloudflare.com/client/v4{path}"
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    if bearer:
        req.add_header("Authorization", f"Bearer {bearer}")
    else:
        add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=120) as resp:
        data = read_json_response(resp)
    if not data.get("success"):
        raise RuntimeError(f"API 실패 {method} {path}: {json.dumps(data)[:500]}")
    return data["result"]


def collect_assets():
    """public/ 하위 파일 수집. {url_path: (hash, size, bytes)}"""
    assets = {}
    for root, _dirs, files in os.walk(PUBLIC_DIR):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, PUBLIC_DIR).replace(os.sep, "/")
            url_path = "/" + rel
            with open(full, "rb") as fp:
                content = fp.read()
            h = hashlib.sha256(content).hexdigest()[:32]
            assets[url_path] = (h, len(content), content)
    return assets


def upload_assets(assets):
    """3단계 중 1-2: manifest 제출 → 필요 파일 업로드 → completion JWT 반환."""
    manifest = {path: {"hash": h, "size": size} for path, (h, size, _c) in assets.items()}
    print(f"manifest 제출: {len(manifest)}개 파일")
    result = api_json(
        "POST",
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/assets-upload-session",
        {"manifest": manifest},
    )
    jwt = result["jwt"]
    buckets = result.get("buckets") or []
    needed = sum(len(b) for b in buckets)
    print(f"업로드 필요: {needed}개 파일 ({len(buckets)}개 버킷)")

    hash_to_content = {}
    for _path, (h, _size, content) in assets.items():
        hash_to_content[h] = content

    for i, bucket in enumerate(buckets):
        # multipart/form-data 수동 구성
        boundary = "----cfdeploy1234567890"
        parts = []
        for h in bucket:
            content = hash_to_content[h]
            b64 = base64.b64encode(content).decode()
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{h}"\r\n\r\n'
                f"{b64}\r\n"
            )
        parts.append(f"--{boundary}--\r\n")
        body = "".join(parts).encode()

        url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/assets/upload?base64=true"
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        req.add_header("Authorization", f"Bearer {jwt}")
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=300) as resp:
            data = read_json_response(resp)
        if not data.get("success"):
            raise RuntimeError(f"에셋 업로드 실패 (버킷 {i}): {json.dumps(data)[:500]}")
        # completion token 갱신 (응답에 jwt가 있으면)
        if data.get("result", {}).get("jwt"):
            jwt = data["result"]["jwt"]
        print(f"  버킷 {i+1}/{len(buckets)} 업로드 완료")
    return jwt


def deploy_worker(completion_jwt):
    """3단계: worker.js(번들) + 에셋 JWT로 Worker 배포."""
    import subprocess
    # worker.js 번들링 (ES 모듈 import 해결)
    bundled = "/tmp/worker-bundled.mjs"
    rc = subprocess.run(
        ["npx", "--yes", "esbuild", WORKER_JS, "--bundle", "--format=esm",
         f"--outfile={bundled}", "--log-level=warning"],
        cwd=PROJECT_ROOT, capture_output=True,
    ).returncode
    if rc != 0:
        raise RuntimeError("worker.js 번들링 실패")
    with open(bundled, "rb") as fp:
        worker_code = fp.read()
    print(f"번들 크기: {len(worker_code)} bytes")

    metadata = {
        "main_module": "worker.js",
        "compatibility_date": "2026-08-16",
        "assets": {
            "jwt": completion_jwt,
            "config": {"html_handling": "auto-trailing-slash"},
        },
        "bindings": [
            {"type": "assets", "name": "ASSETS"},
            {"type": "r2_bucket", "name": "KTHEME_CACHE", "bucket_name": "ktheme-cache"},
        ],
    }

    boundary = "----cfworker1234567890"
    parts = []
    parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="metadata"\r\n'
        f"Content-Type: application/json\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
    )
    # worker.js는 텍스트 파트로 추가 (바운더리 충돌 방지를 위해 바이트 직접 조합)
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n'
        f"Content-Type: application/javascript+module\r\n\r\n"
    ).encode()
    footer = f"\r\n--{boundary}--\r\n".encode()
    body = b"".join([p.encode() for p in parts] + [header, worker_code, footer])

    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}"
    req = urllib.request.Request(url, data=body, method="PUT")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=300) as resp:
        data = read_json_response(resp)
    if not data.get("success"):
        raise RuntimeError(f"Worker 배포 실패: {json.dumps(data)[:800]}")
    print("Worker 배포 성공")
    return data["result"]


def main():
    # 0a. ax 글 목록 페이지 갱신
    print("== ax 목록 갱신 ==")
    rc = os.system(f"cd {PROJECT_ROOT} && python3 scripts/gen_ax_index.py")
    if rc != 0:
        raise RuntimeError("ax 목록 생성 실패")

    # 0a-2. ax 태그 페이지 갱신
    print("== ax 태그 갱신 ==")
    rc = os.system(f"cd {PROJECT_ROOT} && python3 scripts/gen_ax_tags.py")
    if rc != 0:
        raise RuntimeError("ax 태그 생성 실패")

    # 0b. 빌드
    print("== 빌드 ==")
    rc = os.system(f"cd {PROJECT_ROOT} && node scripts/build-assets.mjs")
    if rc != 0:
        raise RuntimeError("빌드 실패")

    # 1-2. 에셋 업로드
    print("== 에셋 업로드 ==")
    assets = collect_assets()
    completion_jwt = upload_assets(assets)

    # 3. Worker 배포
    print("== Worker 배포 ==")
    deploy_worker(completion_jwt)
    print("완료")


if __name__ == "__main__":
    main()
