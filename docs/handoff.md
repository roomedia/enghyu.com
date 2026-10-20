# ktheme2apk Handoff

## 목표

- iOS `.ktheme`를 Android 카카오톡 테마 APK로 변환한다.
- 변환·키 생성·캐시는 사용자 브라우저에서 처리한다.
- 동일한 `base.apk + .ktheme` SHA-256 입력은 공용 캐시에서 즉시 반환한다.
- `base.apk`는 실행에 필요한 코드·manifest·resource ID만 제공하는 중립 template으로 유지한다.
- 테마가 제공하지 않은 theme resource는 변환 출력에서 제거하고 `resources.arsc` entry를 `@null`로 만든다. 실행 shell인 launcher/splash/설치 UI는 유지한다.

## 현재 구현

- `static/`: 진입점 `app.js` 하나에 ES 모듈 9개가 붙는다. `.ktheme` ZIP/CSS 파싱, 이미지명 매핑, 색상 변경, 앱 identity 변경, 브라우저 캐시, APK 생성·서명을 담당한다. 모듈별 역할은 `README.md`의 표가 정본이다.
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

## 2026-08-18 컬러 치환 버그와 매핑 보완

- 현재 구현 상태: iOS→Android 매핑 보완 1단계. 커밋 7340c47 로 들어갔다.
- 확정한 버그 둘:
  - `readStringPool()`이 UTF-16 string pool을 UTF-8 디코더로 읽어 type pool이 `'c\x00o\x00l\x00o\x00r\x00'`로 깨졌다. `pruneCompiledResources()`가 type pool 내용을 안 써서 그동안 드러나지 않았다.
  - `theme_body_cell_border_color`가 CSS에서 파싱되는데도 `resources.arsc`에 기록되지 않았다. 하드코딩 id 표에서 빠져 있었고, 값 검증이 없어 테스트가 통과했다.
- 변경한 파일과 동작: `static/resources.js`가 색상 entry id를 base.apk에서 파생한다(`compiledEntryIds`). 값 판독기 `compiledColorValues`를 추가했다 — 검증과 역방향 변환이 함께 쓴다. `static/theme.js`는 CSS 이미지 선언을 슬롯으로 읽어(`imagePropertyTargets`) Android resource를 정하고, 선언이 없으면 파일명 규약으로 물러난다. `TabBarStyle-Main`→`theme_maintab_cell_color`, `LabelStyle-PasscodeTitle`→`theme_passcode_color`, `HeaderStyle-Main` 배경→`theme_header_cell_color` 매핑을 추가했다. 친구추가 버튼 이미지는 무조건 제거하던 규칙을 풀고 입력이 있을 때만 유지한다. `static/preview.js`의 stretch source 하한을 CSS `1px`에서 bitmap 1px에 해당하는 `1 / scale`로 고쳤다.
- 실행한 검증 명령과 결과: `static/*.js`·`worker.js` `node --check` 통과, `npm run test:e2e` 통과, 실제 `뚱카츄.ktheme` E2E 통과, `git diff --check` 통과. 실제 입력 출력에서 커밋본 대비 달라진 색은 의도한 둘뿐이다 — `theme_passcode_color` `@null`→`#FF000000`, `theme_body_cell_border_color`가 처음으로 CSS 값(alpha 0.09 → `0x17000000`)으로 기록된다. 생성된 `npTc` 메타데이터는 커밋본과 완전히 동일하다.
- 회귀 가드: e2e가 실제 `base.apk`로 compiled color 치환을 직접 검증하고, 실제 base 사용 시 CSS가 정의한 모든 색이 출력 table에 있는지 대조한다.
- 실기기 재확인: `SM-S931N`(480dpi, 1080×2340, 카카오톡 26.7.1)에 이번 빌드를 설치·적용해 채팅방을 확인했다. 2글자 메시지 말풍선이 원본 크기로 온전히 그려지고 긴 말풍선도 정상이다. 직전에 보고된 "짧은 말풍선 폭 좁음"은 이 빌드에서 재현되지 않는다. 생성 `npTc`가 커밋본과 동일하므로 원인은 기기에 남아 있던 이전 빌드로 본다.
- 말풍선 텍스트 영역이 좁은 것은 테마 선언값이다. `-ios-title-edgeinsets: 61px 23.33px 20px 68px`이라 114pt 폭 중 좌 23.33 + 우 68을 여백으로 잡아 텍스트 자리가 22.67pt만 남는다. iOS도 같은 값을 쓴다.
- 확인하지 못한 항목과 남은 리스크: Android→iOS 역방향 변환과 친구·더보기·잠금화면 프리뷰는 착수 전이다. 기기 설치 과정에서 기존 `com.ktheme.themex_bf801df4f`를 제거하고 재설치했다 — 브라우저마다 서명 키가 달라 같은 패키지를 덮어쓸 수 없다.

