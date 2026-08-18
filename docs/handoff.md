# ktheme2apk Handoff

## 목표

- iOS `.ktheme`를 Android 카카오톡 테마 APK로 변환한다.
- 변환·키 생성·캐시는 사용자 브라우저에서 처리한다.
- 동일한 `base.apk + .ktheme` SHA-256 입력은 공용 캐시에서 즉시 반환한다.
- `base.apk`는 실행에 필요한 코드·manifest·resource ID만 제공하는 중립 template으로 유지한다.
- 테마가 제공하지 않은 theme resource는 변환 출력에서 제거하고 `resources.arsc` entry를 `@null`로 만든다. 실행 shell인 launcher/splash/설치 UI는 유지한다.

## 현재 구현

- `static/`: 진입점 `app.js` 하나에 ES 모듈 7개가 붙는다. `.ktheme` ZIP/CSS 파싱, 이미지명 매핑, 색상 변경, 앱 identity 변경, 브라우저 캐시, APK 생성·서명을 담당한다. 모듈별 역할은 `README.md`의 표가 정본이다.
- 공용 캐시 서버가 없거나 네트워크 요청이 실패해도 로컬 변환·다운로드를 계속한다. 다운로드 이름은 입력 basename에 `.apk`를 붙인다.
- 말풍선 `.9.png`: iOS PNG를 Canvas로 재인코딩하고 Android `npTc` 9-patch chunk를 추가한다.
- CSS block별 색상·alpha를 Android compiled `resources.arsc` resource ID에 반영한다.
- Android template에 존재하는 local/piccoma 탭 이미지도 매핑한다.
- `worker.js`: 공용 캐시의 `GET/PUT /shared-cache/{sha256}`(서명 APK)와 `GET/PUT /shared-theme/{sha256}`(원본 `.ktheme`). 파일명은 percent-encoding한 `X-Theme-Name` 헤더로 오간다.
- `base.apk`: Android Sample Theme 기반 실행 template. Apeach 앱 identity와 아이콘·스플래시는 중립화했다.
- `tests/e2e/local-flow.mjs`: 최초 변환·공용 저장·두 번째 사용자 즉시 다운로드, Worker 미실행 fallback, 입력 파일명 기반 APK 다운로드를 Playwright로 검증한다. 실제 APK 유효성은 SDK 도구와 emulator gate로 별도 확인한다.

## 중요한 동작 규칙

1. 입력 이미지가 있으면 `imageTargets` 규칙에 따라 같은 Android resource를 교체한다.
2. 입력 이미지가 없으면 해당 theme APK entry를 출력에서 제거하고 compiled resource entry도 `@null`로 만든다. 임의의 빈 리소스를 추가하지 않는다.
3. 색상도 입력 CSS에서 발견된 값만 반영한다. 정의되지 않은 `theme_*` 색상과 selector는 출력에서 제거한다.
4. 앱 package는 입력 테마명·입력 hash에서 생성하고, 앱 label은 입력 `.ktheme` 이름 원문을 사용한다. 고정 package를 사용하지 않는다.
5. 아이콘과 splash는 입력 `.ktheme`에 별도 매핑이 없으므로 base의 중립 리소스를 유지한다.

iOS CSS와 Android `npTc`의 좌표계·endian 규칙은 `docs/kakaotalk-theme-guide-26.7.0.md`가 정본이다.

## 로컬 검증

```sh
npm install
npx playwright install chromium
npm run test:e2e
for f in static/*.js; do node --check "$f"; done
node --check worker.js
git diff --check
```

실제 입력으로 브라우저 변환을 확인하려면:

```sh
BASE_PATH="$PWD/base.apk" \
THEME_PATH="$HOME/Downloads/뚱카츄.ktheme" \
E2E_OUTPUT=/tmp/뚱카츄-browser.apk \
npm run test:e2e
```

## 검증 상태

