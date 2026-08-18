Android Theme
User Guide
kakaotalk 26.7.0 at 2026.

시작하기 01
사용자 테마는 카카오톡의 친구 리스트, 대화방 말풍선, 폰트 색상 등
카카오톡의 주요 화면 이미지와 색깔을 자신의 취향에 맞게 변경할 수 있도록 하는 기능입니다.
우리 가족이 담긴 소중한 사진, 내가 만든 개성 있는 캐릭터로 나만의 테마를 만들어 보세요!
사용자 테마 파일 다운로드 방법
카카오톡 테마는 실행 속도와 확장성을 고려하여 apk 파일 형태로 제작하도록 설계되었습니다.

카카오 고객센터에서 ‘내가 직접 테마를 만들 수도 있나요?’를 검색하면, 카카오톡 샘플 테마를 내려받을 수 있어요.
카카오톡 샘플 테마 다운받기

시작하기 02
컬러 및 이미지 수정하기
① 패키지명/theme/values 폴더 의 colors.xml 파일에는 변경 가능한 컬러 값들이 정의되어 있습니다.
컬러
② 이 값들을 원하는 색으로 변경 가능하며, 형식은 #rrggbb 또는 #aarrggbb (aa=알파값) 형태로 정의합니다.
① 패키지명/theme/drawable-xhdpi, drawable-land-xhdpi, drawable-xxhdpi, drawable-land-xxhdpi,drawable-sw600dp-xxhdpi,
drawable-sw600dp-land-xxhdpi (해상도가 큰 태블릿 단말 대응) 폴더 (총 6개) 에는 변경 가능한 샘플 이미지가 있습니다. 이미지를 동일한 파일명으로 교체하시
면 됩니다.
② 샘플 파일을 참고하여 반드시 해당 폴더에 있는 리소스 그대로 적용합니다.
이미지
③ 이미지와 컬러가 동일하게 사용되는 요소는 이미지 우선으로 적용됩니다.
④ 이미지 중 권장 타입이 9-patch로 표시된 항목은 폰 사이즈나 상황에 따라 크기가 변하는 이미지로서, 추가 작업이 필요 합니다. 9-patch 방법에 대해서는 인터넷의
강좌를 참조하시면 됩니다.
체크 포인트
① 폰트 컬러 및 이미지는 변경이 가능하지만, 레이아웃은 변경이 불가합니다.

② 1080x1920 해상도 기준으로 제작해주세요. (xxhdpi)

③ 스플래시 화면은 저사양까지 고려하여 720x1080 해상도 (xhdpi) , 1080x1920 해상도 (xxhdpi) 기준으로 제작해주세요.

Build.gradle 과 기본 설정 03
패키지명 폴더/build.gradle 파일 수정 키패키지명 폴더/src/main/res/values/strings.xml 파일 수정
apply(plugin = "com.android.application")
 <?xml version="1.0" encoding="utf-8"?>

apply(plugin = "kotlin-android")

 <resources>

<string name="theme_title”>ThemeName</string>