## 2026-08-18 Android→iOS 역변환

- 현재 구현 상태: `.apk`를 고르면 `.ktheme`을 만든다. 파일 입력 `accept`에 확장자를 더하고 선택 시점에 역변환해 프리뷰까지 그린다. 다운로드는 그 결과를 그대로 내보낸다.
- 변경한 파일과 동작: `static/reverse.js`가 `resources.arsc`에서 색·테마 이름을, `res/drawable-*`에서 이미지를 읽어 CSS와 `Images/`를 조립한다. 역매핑은 `slotsByTarget()`·`imageKeyForTarget()`·`colorPropertiesByTarget()`으로 정방향 표를 뒤집어 쓴다. 한 Android 색이 여러 iOS 속성으로 갈라지는 경우(send normal/highlighted)도 함께 복원한다. 알파는 `<속성>-alpha`로 다시 분리한다. 9-patch는 `npTc`에서 인셋·stretch를 역산하고 1px 테두리를 걷어낸다. `static/resources.js`에 문자열 값 판독기 `compiledStringValues`를 추가했다.
- 정방향에서 함께 잡은 버그: 전역 `colorTargets` fallback 때문에 매핑에 없는 block의 `background-color`가 다른 block 값을 덮어썼다. `뚱카츄`에서 `BottomBannerStyle`의 `#000000`이 `MainViewStyle-Primary`의 `#FFFFFF`를 가로채 `theme_background_color`가 검정으로 나갔다. 왕복 검증이 잡아낸 문제다.
- 실행한 검증 명령과 결과: `static/*.js`·`worker.js` `node --check` 통과, `npm run test:e2e` 통과, 실제 `뚱카츄.ktheme` E2E 통과, `git diff --check` 통과. 실제 입력 왕복에서 색 31개가 값까지 전부 일치하고 `edgeInsets`·`stretchPoints`도 원본과 같다(`23.33 61 68 20`, `31px 81px`).
- 리팩토링: 죽은 `colorTargets`와 미사용 export(`compiledEntryIds`, `blockColorTargets`)를 지웠다.
- 확인하지 못한 항목과 남은 리스크: 역변환 대상은 이 도구가 만든 APK다. 시판 Android 테마 APK는 XML drawable·selector 해석이 필요해 지원하지 않는다. 되돌린 `.ktheme`을 실제 iOS 카카오톡에 넣어 보지는 않았다. 여러 density가 있으면 배율이 큰 쪽만 쓴다.

## 2026-08-18 친구·더보기·잠금화면 프리뷰

