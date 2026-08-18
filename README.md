# iOS ktheme ↔ Android APK

정적 웹과 브라우저 처리만으로 iOS KakaoTalk `.ktheme`를 Android APK로 변환합니다. 만들어진 APK를 다시 `.ktheme`로 되돌리는 역변환도 같은 화면에서 처리합니다.

## 구성

```text
사용자 브라우저 ── GET ──> Static Hosting/CDN: index.html, static/, base.apk
       │
       ├─ 변환·RSA 키 생성·APK v2 서명
       │
       └─ GET/PUT hash ──> Edge Function ──> Object Storage: signed APK
```

- Static Hosting/CDN: 정적 파일과 `base.apk` 배포
- Browser: CSS/이미지 매핑, ZIP 교체, APK 서명, 사용자별 Cache API
- Edge Function: hash 기반 signed APK와 원본 `.ktheme` 공용 캐시 GET/PUT만 수행
- Object Storage: `signed/{hash}.apk`, `theme/{hash}.ktheme` 영구 저장

### 브라우저 모듈

`static/app.js`가 진입점이고 나머지는 네이티브 ES 모듈로 import한다. 번들러는 쓰지 않는다.

| 모듈 | 역할 |
|---|---|
| `app.js` | 폼 배선, 캐시 조회, 다운로드와 스낵바 |
| `theme.js` | `.ktheme` CSS 파싱, Android resource 이름 매핑 |
| `preview.js` | 프리뷰 렌더링과 화면 전환. 채팅은 Canvas로 그린다 |
| `apk.js` | `base.apk` 로드, 테마 적용 APK 조립, ZIP 정렬 |
| `resources.js` | values XML·`resources.arsc` 편집, 앱 identity |
| `ninepatch.js` | iOS 말풍선 PNG → Android `npTc` 9-patch |
| `sign.js` | RSA 키·인증서, APK Signature Scheme v2 |
| `bytes.js` | 바이트 조립과 SHA-256 유틸 |
| `reverse.js` | Android 테마 APK → iOS `.ktheme` 역변환 |
| `screens.js` | 친구·더보기·잠금화면 프리뷰 마크업 |

## 배포

1. `base.apk`, `index.html`, `static/`를 Static Hosting에 배포합니다.
2. `wrangler.toml`의 R2 bucket을 만들고 `worker.js`를 배포합니다.
3. `index.html`에 `window.KTHEME_SHARED_CACHE_URL`을 Edge Function URL로 설정합니다.
4. Edge Function URL과 Static Hosting 도메인의 CORS를 확인합니다.

동일한 `base.apk + .ktheme` hash가 있으면 모든 사용자가 공용 signed APK를 즉시 다운로드합니다. 최초 사용자는 브라우저에서 변환·서명 후 Object Storage에 저장합니다.

## 역변환

파일 선택에서 `.apk`를 고르면 방향이 뒤집힙니다. 페이지가 `resources.arsc`에서 색과 테마 이름을, `res/drawable-*`에서 이미지를 읽어 `.ktheme`을 만들고 같은 프리뷰로 보여 줍니다. 9-patch는 `npTc`에서 텍스트 인셋과 stretch 기준점을 역산하고 정방향이 붙인 1px 테두리를 걷어냅니다.

역매핑은 정방향 표를 그대로 뒤집어 씁니다. 별도 표를 두지 않으므로 한쪽만 고쳐 어긋나는 일이 없습니다.

대상은 이 도구가 만든 APK입니다. `base.apk` template의 resource 이름 규약에 기대므로 시판 Android 테마 APK는 지원 범위 밖입니다. Android에 대응 resource가 없는 선언(선택 말풍선 등)은 왕복에서 사라집니다.

## 공유 링크

다운로드를 누르면 클립보드에 `뚱카츄.apk 공유 링크: <URL>` 형태로 복사됩니다. URL은 `?t=<hash>`를 붙인 이 페이지 주소이고, 원본 `.ktheme`이 같은 hash로 Object Storage에 올라가 있습니다.

링크를 연 사람은 파일 없이도 테마를 고른 것과 같은 화면을 봅니다. 페이지가 `.ktheme`을 받아 파일 입력에 넣고 프리뷰를 그린 뒤, 다운로드를 누르면 공용 캐시 APK를 받거나 없으면 브라우저에서 직접 변환합니다.

공용 캐시에 올리지 못했으면(Worker 미배포·네트워크 실패) 예전처럼 현재 탭에서만 유효한 `blob:` URL을 복사하고 스낵바가 그 사실을 알립니다.

원본 `.ktheme`이 파생물이 아니라 원본 그대로 공용 저장소에 올라갑니다. 공개 배포 시 이 점을 사용자에게 알려야 합니다.

## 로컬 실행

정적 변환만 확인:

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. 이 모드는 Worker 없이 변환·서명만 확인하며, 공용 캐시 PUT은 실패해도 변환은 계속됩니다.

Worker와 로컬 R2까지 확인:

```bash
npx wrangler dev --local --port 8787
```

별도 터미널에서 정적 서버를 실행합니다.

```bash
python3 -m http.server 8000
```

`http://localhost:8000` 접속 시 브라우저가 자동으로 `http://localhost:8787`의 `/shared-cache`·`/shared-theme`를 사용합니다. `wrangler`가 없으면 `npx`가 일회성으로 실행합니다. 이 조합이면 공유 링크까지 로컬에서 확인할 수 있습니다. 다만 링크 주소가 `localhost`라 다른 기기에서는 열리지 않습니다.

개인키는 브라우저 `localStorage`에만 저장됩니다. 공용 APK는 최초 생성자의 서명 키를 사용하므로, 브라우저 저장소를 지운 뒤에는 기존 APK 업데이트가 아니라 재설치가 필요합니다.

처리 시퀀스는 `docs/browser-server-sequence.html`에서 확인할 수 있습니다.

## 로컬 E2E

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

E2E는 임시 Android base ZIP과 `.ktheme`를 만들고, 사용자 A의 최초 변환·서명·공용 캐시 저장 후 사용자 B가 동일 입력으로 즉시 다운로드하는 흐름을 headless Chromium에서 검증합니다.