- 실제 `뚱카츄.ktheme` 출력은 `aapt2 dump badging`·`aapt2 dump resources`·SDK `36.0.0` `apksigner verify --verbose`를 통과했다.
- 실기기 `SM-S931N`(Android 16)과 API 34 emulator 모두 설치·launch 성공. 채팅방에서 말풍선 렌더링과 텍스트 표시를 확인했다.
- preview 논리 크기 `340×310px(@3x)`와 기기 parent `392×336px` 사이에는 수치 차이가 있다. Android 실제 폰트 측정과 KakaoTalk 내부 layout 여백 때문이며, font/layout까지 동일한지는 확인하지 않았다.

## 남은 리스크

- v1/v3 서명은 생성하지 않는다. v2만 만든다.
- 지원 범위는 `imageTargets`와 `colorTargets`에 정의된 KakaoTalk asset/property 명명 규칙이다. 임의 이름·새 CSS property는 변환에 성공해도 base fallback으로 남을 수 있다.
- Chat bubble image가 입력됐는데 대응 edge inset property가 없으면 변환에 실패한다. 잘못된 stretch를 조용히 생성하지 않기 위한 보호 동작이다.
- 실제 다른 제작자 `.ktheme` 파일이 workspace에 없어 제작자 간 호환성은 확인하지 못했다.
- `base.apk`는 공식 Kakao 기본 테마 APK가 아니라 제공된 Android Sample Theme에서 만든 template이다. 정확한 Kakao 기본 fallback이 필요하면 같은 버전의 공식 template으로 교체해야 한다.
- resource가 `@null`인 상태를 KakaoTalk 26.7.0의 각 화면이 안전하게 처리하는지 실기기·host 앱에서 확인하지 않았다.
- 공용 캐시 PUT은 서버에서 `key`와 본문 APK의 관계를 검증해야 한다. 현재 공개 정적 데모에서는 첫 저장 승리 방식이다.
- APK v2 chunked digest, v1 signature, ZIP alignment 보존은 브라우저 signer 개선 범위다.

## 다음 작업 우선순위

1. `drawResizable()`의 `stretchSourceWidth/Height` 최소값을 bitmap 1px에 해당하는 `1 / scale`로 교정하고, 늘어난 말풍선 seam 회귀 검증을 추가한다.
2. 실제 KakaoTalk 설치 환경에서 채팅·탭·passcode·notification 화면을 순회해 `@null` resource crash와 의도하지 않은 host fallback을 확인한다.
3. 실제 `base.apk`와 대표 `.ktheme`를 사용하는 `aapt2`·`apksigner`·emulator 설치 gate를 CI/로컬 검증 명령으로 자동화한다.
4. 공용 캐시 PUT을 hash·서명·APK 구조 검증 뒤에만 저장하도록 잠근다.
5. 공식 기본 template 확보 후 `base.apk`를 교체하고 base cache version을 올린다.
6. 실제 다른 제작자 `.ktheme` fixture를 추가해 이미지 누락·새 PNG 크기·base 값 유지까지 E2E로 고정한다.

## 2026-08-18 스낵바 알림 전환

- 현재 구현 상태: `#download-result` 결과 영역과 `#status` 텍스트를 제거했다. 진행 상태와 완료 알림은 화면 하단 고정 `#snackbar` 하나로 표시한다. `다운로드` 버튼을 누르면 파일 저장과 `blob:` 링크 복사를 함께 실행하고 `<파일명> 다운로드를 시작하고 링크를 복사했습니다.`를 5초간 띄운다. 복사가 거부되면 `... 다운로드를 시작했습니다. 링크 복사는 실패했습니다.`로 바꿔 표시한다.
- 변경한 파일과 동작: `index.html`에서 결과 shelf·copy 버튼 마크업과 CSS를 지우고 `role="status" aria-live="polite"` 스낵바를 추가했다. `static/app.js`는 `showSnackbar()`/`hideSnackbar()`로 상태를 표시하고, 진행 메시지는 지속 표시, 완료·실패 메시지는 각각 5초·6초 뒤 자동으로 감춘다. 세 경로(브라우저 캐시·공용 캐시·신규 변환) 모두 `download()` 한 곳에서 복사와 알림을 처리한다. 변환 경고는 스낵바 `title`로 옮겼다. `tests/e2e/local-flow.mjs`는 세 컨텍스트 모두에 clipboard 스텁을 넣어 복사한 값이 `blob:`인지와 스낵바 문구를 검증한다.
- 실행한 검증 명령과 결과: `node --check static/app.js` 통과, `npm run test:e2e` 통과, `git diff --check` 통과.
- 확인하지 못한 항목과 남은 리스크: 실제 Safari·Firefox에서 변환이 끝난 뒤 user activation이 만료돼 클립보드 쓰기가 거부될 수 있다. 그 경우 실패 문구만 뜨고 링크를 얻을 수단이 없다 — 복사 버튼을 없앴기 때문이다. 복사한 링크는 여전히 현재 탭에서만 유효한 `blob:` URL이라 다른 기기·브라우저로 공유되지 않는다. 자동으로 사라지는 스낵바에 경고를 `title`로 붙였으므로 변환 경고는 사실상 확인하기 어렵다.