- 현재 구현 상태: 프리뷰 탭바를 눌러 친구·채팅·더보기를 오간다. 잠금화면은 더보기 안의 항목으로 들어가고 뒤로 가기로 돌아온다. 탭바를 네 칸으로 늘려 목업을 왜곡하지 않으려는 선택이다. 채팅 외 화면은 정적 목업이고 입력을 받지 않는다.
- 변경한 파일과 동작: `static/screens.js`가 세 화면 마크업을 만든다. 친구 화면은 `mainBgImage`·`profileImg01`·title·description·section title·cell border 색을, 더보기는 같은 배경에 body cell 색과 잠금화면 진입을, 잠금화면은 `passcodeBgImage`·bullet 8종·keypad 배경·keypad 색·`theme_passcode_color`를 쓴다. 탭바는 `maintabIcoFriends/Chats/More`와 focused 변형, `theme_maintab_cell_color`를 반영한다. `static/preview.js`는 화면 상태를 들고 분기하며, 말풍선용 bitmap과 `<img>`용 object URL을 함께 만든다(재렌더 때 이전 URL을 폐기한다). 화면 헤더는 `.screen-header`로 분리해 채팅 화면 판별을 방해하지 않는다.
- 함께 잡은 정방향 버그: `cssColorWithAlpha`의 alpha 속성 정규식이 경계를 잡지 않아 `-ios-normal-background-alpha: 0.0`이 `background-alpha`로 매칭됐다. `뚱카츄`의 `background-color: #FFFFFF`가 `#00FFFFFF`로 나가 배경이 투명해졌다. 프리뷰가 청록색으로 보여 발견했다.
- 함께 잡은 프리뷰 버그: 내부 색 형식은 Android `#AARRGGBB`인데 CSS는 `#RRGGBBAA`로 읽는다. `#FF000000`이 투명한 빨강이 됐다. `cssColor()`로 순서를 바꿔 넣는다.
- 실행한 검증 명령과 결과: `static/*.js`·`worker.js` `node --check` 통과, `npm run test:e2e` 통과, 실제 `뚱카츄.ktheme` E2E 통과, `git diff --check` 통과. 실제 테마로 세 화면을 캡처해 배경 이미지·프로필·탭 아이콘·키패드 색 반영을 눈으로 확인했다.
- e2e 추가분: 탭 전환, 친구 화면 배경색이 입력 CSS 값과 일치, 잠금화면 bullet 4개와 탭바 미표시, 채팅 복귀. 기대 색은 입력 CSS에서 끌어와 fixture와 실제 테마 양쪽에서 성립한다.
- 확인하지 못한 항목과 남은 리스크: 세 화면은 목업이라 실제 카카오톡 레이아웃과 1:1은 아니다. 잠금화면은 탭바 없이 표시하므로 뒤로 가기 버튼이 유일한 탈출 경로다.

## 2026-08-18 프리뷰 다크모드와 키패드 프레스 컬러