plugins.withId("com.android.application") {
 <string name="app_name">ThemeName</string>

extensions.configure<BaseAppModuleExtension> {
 </resources>
namespace = "com.kakao.talk.theme.apeach"

compileSdk = 34

buildToolsVersion = "34.0.0"

defaultConfig {

minSdk = 26

targetSdk = 34

versionName = "11.4.0"

versionCode = 101

applicationId = "com.kakao.talk.theme.template"

sourceSets {

getByName("main") {

res.srcDirs("src/main/theme", "src/main/theme-adv")

}

}

Build.gradle 과 기본 설정 04
New
패키지명 폴더/src/main/AndroidManifest 파일 수정  테마 다크모드 지원 안내 (11.4.0)
<<?xml version="1.0" encoding="utf-8"?>
 테마의 시스템 모드를 다크 모드로 설정할 수 있습니다. 제작한 테마에 맞게 테마의 시스템 모드를 설정하세요.

<manifest xmlns:android="http://schemas.android.com/apk/res/android"

다크 모드를 적용하려면 아래 코드를 src/main/AndroidManifest 파일에 추가해야 합니다.

    xmlns:tools="http://schemas.android.com/tools"

해당 코드가 없으면 기본적으로 Light 모드로 동작합니다.
    package="com.kakao.talk.theme.apeach">

    <uses-permission android:name="com.kakao.talk.v2.theme" />

     <meta-data

	      	android:name="com.kakao.talk.theme_style"

    <queries>

		     	android:value="dark" />
        <package android:name="com.kakao.talk" />

    </queries>

    <application

        android:allowBackup="true"

| 테마  |     | 테마  |     |
| --- | --- | --- | --- |
        android:icon="@mipmap/ic_launcher"

| 기본  |     | 기본  |     |
| --- | --- | --- | --- |
        android:label="@string/app_name"

| 시스템 설정 모드 |     | 시스템 설정 모드 |     |
| --------- | --- | --------- | --- |
        tools:ignore="AllowBackup">

| 시스템 디스플레이 설정에 따라
 |     | 시스템 디스플레이 설정에 따라
 |     |
| ------------------ | --- | ------------------ | --- |
| 카카오톡도 라이트/다크 모드로
 |     | 카카오톡도 라이트/다크 모드로
 |     |
| 자동 전환됩니다.          |     | 자동 전환됩니다.          |     |
     <meta-data

| Chats |     | Chats |     |
| ----- | --- | ----- | --- |
New
	      	android:name="com.kakao.talk.theme_style"
 라이트 모드 라이트 모드
		     	android:value="dark" />

| Chats |     | Chats |     |
| ----- | --- | ----- | --- |
| 다크 모드 |     | 다크 모드 |     |
     <meta-data

        android:name="android.max_aspect"

        android:value="2.1" />

| 공식 테마 |     | 공식 테마 |     |
| ----- | --- | ----- | --- |
| 비밀의숲  |     | 비밀의숲  |     |
...

    </application>

| 겨울이야기 |     | 겨울이야기 |     |
| ----- | --- | ----- | --- |
</manifest>
| 숨바꼭질 |     | 숨바꼭질 |     |
| ---- | --- | ---- | --- |
999+ 999+
| Value 값을 다크 모드로 설정 시 |           | Value 값 미입력 시 |           |
| -------------------- | --------- | ------------- | --------- |
| 마 전                  |           | 마 전           |           |
| 라이                   |           | 라이            |           |
| 비                    |           | 비             |           |
| 이                    |           | 이             |           |
| 이 야기                 |           | 이 야기          |           |
| 자  테마                |           | 자  테마         |           |
|  정 로   자             | 테마  스트에
 |  정 로   자      | 테마  스트에
 |
| 이   니다. 자
        |           | 이   니다. 자
 |           |
| .                    |           | .             |           |

공통 / Splash Icon 05
1 icon.png 테마 아이콘 144X144(px)
theme_profile_01_image.png

theme_profile_02_image.png

테마 기본 프로필 이미지
2 theme_profile_03_image.png
01~03
1 3 4
* 각 폴더에 해당하는 리소스를 동일한 네이밍으로 넣어줍니다.
drawable-xxhdpi 폴더: 220x220(px)
* 기본 프로필 이미지는 최소 1개 최대 3개까지 지정 가능합니다.
theme_profile_01_image_full.png

theme_profile_02_image_full.png

테마 기본 프로필 이미지 클릭 시
2
theme_profile_03_image_full.png 상세보기 이미지 01~03
2 * 각 폴더에 해당하는 리소스를 동일한 네이밍으로 넣어줍니다.

drawable-nodpi 폴더: 320x320(px)
theme_splash_image.png
* OS 정책 변경으로 스플래시 이미지 적용은 OS 12 미만에서만
가능합니다.
3 테마 스플래시 이미지 세로
* 각 폴더에 해당하는 리소스를 동일한 네이밍으로 넣어줍니다.

drawable-xhdpi 폴더: 720X1280(px)

drawable-xxhdpi 폴더: 1440X2560(px)

drawable-sw600dp-xxhdpi 폴더: 1440X2560(px)
theme_splash_image.png
* OS 정책 변경으로 스플래시 이미지 적용은 OS 12 미만에서만
가능합니다.
4 테마 스플래시 이미지 가로
* 각 폴더에 해당하는 리소스를 동일한 네이밍으로 넣어줍니다.

drawable-land-xhdpi 폴더: 1280X720(px)

drawable-land-xxhdpi 폴더: 2560X1440(px)

drawable-sw600dp-land-xxhdpi 폴더: 2560X1440(px)

Main 06
1
3
theme_background_color
 메인 배경 컬러

2 2
theme_background_image.png
1 메인 배경 이미지
4 4 * theme_background_image 사용시 이미지 우선적용
1 * 이미지 상단기준 크롭 * 배경 이미지 비율 가로1 : 세로 2
2 theme_header_color 헤더 타이틀 및 아이콘 컬러
3 theme_header_cell_color 헤더 & 상태바 배경 컬러
7 4 4 4 친구탭(친구칩&소식칩) :
5 4
5 헤더 : 선택 안한 상태의 텍스트 컬러, 선택 중의 칩 배경 컬러

4
친구칩 &소식칩의 프로필명 및 타이틀
4 theme_title_color
4
친구칩의 선물하기 버튼,
소식칩의 피드 요소 (시간 및 부가정보, 더보기 버튼, 장소 아
이콘 & 텍스트, 리액션, 광고 게시물 본문텍스트..등)
4
5 친구칩 : 상태메시지, 업데이트친구_AD 배지 컬러, 생일 섹션 생
5 theme_description_color
일더보기 버튼, 업데이트 친구 영역의 ‘소식더보기’ 아이콘
6
6 theme_body_cell_pressed_color 리스트 배경 pressed
7 theme_section_title_color 섹션타이틀 컬러
8 theme_body_cell_border_color 기본리스트 & 콘텐츠 영역 보더
1
5 5 4
8
4

Main 07
1
theme_background_color
 메인 배경 컬러 / 칩 선택 중 상태 텍스트 컬러

4 1 theme_background_image.png 메인 배경 이미지
* theme_background_image 사용시 이미지 우선적용
1 2
* 이미지 상단기준 크롭 * 배경 이미지 비율 가로1 : 세로 2
2 theme_title_color
 채팅방 타이틀 컬러 / 칩 텍스트 및 아이콘 컬러

2 theme_title_pressed_color 채팅방 타이틀 프레스 컬러
3 theme_paragraph_color
 라스트메시지 컬러

3 theme_paragraph_pressed_color 라스트메시지 프레스 컬러
2
4 theme_title_color 칩 선택 중 상태 배경 컬러
3
5 5 theme_body_cell_pressed_color 리스트 배경 프레스 컬러
2
3

Main / 더보기탭 상단 08
|     |     |     | 1   |     |     | theme_background_color | 더보기탭 메인, 메인탭, 상단칩 영역 배경 컬러 |
| --- | --- | --- | --- | --- | --- | ---------------------- | -------------------------- |
1
더보기
그리드

| 홈   | 지갑  |     |     |     |     |                   |               |
| --- | --- | --- | --- | --- | --- | ----------------- | ------------- |
|     |     |     |     |     |     | theme_title_color | 아이콘 + 라벨 텍스트
 |
2
페이지네이션 포커싱 닷
|     | 53,000원 |     | 송금 자산 |     | 결제  |     |     |
| --- | ------- | --- | ----- | --- | --- | --- | --- |
theme_title_color, alpha 0.06
|     |     |     |     |     |     | 3                                | 그리드 영역 배경        |
| --- | --- | --- | --- | --- | --- | -------------------------------- | ---------------- |
|     |     |     |     |     | 3   | 4 theme_feature_browse_tab_color | 그리드 페이지네이션 디폴트 닷 |
2
| 2 선물하기 |     | 받은선물  | 톡딜   | 이모티콘 |     |     |     |
| ------ | --- | ----- | ---- | ---- | --- | --- | --- |
| 라이브쇼핑  |     | 브랜드패션 | 메이커스 | 프렌즈  |     |     |     |
| 모바일신분증 |     | 캘린더   | 게임   | 예약하기 |     |     |     |
|        |     | 2     | 4    |      |     |     |     |
AD
나이키 골프 Collection
바로가기
게임플레이
게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
24
NEW
|     | 쬬르디
 |     |     |     | 쌍둥이 찾기 |     |     |
| --- | ---- | --- | --- | --- | ------ | --- | --- |
구출 대작전
| 쬬르디 구출 대작전 |               |     | 쬬르디 퍼즐탐험 |        | 쬬르디 쌍둥이 찾기 |     |     |
| ---------- | ------------- | --- | -------- | ------ | ---------- | --- | --- |
| 130만 플레이   |               |     | 80만 플레이  |        | 110만 플레이   |     |     |
|            | 이번주 나의 랭킹     |     |          | 23위    |            |     |     |
|            | 이번 달 나의 쇼핑포인트 |     |          | 5,123P |            |     |     |

| 이   |     |     | 이   |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 이   |     |     | 이   |     |     |     |     |

18
|     |     |  C  | .   |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
나

기
|                     | 하   |     | 이모  |     |     |
| ------------------- | --- | --- | --- | --- | --- |
|                     | 이쇼핑 | 이   | 프   |     |     |
| Main / 더보기탭 게임 플레이모 |  영역 | 게임  | 하   |     | 09  |
AD
게임 플레이

타이틀

공지 텍스트

theme_title_color
1
게임 슬롯 타이틀

랭킹 타이틀 및 랭킹 정보

쇼핑포인트 타이틀 및 포인트 정보
나이키 골프 Collection
바로가기
2 theme_title_color, alpha 0.06 게임플레이 배경
1 게임플레이
게임플레이

2
1
3 theme_description_color 게임 슬롯 부가 정보 및 아이콘

게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
랭킹 및 쇼핑 포인트 아웃링크 아이콘
NEW
쬬르디
 쌍둥이 찾기
theme_body_cell_border_color
4 게임플레이 컨텐츠 디바이드 보더
구출 대작전
|     | 1 쬬르디 구출 대작전 | 쬬르디 퍼즐탐험  |     | 쬬르디 쌍둥이 찾기 |     |
| --- | ------------ | --------- | --- | ---------- | --- |
|     | 130만 플레이     | 3 80만 플레이 |     | 110만 플레이   |     |
4
3
|     | 이번주 나의 랭킹     | 1   | 1 23위  | 3   |     |
| --- | ------------- | --- | ------ | --- | --- |
|     | 이번 달 나의 쇼핑포인트 |     | 5,123P |     |     |
카카오 나우
|     | 일이삼사오육칠팔구  | 일이삼사오육칠팔구  |     |     |     |
| --- | ---------- | ---------- | --- | --- | --- |
|     | 십일이삼사오육칠팔  | 십일이삼사오육칠팔  |     |     |     |
|     | 일이삼사오육칠팔구십 | 일이삼사오육칠팔구십 |     |     |     |
24
|     | 일이삼사오육칠팔구  | 일이삼사오육칠팔구  |     |     |     |
| --- | ---------- | ---------- | --- | --- | --- |
|     | 십일이삼사오육칠팔  | 십일이삼사오육칠팔  |     |     |     |
|     | 일이삼사오육칠팔구십 | 일이삼사오육칠팔구십 |     |     |     |

18
 C .
나

기
| 하               |     | 이모  |     |
| --------------- | --- | --- | --- |
| 이쇼핑             | 이   |     |     |
| 모               | 게임  | 하   |     |
| 나이  Collectio n |     |     |     |
기
이
게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
NEW
| 쬬르디
 |     |     | 쌍둥이 찾기 |
| ---- | --- | --- | ------ |
구출 대작전
Main / 더보기탭 하단 컨텐츠 영역 10
| 쬬르디 구출 대작전 | 쬬르디 퍼즐탐험 |     | 쬬르디 쌍둥이 찾기 |
| ---------- | -------- | --- | ---------- |
| 130만 플레이   | 80만 플레이  |     | 110만 플레이   |
| 이번주 나의 랭킹  |          | 23위 |            |
카카오 나우

| 이번 달 나의 쇼핑포인트 |     | 5,123P |     |
| ------------- | --- | ------ | --- |
타이틀

theme_title_color
1
날씨

카카오 나우
1
위치 정보

온도 및 익일 온도 비교 정보
| 일이삼사오육칠팔구 | 일이삼사오육칠팔구 |     |     |
| --------- | --------- | --- | --- |
| 십일이삼사오육칠팔 | 십일이삼사오육칠팔 |     |     |
2 theme_description_color 날씨 미세먼지 타이틀
| 일이삼사오육칠팔구십 | 일이삼사오육칠팔구십 |     |     |
| ---------- | ---------- | --- | --- |
3 theme_title_color, alpha 0.7 날씨 GPS 메타포 아이콘
4 theme_title_color, alpha 0.2 날씨 GPS 아이콘 버튼 보더
| 일이삼사오육칠팔구  | 일이삼사오육칠팔구  |     |     |
| ---------- | ---------- | --- | --- |
| 십일이삼사오육칠팔  | 십일이삼사오육칠팔  |     |     |
| 일이삼사오육칠팔구십 | 일이삼사오육칠팔구십 |     |     |
성남시 백현동
1
1
3
18°
어제보다 2°C 높아요.
4
나쁨
1 2
삼평동, 주변 호텔
호텔 스카이파크 센트럴 서울 판교
경기 성남시 분당구 판교역로 152
24

Main 11
|     |     |     |     |     | 1 theme_body_secondary_cell_color |     | 3,4탭 배경 컬러 |
| --- | --- | --- | --- | --- | --------------------------------- | --- | ---------- |
지금
theme_maintab_cell_image.9.png

*9-patch 이미지 사이즈 : 1442X214(px)
| 숏폼  | 오픈채팅 |     |     |     |     |     |            |
| --- | ---- | --- | --- | --- | --- | --- | ---------- |
|     | 137  |     |     |     | 2   |     | 메인탭 배경 이미지 |
스케일을 4배 키운 1440X212(px) svg 레이어의 좌/우/하단에 1px
라인과 점을 찍고  상단은 1px의 빈공간을 남깁니다.
|     |     |     |     |     | theme_tab_bannerbadge_background_color |     | 탭 배너 배경컬러 |
| --- | --- | --- | --- | --- | -------------------------------------- | --- | --------- |
3
* 어두운 컬러로 배경 컬러값을 사용하길 권장합니다.
지금 뜨는 커뮤니티
|     |     |     |     |     | 4   | theme_maintab_ico_friends_image.png
 | 친구탭 아이콘
 |
| --- | --- | --- | --- | --- | --- | ------------------------------------ | -------- |
해외 여행 사진방
1
|     |     |     |     |     | 4   | theme_maintab_ico_friends_focused_image.png | 친구탭 선택 시 아이콘 |
| --- | --- | --- | --- | --- | --- | ------------------------------------------- | ------------ |
|     |     |     |     |     |     |                                             |              |
|     |     |     |     |     |     | theme_maintab_ico_chats_image.png
          | 채팅탭 아이콘
     |
5
5
|     |     |     |     |     |     | theme_maintab_ico_chats_focused_image.png | 채팅탭 선택 시 아이콘 |
| --- | --- | --- | --- | --- | --- | ----------------------------------------- | ------------ |
|     |     |     |     |     | 6   | theme_maintab_ico_now_image.png
          | 지금탭 아이콘
     |
|     |     |     |     |     | 6   | theme_maintab_ico_now_focused_image.png   | 지금탭 선택 시 아이콘 |
theme_maintab_ico_shopping_image.png

|     |     |     |     |     | 7   |     | 쇼핑탭 아이콘
 |
| --- | --- | --- | --- | --- | --- | --- | -------- |
7
|     |      |     |     |     |     | theme_maintab_ico_shopping_focused_image.png | 쇼핑탭 선택 시 아이콘 |
| --- | ---- | --- | --- | --- | --- | -------------------------------------------- | ------------ |
| 256 | 1669 | 490 |     |     |     |                                              |              |
9
|     |     |     |     |     |     | theme_maintab_ico_more_image.png
 | 더보기탭 아이콘
 |
| --- | --- | --- | --- | --- | --- | --------------------------------- | --------- |
8
| 3   | 일이삼사오육칠팔구십일이 |     |     |     |     |     |     |
| --- | ------------ | --- | --- | --- | --- | --- | --- |
댓글256
8
와 에펠탑은 언제 봐도 로망 그 자체네요!
 theme_maintab_ico_more_focused_image.png 더보기탭 선택 시 아이콘
2
3 파리 감성이추 듬석 뿍귀성 느길껴 교집통니상황다, .서울서 부산 7시간
|     |     |     |     |     | 9 theme_description_color |     | 탭 배너 AD 배지 컬러 |
| --- | --- | --- | --- | --- | ------------------------- | --- | ------------- |
2
| 4              | 5   | 6   | 7   | 8   |                                |     |     |
| -------------- | --- | --- | --- | --- | ------------------------------ | --- | --- |
| 수도권 날씨 실시간 대화방 |     |     |     |     | * * 탭아이콘은 최소 56dp 사이즈로 제작해주세요. |     |     |
|                |     |     |     |     |                                |     |     |
     요
| 256 | 1669 | 490 |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |
요 리   이 로 네요.
 성은   니다.
 해지 는   방

|     | 1669 | 490 |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |

방방방방방방
방  방방
|     | 1669 | 490 |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |
  에 도 도
니다.
오권   방

오이
제     에
이
 요    이 니다.
 로    리   망
 이 로 로    리
  망 이 로 니다.
|     | 1669 | 490 |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |
이 로  다 도
성도       네요..
  실시간

|     | 1669 | 490 |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |
이 은   도이네요
  그로 느껴요
 해지 는   방
|     |      |     |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- |
|     | 1669 | 490 |     |     |     |     |     |
  에 도 도
니다.

Main 12
지금
theme_maintab_cell_color
1 숏폼탭 탭바 배경 컬러
숏폼탭 선택 시 #111113으로 배경컬러 변환됨
숏폼 오픈채팅
60.8만
1,342
253
멍뭉이의 하루 친구추가
120
엄마 아빠를 대하는 강아지의 극심한 온도차 🐶
조회수 9.1만
24
1

Main 13
| 9   | theme_maintab_ico_piccoma_image.png
        | 픽코마탭 아이콘  * 글로벌 버전 3번째 탭 (일본)
 |
| --- | ------------------------------------------- | ------------------------------ |
| 9   | theme_maintab_ico_piccoma_focused_image.png | 픽코마탭 선택 시 아이콘                  |
|     | theme_maintab_ico_local_image.png
          | 로컬탭 아이콘  * 글로벌 버전 3번째 탭 (북미)
  |
9
9
|     | theme_maintab_ico_local_focused_image.png | 로컬탭 선택 시 아이콘 |
| --- | ----------------------------------------- | ------------ |
|     | theme_maintab_ico_call_image.png
         | 콜탭 아이콘
      |
10
| 10  | theme_maintab_ico_call_focused_image.png | 콜탭 선택 시 아이콘 |
| --- | ---------------------------------------- | ----------- |
9 10

Message Direct Share / Notification 14
1 theme_direct_share_color 전달완료배너 - 텍스트 컬러
1 2
어피치에게 메시지를 전달하였습니다. 채팅방 이동
2 theme_direct_share_button_color 전달완료배너 - 버튼 텍스트 컬러
3
Normal
3 theme_direct_share_background_color 전달완료배너 - 배경 컬러
5
4 theme_notification_color 메시지 알림 팝업/토스트 - 텍스트 컬러
4
5 theme_notification_background_color 메시지 알림 팝업/토스트 - 배경 컬러
Pressed
6 theme_notification_background_pressed_color 메시지 알림 팝업/토스트 - 배경 프레스 컬러
6
** 메시지 알림 팝업은 일부 OS버전에서만 가능한 기능으로 최신버전에서는 적용되지 않을 수 있습니다.
카카오톡 테마

Passcode 15
1
1
2
theme_passcode_background_color

잠금화면 & 상태바 배경 컬러

1
theme_passcode_background_image.png
잠금화면 배경 이미지
* 키패트 상단 영역 배경 이미지는 센터 크롭됩니다.
3
7
| 2   | theme_passcode_color | 타이틀 및 서브텍스트 컬러 |
| --- | -------------------- | -------------- |
4
| 3   | theme_passcode_keypad_color         | 키패드 숫자 컬러      |
| --- | ----------------------------------- | -------------- |
| 6   | theme_passcode_keypad_pressed_color | 키패드 프레스 셀렉터 컬러 |
4
| 5   | theme_passcode_keypad_background_color         | 키패드 배경 컬러  |
| --- | ---------------------------------------------- | ---------- |
| 6   | theme_passcode_keypad_pressed_background_color | 키패드 프레스 컬러 |
5
| 7   | theme_passcode_pattern_line_color | 잠금패턴 라인 컬러 |
| --- | --------------------------------- | ---------- |

Chatroom 16
|     | theme_chatroom_background_color
 | 채팅방 배경 컬러
 |
| --- | -------------------------------- | ---------- |
1
1 theme_chatroom_background_image.png
채팅방 배경 이미지
5
* 채팅방 배경 이미지 비율은 가로1 : 세로2로 작업해 주세요.
6
|     | 2 theme_chatroom_bubble_me_color | 보낸 말풍선 - 텍스트 컬러 |
| --- | -------------------------------- | --------------- |
7
theme_chatroom_bubble_me_01_image.png
|     | 3   | 보낸 말풍선 - 첫 번째  |
| --- | --- | -------------- |
3 *9-patch 이미지
2
theme_chatroom_bubble_me_02_image.png
보낸 말풍선 - 두 번째 이후
4
*9-patch 이미지
4
|     | 5 theme_chatroom_bubble_you_color | 받은 말풍선 - 텍스트 컬러 |
| --- | --------------------------------- | --------------- |
theme_chatroom_bubble_you_01_image.png
|     | 6   | 받은 말풍선 - 첫 번째  |
| --- | --- | -------------- |
*9-patch 이미지
theme_chatroom_bubble_you_02_image.png
| 8   | 7   | 받은 말풍선 - 두 번째 이후 |
| --- | --- | ---------------- |
*9-patch 이미지
|     | 8 theme_chatroom_unread_count_color | 읽음 숫자 컬러 |
| --- | ----------------------------------- | -------- |
카카오톡 테마

Chatroom 17
1 theme_chatroom_input_bar_color 인풋바 텍스트 컬러
Case 01. 메시지 입력 후
1 2 5
2 theme_chatroom_input_bar_background_color 인풋바 배경 컬러
카카오톡 테마
3
4
3 theme_chatroom_input_bar_menu_icon_color 인풋바 메뉴 아이콘 컬러
Case 02. 메시지 입력 전
4 theme_chatroom_input_bar_send_button_color 인풋바 보내기 버튼 배경 컬러
6 6 5 theme_chatroom_input_bar_send_icon_color 인풋바 보내기 아이콘 컬러
6 theme_chatroom_input_bar_menu_button_color 메뉴 아이콘 배경 컬러, 인풋필드 배경 컬러
채팅방 입력창 UI 개선 안내 (26.5.0)
이트 인풋 메뉴 버튼
경 버튼 배경 컬러 ra ,
인풋필드 제거
→
카카오톡 테마

작업이 모두 끝났다면 다시 apk 파일로 Compile 및 Sign하여 내 폰에 설치할 수 있습니다.
카카오톡 테마는 설치 시에 어떠한 권한도 요청하지 않으므로,
만약 권한을 부여해야 한다는 메시지가 나오면 제작한 테마에 문제가 없는지 다시 한번 확인해 봐야 합니다.

설치가 성공적으로 끝나게 되면 카카오톡의 더보기 탭 > 설정 > 테마 설정 메뉴에서 설치한 테마를 확인하실 수 있으며, <적용하기> 버튼을 누르면 바로 테마가 적용되게 됩니다.
만든 테마가 적용되지 않는다면, AndroidManifest.xml 파일의 MainActivity에 테마 intent-filter가 정의되어 있는지 확인해 주세요.
<activity

android:name=".MainActivity"

...>

<intent-filter>

<action android:name="android.intent.action.MAIN" />

<category android:name="android.intent.category.LAUNCHER" />

</intent-filter>

<intent-filter>

<action android:name="com.kakao.talk.theme.action.MAIN" />

</intent-filter>

</activity>

E.O.D