## 2026-08-18 모듈 분할과 레거시 정리

- 현재 구현 상태: `static/app.js` 1096줄을 ES 모듈 8개로 나눴다. 진입점은 `static/app.js` 그대로이고 `index.html`의 `<script type="module" src="/static/app.js">`는 바꾸지 않았다. 번들러는 도입하지 않았다. Flask 시절 잔재인 `app.py`·`themed.apk`·`sample_ktheme.zip`·`base_app/`을 지웠다 — 코드·문서 어디서도 참조하지 않는다.
- 변경한 파일과 동작: 축은 `bytes.js`(바이트·SHA-256), `theme.js`(CSS 파싱·resource 이름 매핑), `resources.js`(values XML·`resources.arsc`·앱 identity), `ninepatch.js`(`npTc` 생성), `apk.js`(`base.apk` 로드·APK 조립·ZIP 정렬), `sign.js`(RSA 키·인증서·v2 서명), `preview.js`(프리뷰 렌더링·입력 이벤트), `app.js`(폼 배선·캐시 조회·다운로드·스낵바). 함수 본문은 옮기기만 하고 고치지 않았다. 순환 import는 없다 — `sign.js`가 `apk.js`의 `apkSections`를 한 방향으로 가져간다. `tests/e2e/local-flow.mjs`의 정적 서버는 `/static/app.js` 단일 경로 대신 `/static/<name>.js`를 정규식으로 받는다. `.gitignore`에 `.DS_Store`·`*.log`를 추가했다. `README.md`에 모듈 표를 넣고 배포 대상을 `static/` 전체로 고쳤다. `AGENTS.md`의 검증 규칙은 `static/*.js` 전체 `node --check`로 바꿨다.
- 실행한 검증 명령과 결과: `static/*.js` 전체 `node --check` 통과, `npm run test:e2e` 통과(실제 APK 바이트·nine-patch metadata·세 다운로드 경로 포함), `git diff --check` 통과.
- 확인하지 못한 항목과 남은 리스크: 모듈 8개를 개별 요청으로 받으므로 HTTP/1.1 정적 호스팅에서는 왕복이 늘어난다. HTTP/2 이상이면 사실상 차이가 없다. 실기기 설치·실행은 이번 변경에서 다시 하지 않았다 — 함수 본문을 고치지 않았고 e2e가 APK 바이트를 검증하므로 회귀 가능성은 낮다고 봤다. 지운 파일은 git 히스토리에 남아 있어 복구할 수 있다.

## 2026-08-18 handoff 정리