- 현재 구현 상태: 프리뷰 헤더의 토글로 라이트/다크를 오간다. 카카오톡 chrome(헤더·입력바·탭바)만 어두운 표면으로 바꾸고 테마가 준 색·이미지는 그대로 둔다 — 같은 테마가 어두운 배경에서 어떻게 보이는지 확인하는 용도다. 잠금화면은 토글이 없고 마지막 상태를 따라간다. 브라우저·공용 캐시 키에 변환기 판을 섞어 변환 로직을 고치면 예전 산출물이 돌아오지 않는다. iOS가 눌림 이미지로, Android가 색으로 표현하는 키패드 프레스 컬러는 이미지 중앙 픽셀에서 뽑아 `theme_passcode_keypad_pressed_background_color`에 쓴다.
- 변경한 파일과 동작: `static/screens.js`의 `headerMarkup()`이 모든 화면 헤더를 만들고 다크 토글(태양/달 SVG, `aria-pressed`)을 붙인다. `index.html`이 `.device.is-dark` chrome 표면 CSS를 둔다. `static/preview.js`는 `previewState.dark`를 들고 토글 클릭 시 다시 그린다. `static/theme.js`는 `ButtonStyle-AddFriend` 매핑을 `-ios-image` 하나로 고쳤다 — iOS 가이드(`docs/kakaotalk_theme_user_guide_26.7.0_iOS.md`)는 이 버튼만 `-ios-image`를 쓰고 pressed 변형 선언이 없다. `PasscodeStyle:-ios-keypad-number-highlighted-image`는 `colorFromImageSlots`로 빼서 Android 색으로 보낸다 — 가이드가 iOS 이미지·Android 색 둘 다 "키패드 프레스 컬러"로 설명한다. `static/apk.js`는 `sampleFillColor()`로 중앙 픽셀에서 `#AARRGGBB`를 뽑고, 이렇게 소비한 이미지는 미지원 경고에서 뺀다 — 색으로 들어갔는데 "출력에서 제외"로 알리면 적용 실패처럼 읽힌다. Canvas 픽셀 helper(`sampleFillColor`·`cropNinePatchBorder`)는 양방향이 함께 쓰는 `static/bitmap.js`로 묶었고, 역변환 CSS의 block 순서(공식 가이드 서술 순서)·manifest 고정값·block 내 property 정렬은 `static/ktheme-skeleton.js`가 정한다. `static/app.js`는 캐시 키 해시에 `converterVersion = "2026-08-18.1"`을 섞는다. `static/app.js`의 `cacheKey`가 입력과 base 바이트에 이어 버전 문자열까지 해시한다. 친구 화면 예시 인명은 기능 이름으로 바꿨다. `README.md` 모듈 표에 신설 둘을 추가했다.
- e2e 추가분: fixture에 `PasscodeStyle` 눌림 이미지 선언을 더했다. 검증 항목은 토글 존재·다크 chrome 색·다크에서도 테마 배경색 유지·토글 해제 복귀·스낵바 경고에 소비 이미지가 섞이지 않음·실제 입력 출력에 프레스 컬러 기록. 죽어 있던 `.preview-mode` 주장은 토글 존재 확인으로 갈아꼈다.
- 실행한 검증 명령과 결과: `static/*.js`·`worker.js` `node --check` 통과, `npm run test:e2e` 통과, 실제 `뚱카츄.ktheme` E2E 통과(프레스 컬러 `#FFFAFCF2` 기록, compiled 색 34개), `git diff --check` 통과. 실제 테마로 라이트/다크 채팅·친구·잠금화면을 캡처해 chrome만 어두워지고 테마 색이 유지됨을 눈으로 확인했다.
- 확인하지 못한 항목과 남은 리스크: 다크모드는 프리뷰 전용 표면이고 생성 APK와 무관하다. 프레스 컬러를 중앙 픽셀 하나로 정하므로 무늬 있는 눌림 이미지는 근사다. 역변환은 이 색을 이미지로 되살리지 못해 왕복에서 사라진다. `converterVersion`을 올리는 것은 수동이라 변환 동작을 고치고 판 올리기를 잊으면 낡은 캐시가 살아남는다. 이번 변경으로 실기기 재설치·실행은 하지 않았다.

## 2026-08-18 늘림 seam 회귀 검증

- 현재 구현 상태: 다음 작업 우선순위 1의 잔여분을 닫았다. `1 / scale` 하한 교정은 커밋 7b3a511 로 이미 들어가 있었고 회귀 검증만 없었다.
- 변경한 파일과 동작: `tests/e2e/local-flow.mjs`가 여러 줄로 접히는 말풍선 canvas에서 늘어난 띠를 가로·세로로 훑어 색 편차를 잰다. fixture 비트맵이 한 열마다 8씩 오르는 그라데이션이라 비트맵 1열만 집으면 편차가 브라우저 보간 한 계단치에 머물고, CSS 1px을 하한으로 두면 3열이 섞여 20을 넘는다. 상한은 12로 뒀다. fixture 기하에 기대는 검사라 실제 테마 입력에서는 건너뛴다.
- 실행한 검증 명령과 결과: `node --check tests/e2e/local-flow.mjs` 통과, `npm run test:e2e` 통과(측정값 red 7·green 7), 실제 `뚱카츄.ktheme` E2E 통과, `git diff --check` 통과. 하한을 CSS 1px로 되돌려 넣었을 때 red 23·green 22로 검사가 실제로 깨지는 것을 확인하고 되돌렸다.
- 확인하지 못한 항목과 남은 리스크: 임계 12는 Chromium 보간 결과에서 잡은 값이라 다른 엔진에서는 여유가 다를 수 있다. 실제 테마 경로는 이 검사를 돌지 않으므로 늘림 왜곡은 여전히 눈으로 봐야 한다.

## 2026-08-18 APK 도구 사슬 게이트

