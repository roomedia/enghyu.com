# KakaoTalk 사용자 테마 제작 가이드 26.7.0 — 구현 노하우

이 파일은 Android 26.7.0 공식 가이드에서 변환한 원문 Markdown과 별도로, 이 프로젝트에서 테마를 Android APK로 포팅할 때 유지해야 하는 규칙과 검증 결과를 기록한다.

## 기준 자료

- Android 공식 guide PDF: `/Users/user/Downloads/kakaotalk_theme_user_guide/카카오톡 사용자 테마 제작가이드_26.7.0_Android.pdf`
- PDF SHA-256: `3c33732ab4b5a4af83a1e8cc7c8d8d9fab348cbd6f11ff2c5c70835db5688cc4`
- PDF 페이지 수: 20
- 원문 변환본: [`kakaotalk_theme_user_guide_26.7.0_Android.md`](./kakaotalk_theme_user_guide_26.7.0_Android.md)

## 변환 원칙

1. `.ktheme`는 ZIP으로 읽고 CSS와 이미지 entry를 파싱한다.
2. CSS에서 발견된 색상만 Android resource에 반영한다. 입력에 없는 색상은 `base.apk` 값을 유지한다.
3. 입력 이미지가 있으면 `imageTargets`에 정의된 Android resource만 교체한다. Android 대응 target이 없으면 부분 변환하지 않고 실패한다.
4. source scale과 target density가 일치하는 APK entry만 교체한다. density가 다른 이미지를 임의 확대·축소하지 않는다.
   같은 이미지의 `@2x`, `@3x`, `@4x` entry는 각각 보존하며 대응 density에 선택한다. 같은 이미지·같은 density가 중복되면 모호하므로 실패한다.
5. 선택 상태·selector 상태는 입력 CSS property와 template resource가 모두 대응할 때만 반영된다.
6. 지원하지 않는 CSS property·임의 이미지명은 변환을 중단시키지 않되 경고로 표시한다. 대응 resource가 없는 asset은 `base.apk` 기본값을 유지하고, 사용자가 미적용 항목을 확인할 수 있어야 한다.

## 좌표와 말풍선

- iOS CSS의 `edgeInsets`는 CSS point다.
- Android `.9.png`의 `npTc` padding과 stretch 좌표는 bitmap pixel이다. `@2x`, `@3x` 배율을 bitmap 단계에서 적용하고, 경계를 넘으면 실패시킨다.
- 말풍선 artwork의 고정 영역과 텍스트 inset을 분리한다. `xDivs`·`yDivs`는 artwork stretch 기준점, `edgeInsets`는 텍스트 영역이다.
- iOS 배경 이미지의 마지막 `x/y` 기준점에 해당하는 1px source cell을 stretch cell로 사용한다. Android도 같은 cell을 `npTc`에 기록한다.
- `toNinePatch()`는 PNG에 1px 투명 border를 추가하므로 `npTc` 좌표는 border 추가 전 bitmap 내부 좌표 기준으로 계산한다.
- PNG chunk length/CRC는 big-endian이다. Android `npTc`는 offset 필드(`xDivsOffset`, `yDivsOffset`, `colorsOffset`)만 little-endian host representation으로 두고, padding/div/colors 값은 big-endian network representation으로 기록한다. 직렬화 순서는 `xDivsOffset`, `yDivsOffset`, `paddingLeft/Right/Top/Bottom`, `colorsOffset`, 배열 순서다. 전체를 한 endian으로 쓰거나 필드 순서를 바꾸면 Android가 div/padding 위치를 잘못 읽어 말풍선 폭·높이가 비정상 확장된다.
- `npTc` padding은 반올림 손실을 피하기 위해 CSS point 단계에서는 소수점을 보존하고 bitmap pixel 변환 시에만 반올림한다.
- bubble image가 입력됐는데 대응 edge inset property가 없으면 잘못된 stretch를 만들지 않고 실패한다.
- APK v2 digest는 local files, central directory, EOCD를 각각 독립된 1 MiB chunk sequence로 해시한다. digest용 EOCD central-directory offset은 signing block 삽입 전 값이고, 최종 APK에 쓸 EOCD에서만 signing block 크기를 반영한다.

## 색상·identity·fallback

- `colorTargets`와 block별 color mapping이 단일 매핑 기준이다. 같은 색상을 여러 resource에 중복 생산하지 않는다.
- body cell alpha와 selected alpha는 별도 값으로 취급한다. 예: body cell `#00ffffff`, selected `#0d383838`.
- 앱 package는 입력 테마명과 입력 hash에서 생성한다.
- 앱 label은 입력 `.ktheme` 이름 원문을 사용한다.
- 입력에 별도 매핑이 없는 icon과 splash는 중립 template 값을 유지한다.
- `base.apk`는 공식 KakaoTalk 기본 테마 APK가 아니라 Android Sample Theme 기반 template이다. 정확한 기본 fallback이 필요하면 같은 버전의 공식 template으로 교체해야 한다.

## 검증

```sh
node --check static/app.js
npm run test:e2e
git diff --check
```

실제 APK는 추가로 다음을 확인한다.

```sh
aapt2 dump resources <output.apk>
apksigner verify --verbose <output.apk>
```

가능하면 연결 실기기에 설치·실행하고, 긴/짧은 메시지·송수신 말풍선·선택 상태·입력 bar를 확인한다. 브라우저 signer 원본은 Android 16에서 `resources.arsc` 정렬·비압축 및 v2 digest 조건을 별도로 확인해야 한다.

## 알려진 리스크

- 지원 범위는 `static/app.js`의 `imageTargets`·`colorTargets`와 현재 `base.apk` resource에 한정된다.
- template version이 달라지면 resource ID·density·selector 대응이 달라질 수 있다.
- 다른 제작자의 `.ktheme`는 이미지명·PNG 크기·새 CSS property가 달라질 수 있으므로 fixture와 실기기 검증이 필요하다.
- Android 대응 asset이 없는 입력 image는 경고 후 base fallback을 사용한다. 지원 asset의 변환·서명·다운로드는 계속할 수 있어야 하며, 미적용 항목을 숨기면 안 된다.