- 현재 구현 상태: handoff를 현재 상태 문서로 되돌렸다. 238줄에서 96줄로 줄었다.
- 변경한 파일과 동작: 지운 것은 `2026-08-17 UI 리디자인`, `최근 검증`, `이번 작업 검증`, `2026-08-17 HTML 키 컬러 변경`, `2026-08-18 base fallback resource 제거`, 그리고 `#download-result` UI를 단계별로 다듬던 네 항목(`다운로드 결과 UI`·`shelf`·`copyable`·`CTA 정리`)이다. 전부 현재 코드가 대체했거나 이미 해소된 실패 기록이다. 옮긴 것은 셋 — `npTc` 혼합 endian 규칙은 `docs/kakaotalk-theme-guide-26.7.0.md:29`에 이미 있어 참조만 남겼고, `@null` host 검증은 남은 리스크로, 실기기 화면 순회는 다음 작업 우선순위 2번으로 흡수했다. `themed.apk` 관련 리스크와 2026-08-16 signer 역사 기록은 대상 파일이 사라졌거나 해소돼 지웠다. `로컬 검증`의 `node --check`는 `static/*.js` 전체를 도는 형태로 고쳤다.
- 실행한 검증 명령과 결과: `git diff --check` 통과. 코드 변경이 없어 e2e는 돌리지 않았다.
- 확인하지 못한 항목과 남은 리스크: 지운 이력은 git 히스토리에 남아 있다.

## 2026-08-18 공유 링크

- 현재 구현 상태: 다운로드를 누르면 클립보드에 `<파일명>.apk 공유 링크: <URL>`이 들어간다. URL은 `?t=<sha256>`을 붙인 이 페이지 주소다. 링크를 연 사람은 파일을 고른 것과 같은 화면을 본다 — 페이지가 `.ktheme`을 받아 `DataTransfer`로 파일 입력에 넣고 `change`를 쏘면 기존 리스너가 프리뷰까지 그린다. 공용 캐시에 올리지 못했으면 예전처럼 `blob:` URL을 복사하고 스낵바가 탭 전용임을 알린다.
- 변경한 파일과 동작: `worker.js`에 `/shared-theme/{key}` GET/PUT을 추가하고 두 bucket을 한 라우트 표로 합쳤다. 파일명은 `X-Theme-Name`에 percent-encoding해 R2 `customMetadata`로 보관하며 `Access-Control-Expose-Headers`로 노출한다. `static/app.js`는 `publishTheme()`으로 변환과 겹쳐 원본을 올리고, 세 경로 모두 `finish()` 한 곳에서 공유 링크를 만든다. `hydrateFromShareLink()`가 로드 시 `?t=`를 읽는다. `tests/e2e/local-flow.mjs`는 stub 서버에 `/shared-theme` 라우트를 넣고 쿼리스트링이 붙은 `/`도 받도록 경로 매칭을 pathname 기준으로 바꿨다. 공유 링크로 연 새 컨텍스트가 프리뷰·파일명·다운로드·같은 공유 링크 재생산까지 통과하는지 검증한다.
- 실행한 검증 명령과 결과: `static/*.js` 전체와 `worker.js` `node --check` 통과, `npm run test:e2e` 통과, `git diff --check` 통과. `npx wrangler dev --port 8787`의 로컬 R2에 직접 PUT/GET해 204·200과 `X-Theme-Name` percent-encoding 왕복(`뚱카츄.ktheme`)을 확인했다.
- 확인하지 못한 항목과 남은 리스크: 원본 `.ktheme`이 파생물이 아니라 원본 그대로 공용 저장소에 올라간다. 공개 배포 시 사용자 고지가 필요하다. 공유 링크는 hash만 알면 누구나 열 수 있고 삭제 수단이 없다. 로컬 개발에서는 링크 주소가 `localhost`라 다른 기기에서 열리지 않는다. 배포 Worker에서 `Access-Control-Expose-Headers`가 빠지면 파일명만 조용히 사라지므로 배포 후 헤더를 확인해야 한다. `DataTransfer` 주입은 headless Chromium에서만 확인했다 — Safari·Firefox는 미확인이다.

## 2026-08-18 프리뷰 헤더 순서

- 현재 구현 상태: 채팅 헤더를 `테마 <이름>` 양쪽 정렬에서 `<이름> 테마` 한 줄로 바꿨다. 굵은 본문 하나만 남는다.
- 변경한 파일과 동작: `static/preview.js`의 `.chat-header`가 `span` 하나만 그린다. `index.html`에서 `justify-content: space-between`과 `.chat-header small` 규칙을 지우고, 긴 이름이 잘리도록 `span`에 `text-overflow: ellipsis`를 뒀다.
- 실행한 검증 명령과 결과: `node --check static/preview.js` 통과, `npm run test:e2e` 통과, `git diff --check` 통과.
- 확인하지 못한 항목과 남은 리스크: 아주 긴 테마 이름이 실제 모바일 폭에서 어떻게 잘리는지는 브라우저 화면으로 확인하지 않았다.