- 현재 구현 상태: 다음 작업 우선순위 3을 닫았다. `npm run test:apk`가 실제 `base.apk`와 실제 `.ktheme`로 변환한 APK를 Android 도구 사슬에 태운다. `npm test`에는 넣지 않았다 — 실제 테마 파일과 SDK가 있어야 돌기 때문이다.
- 변경한 파일과 동작: `tests/apk-gate.mjs`가 브라우저 E2E를 그대로 태워 APK를 받고(별도 변환 경로를 하나 더 두면 그 경로가 검증되지 않은 채 남는다) `aapt2 dump badging`으로 package·label·minSdk를, `aapt2 dump resources`로 색 값 형식을, `apksigner verify --verbose`로 v2 서명을, `zipalign -c`로 4바이트 정렬을 본다. 기기가 붙어 있으면 설치·확인 뒤 지운다. build-tools는 필요한 도구를 다 갖춘 것 중 최신을 고르고 SDK 경로는 `ANDROID_SDK_ROOT`·`ANDROID_HOME`·`~/Library/Android/sdk` 순으로 찾는다 — 경로를 박아 두면 CI에서 바로 깨진다. `package.json`에 `test:apk`를, `README.md`에 사용법을 넣었다.
- 실행한 검증 명령과 결과: 실제 `뚱카츄.ktheme`로 7단계 전부 통과(package `com.ktheme.themex_2fccbc7d5`, theme 색 51개 중 32개 적용, v2 서명 true, emulator-5556 설치·제거). 서명을 깬 APK를 넣으면 `aapt2 badging`에서 멈추고 종료 코드 1이다. `APK_GATE_SKIP_DEVICE=1` 경로도 확인했다.
- 확인하지 못한 항목과 남은 리스크: 게이트가 보는 것은 워킹트리이지 커밋본이 아니다. 기기 단계는 테마 APK 단독 설치까지만 본다 — 카카오톡 호스트 앱이 없는 emulator에서는 실제 적용 화면을 확인할 수 없다. color resource 중 XML selector는 `(file)`로 나오므로 형식 검사에서 통과시킨다. 색 개수(51 중 32)는 aapt2가 세는 `color/theme_*` 기준이라 브라우저 쪽 compiled 색 개수와 다르다.

## 2026-08-18 공용 캐시 PUT 잠금

- 현재 구현 상태: 다음 작업 우선순위 4를 닫았다. `PUT /shared-cache`·`/shared-theme`가 본문 구조·서명·key 관계를 통과해야만 저장한다. 검증은 예산 가드보다 앞에 있어서 거절된 요청은 쓰기를 한 번도 하지 않는다.
- 변경한 파일과 동작: `worker.js`가 중앙 디렉터리를 직접 읽어 ZIP 여부와 필수 entry를 보고, APK 서명 블록을 id-value 쌍으로 걸어가 v2 항목을 확인한다. 테마는 `sha256(본문 ++ base.apk ++ 변환기 판)`이 key와 같아야 하고, APK는 같은 key의 원본 테마가 이미 저장돼 있어야 한다 — APK 바이트만으로는 key를 되계산할 수 없기 때문이다. base.apk는 `ASSETS` 바인딩으로 되읽고 isolate 안에 캐시한다. 변환기 판은 `static/converter-version.js`로 빼서 브라우저와 Worker가 한 값을 본다. 두 곳에 적어 두면 한쪽만 올라간 순간 저장이 전부 조용히 거절된다. 거절은 400·`X-Cache: REJECTED`, 판정 불가는 503·`X-Cache: UNVERIFIED`다.
- 실행한 검증 명령과 결과: `npm run test:worker` 8건 통과, `npm run test:e2e` 통과, `npm run test:apk` 7단계 통과, `node --check` 전부 통과. `npx wrangler dev --local`로 실제 런타임에서 확인했다 — 올바른 key 테마 204 STORED, 틀린 key 400, 쓰레기 본문 400, 원본 테마 없는 APK 400, 서명 없는 APK 400, 저장분 GET 200 HIT.
- 확인하지 못한 항목과 남은 리스크: **배포에 반영하지 않았다.** 지금 도는 판은 검증 없는 판이다. 변환기 판을 올릴 때 `acceptedConverterVersions`에 새 값을 넣지 않으면 그 순간부터 저장이 전부 거절된다 — 다운로드는 계속되지만 공용 캐시가 채워지지 않는다. 테마 PUT마다 base.apk 2.4MB를 붙여 4.5MB를 해시하므로 CPU가 그만큼 든다. APK 검증은 서명 블록의 존재만 보고 서명 자체를 검증하지는 않는다 — Worker에서 인증서 체인을 검사하는 것은 범위 밖이다. 원본 테마가 예산·용량 상한으로 저장되지 못하면 뒤따르는 APK PUT도 거절된다.


## AX 블로그 자동 배포 (2026-10-19)

### 현재 구현 상태
- `ax/` 디렉토리에 AX 트렌드 블로그 HTML 저장 (`ax/<이슈번호>-<슬러그>/index.html`)
- `scripts/build-assets.mjs`에 `["ax", "ax"]` 항목 추가 → `public/ax/`로 복사됨
- `deploy_cf.py`: Cloudflare API 직접 호출 배포 스크립트
  - Secure Vault의 `custom.cloudflare` 커넥터 사용 (서러게이트 방식)
  - 3단계: manifest 제출 → 에셋 업로드 → Worker 배포
  - worker.js는 esbuild로 번들링 후 업로드 (ES 모듈 import 해결)

### 변경한 파일과 동작
- `scripts/build-assets.mjs`: ax 항목 추가
- `ax/`: 5개 포스트 HTML (3194, 3269, 3270, 3273, 3277)
- `deploy_cf.py`: 신규 (API 직접 호출 배포)

### 실행한 검증 명령과 결과
- `node scripts/build-assets.mjs`: 성공 (ax/ 5개 포함)
- `python3 deploy_cf.py`: 성공 (Worker 배포 완료)
- `https://enghyu.com/ax/3270-mobile-jev/` 접속 확인: 정상 표시

### 확인하지 못한 항목과 남은 리스크
- 크론에서 deploy_cf.py 실행 시 Cloudflare 커넥터 접근 가능 여부 (detached 환경에서 테스트 필요)
- 에셋 캐시 무효화 동작 (Cloudflare 기본 캐시 정책에 의존)

### 다음 작업 우선순위
- enghyu-ax-publisher 크론이 새 경로(`~/workspace/enghyu-site/ax/`) 사용하도록 업데이트됨
- 다음 크론 run에서 자동 배포 동작 확인

## AX 글 목록 + 허브 진입 (2026-10-19)

### 현재 구현 상태
- `ax/index.html`: 글 목록 페이지 (카드형, 최신순). `scripts/gen_ax_index.py`가 `ax/*/` 스캔해 자동 생성
- `hub.html`: "지금 쓸 수 있는 것" 섹션에 AX 트렌드 카드 추가 (`/ax/` 링크)
- `deploy_cf.py`: 배포 전 `gen_ax_index.py` 실행하도록 연결

### 변경한 파일과 동작
- `scripts/gen_ax_index.py`: 신규 (title/description/og:image 파싱 → 카드 목록 HTML)
- `ax/index.html`: 생성됨 (5개 글)
- `hub.html`: AX 트렌드 project 카드 추가
- `deploy_cf.py`: ax 목록 갱신 단계 추가

### 실행한 검증 명령과 결과
- `python3 scripts/gen_ax_index.py`: 5개 글 목록 생성 성공
- `python3 deploy_cf.py`: 배포 성공
- `https://enghyu.com/ax/`: 글 목록 정상 표시 확인
- `https://enghyu.com/`: AX 트렌드 카드 정상 표시 확인

## AX 글 내비게이션 + 태그 페이지 + 통계 (2026-10-20)