## 2026-08-18 컬러 치환 버그와 매핑 보완 (진행 중)

- 현재 구현 상태: iOS→Android 매핑 보완 1단계. 아직 커밋하지 않았다.
- 확정한 버그 둘:
  - `readStringPool()`이 UTF-16 string pool을 UTF-8 디코더로 읽어 type pool이 `'c\x00o\x00l\x00o\x00r\x00'`로 깨졌다. `pruneCompiledResources()`가 type pool 내용을 안 써서 그동안 드러나지 않았다.
  - `theme_body_cell_border_color`가 CSS에서 파싱되는데도 `resources.arsc`에 기록되지 않았다. 하드코딩 id 표에서 빠져 있었고, 값 검증이 없어 테스트가 통과했다.
- 변경한 파일과 동작: `static/resources.js`가 색상 entry id를 base.apk에서 파생한다(`compiledEntryIds`). 값 판독기 `compiledColorValues`를 추가했다 — 검증과 역방향 변환이 함께 쓴다. `static/theme.js`는 CSS 이미지 선언을 슬롯으로 읽어(`imagePropertyTargets`) Android resource를 정하고, 선언이 없으면 파일명 규약으로 물러난다. `TabBarStyle-Main`→`theme_maintab_cell_color`, `LabelStyle-PasscodeTitle`→`theme_passcode_color`, `HeaderStyle-Main` 배경→`theme_header_cell_color` 매핑을 추가했다. 친구추가 버튼 이미지는 무조건 제거하던 규칙을 풀고 입력이 있을 때만 유지한다. `static/preview.js`의 stretch source 하한을 CSS `1px`에서 bitmap 1px에 해당하는 `1 / scale`로 고쳤다.
- 실행한 검증 명령과 결과: `static/*.js`·`worker.js` `node --check` 통과, `npm run test:e2e` 통과, 실제 `뚱카츄.ktheme` E2E 통과, `git diff --check` 통과. 실제 입력 출력에서 커밋본 대비 달라진 색은 의도한 둘뿐이다 — `theme_passcode_color` `@null`→`#FF000000`, `theme_body_cell_border_color`가 처음으로 CSS 값(alpha 0.09 → `0x17000000`)으로 기록된다. 생성된 `npTc` 메타데이터는 커밋본과 완전히 동일하다.
- 회귀 가드: e2e가 실제 `base.apk`로 compiled color 치환을 직접 검증하고, 실제 base 사용 시 CSS가 정의한 모든 색이 출력 table에 있는지 대조한다.
- 실기기 재확인: `SM-S931N`(480dpi, 1080×2340, 카카오톡 26.7.1)에 이번 빌드를 설치·적용해 채팅방을 확인했다. 2글자 메시지 말풍선이 원본 크기로 온전히 그려지고 긴 말풍선도 정상이다. 직전에 보고된 "짧은 말풍선 폭 좁음"은 이 빌드에서 재현되지 않는다. 생성 `npTc`가 커밋본과 동일하므로 원인은 기기에 남아 있던 이전 빌드로 본다.
- 말풍선 텍스트 영역이 좁은 것은 테마 선언값이다. `-ios-title-edgeinsets: 61px 23.33px 20px 68px`이라 114pt 폭 중 좌 23.33 + 우 68을 여백으로 잡아 텍스트 자리가 22.67pt만 남는다. iOS도 같은 값을 쓴다.
- 확인하지 못한 항목과 남은 리스크: Android→iOS 역방향 변환과 친구·더보기·잠금화면 프리뷰는 착수 전이다. 기기 설치 과정에서 기존 `com.ktheme.themex_bf801df4f`를 제거하고 재설치했다 — 브라우저마다 서명 키가 달라 같은 패키지를 덮어쓸 수 없다.