### 현재 구현 상태
- 글 상단에 `← AX 트렌드 목록` 내비게이션 (`<nav class="topnav">`), 12개 기존 글 패치 완료
- 푸터 태그를 클릭 가능한 링크로 변경 (`/ax/tag/<슬러그>/`), 50개 태그 페이지 + `/ax/tags/` 모아보기
- 통계: `POST /ax/api/track` (R2 일자별 집계) + `GET /ax/api/stats?days=N` + `/ax/stats/` 대시보드 (조회수·유입 경로·글 간 이동, 7/30/90일)
- `deploy_cf.py`: 배포 전 `gen_ax_tags.py` 실행 단계 추가. `gen_ax_index.py`는 tag/tags/stats 디렉토리 제외 + 목록 헤더에 태그/통계 링크

### 변경한 파일과 동작
- `scripts/patch_ax_posts.py`: 신규 (기존 글 일괄 패치용, nav CSS/HTML·태그 링크화·비콘 삽입)
- `scripts/gen_ax_tags.py`: 신규 (태그 → 글 매핑, `ax/tag/<슬러그>/index.html` + `ax/tags/index.html` 생성)
- `scripts/gen_ax_index.py`: tag/tags/stats 제외, 헤더에 태그·통계 링크, 비콘 스크립트 포함
- `worker.js`: `/ax/api/track` (POST, 경로·referrer 기록), `/ax/api/stats` (GET, 최근 N일 집계) 라우트 추가. R2 키 `axstats/v1/YYYY-MM-DD.json`
- `ax/stats/index.html`: 신규 (통계 대시보드, API fetch 렌더링)
- `deploy_cf.py`: gen_ax_tags.py 실행 단계 추가
- enghyu-ax-publisher 크론 지시문: 신규 글 템플릿 필수 요소로 nav·태그 링크·비콘·CSS 명시

### 실행한 검증 명령과 결과
- `node --check worker.js`: 통과
- `python3 deploy_cf.py`: 배포 성공 (에셋 85개, Worker 배포 성공)
- `curl` 200 확인: `/ax/tags/`, `/ax/tag/opencode/`, `/ax/stats/`, `/ax/api/stats?days=7`
- `POST /ax/api/track` → `{"ok":true}`, 이후 `/ax/api/stats?days=1`에서 집계 확인 (paths/refs 정상)

### 확인하지 못한 항목과 남은 리스크
- R2 쓰기 경합 시 몇 건 유실 가능 (지표용이라 감수, 기존 download-count와 같은 패턴)
- 비콘 미지원 구형 브라우저는 fetch keepalive로 대체 (동일 스크립트 내 처리)

## 2026-10-20 10:05 — 태그 풀 도입 + 404 수정
- `scripts/tag_pool.json` 신설: 정식 태그 25개 (50개→병합). key=정식명, value=별칭, `_slugs`=한글→ASCII 슬러그, `_dropped`=[MIT, poteto-mode].
- 병합 예: AI 코딩←{AI coding,coding agent,AI개발도구,코딩에이전트,Cursor,Codex,pstack,Claude Code} / E2E 테스트←{e2e,agentic E2E,테스트 자동화,tester-army} / Jev←{jevtest,mobile-jev,모바일 에이전트} / 성능 최적화←{latency,first-token,gzip,컨텍스트압축,토큰절감} / 멀티모달←{multimodal,visual reasoning,Glimpse,Elorian}.
- 한글 태그 URL 404 원인: Cloudflare 에셋 매칭이 percent-encoded pathname 기준이라 한글 키가 안 맞음. 해결: 태그 URL은 ASCII 슬러그로 통일 (표시명은 한글 유지). `deploy_cf.py`의 매니페스트 인코딩 시도는 불필요했음 (되돌리지 않았으나 무해).
- 본문 인라인 `<a href="/ax/tag/...">` 가짜 링크 5개 글에서 제거 (깨진 링크). `gen_ax_tags.py`는 이제 `<p class="tags">` 안에서만 태그를 읽음.
- `scripts/normalize_ax_tags.py` 신설: 기존 글 태그를 풀로 정규화.
- enghyu-ax-publisher 크론 본문에 태그 풀 규칙 반영.
