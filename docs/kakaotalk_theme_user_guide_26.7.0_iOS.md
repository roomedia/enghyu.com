iOS Theme
User Guide
kakaotalk 26.7.0 at 2026.

시작하기 01
사용자 테마는 카카오톡의 친구 리스트, 대화방 말풍선, 폰트 색상 등
카카오톡의 주요 화면 이미지와 색깔을 자신의 취향에 맞게 변경할 수 있도록 하는 기능입니다.
우리 가족이 담긴 소중한 사진, 내가 만든 개성 있는 캐릭터로 나만의 테마를 만들어 보세요!
사용자 테마 파일 다운로드 방법
카카오톡 테마는 실행 속도와 확장성을 고려하여 ktheme 파일 형태로 제작하도록 설계되었습니다.

카카오 고객센터에서 ‘내가 직접 테마를 만들 수도 있나요?’를 검색하면, 카카오톡 샘플 테마를 내려받을 수 있어요.
카카오톡 샘플 테마 다운받기

시작하기 02
컬러 및 이미지 수정하기
패키지명 폴더의 KakaoTalkTheme.css 파일에는 변경 가능한 컬러값들 (ex. #rrggbb) 이 정의되어 있습니다.
컬러
이 값들을 원하는 색으로 변경 가능합니다.
패키지명/Images 폴더에는 변경 가능한 샘플 이미지가 있습니다. 이미지를 동일한 파일명으로 교체하시면 됩니다.

이미지
이미지와 컬러가 동일하게 사용되는 요소는 이미지 우선으로 적용됩니다.
패키지명 폴더의 KakaoTalkTheme.css파일에 ‘7px 10px;’라고 정의되어 있는 부분은 1배수 기준으로 수치를 조정해서 변경하면 됩니다.
인셋
ex. 10px 16px 7px 10px; 순서대로 top, left, bottom, right
체크 포인트
폰트 컬러 및 이미지는 변경이 가능하지만, 레이아웃은 변경이 불가합니다.

2배수 기준 이미지를 사용해주세요.

Mainfest / Build.gradle 과 기본 설정 03
설정 -> 테마 -> 리스트 내 노출 아이콘
1 commonIcoTheme.png 카카오톡 설정 > 앱 테마리스트 노출 아이콘
(162X162(px))
ManifestStyle New 테마 다크모드 지원 안내 (11.4.0)
-kakaotalk-theme-name: 'Sample Theme Name;
 <- 테마 이름

-kakaotalk-theme-version: ‘11.4.0’;
 아nee .
-kakaotalk-theme-url: 'http://www.kakao.com';
 드 gh 모드 다.
-kakaotalk-author-name: 'Kakao Corp.';

-kakaotalk-theme-style: 'dark';
-kakaotalk-theme-id: ‘com.kakao.talk.theme.sampleios';  <- 테마 아이디

-kakaotalk-theme-style: 'dark'; New <- 테마의 시스템 모드를 다크 모드 설정
테마 관리 테마 관리
기본 기본
시스템 설정 모드 시스템 설정 모드
시스템 디스플레이 설정에 따라 카카오톡도 시스템 디스플레이 설정에 따라 카카오톡도
라이트/다크 모드로 자동 전환됩니다. 라이트/다크 모드로 자동 전환됩니다.
Chats Chats
라이트 모드 라이트 모드
Chats Chats
다크 모드 다크 모드
공식 테마 공식 테마
앱 아이콘 변경 앱 아이콘 변경
카카오톡 공식 테마 설정 시 앱 아이콘도 함께 변경됩니다. 카카오톡 공식 테마 설정 시 앱 아이콘도 함께 변경됩니다.
비밀의 숲 비밀의 숲
11.2.0 11.2.0
겨울이야기 겨울이야기
24
11.2.0 24 11.2.0
theme-style을 다크 모드로 설정 시 theme-style 미입력 시
11.1.0 11.1.0
11.1.0 11.1.0
11.2.0 11.2.0
콘 콘
11.2.0 11.2.0
라이 라이
11.1.0 11.1.0
11.2.0 11.2.0
이 이
11.1.0 11.1.0
이야기 이야기
11.1.0 11.1.0

TabBar Style 04
|     |     |     |     |     | TabbarStyle-Main                                  |     | 탭 스타일                        |
| --- | --- | --- | --- | --- | ------------------------------------------------- | --- | ---------------------------- |
|     |     |     |     |     | -ios-background-image: 'maintabBgImage.png';
 |     | 메인탭 배경 이미지   * 배경 이미지 센터 크롭
 |
1
|     |     |     |     |     | background-color: ; |                                                          | 메인탭 배경 컬러  |
| --- | --- | --- | --- | --- | ------------------- | -------------------------------------------------------- | ---------- |
|     |     |     |     |     | 2                   | -ios-friends-normal-icon-image: 'maintabIcoFriends.png'; | 친구탭 아이콘    |
-ios-friends-selected-icon-image:
친구탭 선택 시 아이콘
'maintabIcoFriendsSelected.png';
|     |     |     |     |     | 3   | -ios-chats-normal-icon-image: 'maintabIcoChats.png'; | 채팅탭 아이콘 |
| --- | --- | --- | --- | --- | --- | ---------------------------------------------------- | ------- |
-ios-chats-selected-icon-image:
채팅탭 선택 시 아이콘
'maintabIcoChatsSelected.png';
|     |     |     |     |     | 4   | -ios-openchats-normal-icon-image: 'maintabIcoNow.png'; | 지금탭 아이콘 |
| --- | --- | --- | --- | --- | --- | ------------------------------------------------------ | ------- |
-ios-openchats-selected-icon-image:
지금탭 선택 시 아이콘
'maintabIcoNowSelected.png';
|     |     |     |     |     | 5   | -ios-shopping-normal-icon-image: 'maintabIcoShopping.png'; | 쇼핑탭 아이콘 |
| --- | --- | --- | --- | --- | --- | ---------------------------------------------------------- | ------- |
-ios-shopping-selected-icon-image:
쇼핑탭 선택 시 아이콘
| 2   | 3   | 4   | 5   | 6   |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
'maintabIcoShoppingSelected.png';
1
|     |     |     |     |     | 6   | -ios-more-normal-icon-image: 'maintabIcoMore.png';           | 더보기탭 아이콘      |
| --- | --- | --- | --- | --- | --- | ------------------------------------------------------------ | ------------- |
|     |     |     |     |     |     | -ios-more-selected-icon-image: 'maintabIcoMoreSelected.png'; | 더보기탭 선택 시 아이콘 |
1

TabBar Style 05
| TabbarStyle-Main |                                                          | 탭 스타일                       |
| ---------------- | -------------------------------------------------------- | --------------------------- |
| 7                | -ios-piccoma-normal-icon-image: 'maintabIcoPiccoma.png'; | 픽코마탭 아이콘  *글로벌 버전 3번째 탭(일본) |
-ios-piccoma-selected-icon-image:
픽코마탭 선택 시 아이콘
'maintabIcoPiccomaSelected.png';
| 7   | -ios-local-normal-icon-image: 'maintabIcoLocal.png';           | 로컬탭 아이콘  *글로벌 버전 3번째 탭(북미) |
| --- | -------------------------------------------------------------- | -------------------------- |
|     | -ios-local-selected-icon-image: 'maintabIcoLocalSelected.png'; | 로컬탭 선택 시 아이콘               |
| 8   | -ios-call-normal-icon-image: 'maintabIcoCall.png';             | 콜탭 아이콘                     |
|     | -ios-call-selected-icon-image: 'maintabIcoCallSelected.png';   | 콜탭 선택 시 아이콘                |
7 8

Mainview Style 06
1 1
HeaderStyle-Main
1 -ios-text-color: #; 헤더 타이틀 및 아이콘 컬러

Mainview Style 07
1
MainViewStyle-Primary 기본 메인/바디 스타일
2 2
background-color: #;
 친구&채팅탭 배경 컬러 / 칩 선택 중인 상태의 텍스트 컬러

1
1
-ios-background-image: 'mainBgImage.png'; 배경 이미지 *헤더 배경 : 상단/센터 기준 크롭 적용
친구탭(친구칩&소식칩) :
헤더 : 선택 안한 상태의 텍스트 컬러, 선택 중의 칩 배경 컬러

2 2 2
3 2 친구칩 &소식칩의 프로필명 및 타이틀
3 2 -ios-text-color: #;
친구칩의 선물하기 버튼,
2
2 소식칩의 피드 요소 (시간 및 부가정보, 더보기 버튼, 장소 아이
콘 & 텍스트, 리액션, 광고 게시물 본문텍스트..등)
5
2 친구칩 : 상태메시지, 업데이트친구_AD 배지 컬러, 생일 섹션 생일
2
3 3 -ios-description-text-color: #;
더보기 버튼, 업데이트 친구 영역의 ‘소식더보기’ 아이콘
4
ios-selected-background-color

4 친구칩 리스트 Pressed
ios-selected-background-alpha
SectionTitleStyle-Main 기본 메인/바디 섹션타이틀, 보더
3 3 2
6 5 -ios-description-text-color: #; 섹션타이틀 컬러
2
border-color

6 친구칩 기본 리스트 & 콘텐츠 영역 보더
border-alpha

Mainview Style 08
1
|     |     | MainViewStyle-Primary | 기본 메인/바디 스타일 |
| --- | --- | --------------------- | ------------ |
4
|     |     | background-color: #;
                     | 채팅탭 배경 컬러 / 칩 선택 중인 상태의 텍스트 컬러
  |
| --- | --- | ----------------------------------------- | -------------------------------- |
| 1   | 2   | 1                                         |                                  |
|     |     | -ios-background-image: 'mainBgImage.png'; | 배경 이미지   *헤더 배경 : 상단/센터 기준 크롭 적용 |
|     |     | 2 -ios-text-color: #;                     | 채팅방 이름 컬러 / 칩 텍스트 및 아이콘 컬러       |
2
|     |     | 2 -ios-highlighted-text-color: #;   | 채팅방 이름 프레스 컬러 |
| --- | --- | ----------------------------------- | ------------- |
| 3   |     | -ios-paragraph-text-color: #;       | 라스트메시지 컬러     |
3
|     |     | 3 -ios-paragraph-highlighted-text-color: #;   | 라스트메시지 프레스 컬러     |
| --- | --- | --------------------------------------------- | ----------------- |
|     |     | 4 -ios-text-color: #;                         | 칩 선택 중인 상태의 배경 컬러 |
5
2
|     |     | 5 -ios-selected-background-color: #;  | 리스트 배경 프레스 컬러 |
| --- | --- | ------------------------------------- | ------------- |
3
|     |     | -ios-selected-background-alpha: 0.05; | 리스트 배경 프레스 투명도 |
| --- | --- | ------------------------------------- | -------------- |

Mainview Style 09
1
|     |     |     |     |     |     | MainViewStyle-Primary | 기본 메인/바디 스타일 |
| --- | --- | --- | --- | --- | --- | --------------------- | ------------ |
더보기
|     |     |     |     |     |     | background-color | 더보기탭 메인, 메인탭, 상단칩 영역 배경 컬러, |
| --- | --- | --- | --- | --- | --- | ---------------- | --------------------------- |
1
홈 지갑
상단칩

포커싱 된 칩 배경, 디폴트 상태 칩 텍스트

|     | 53,000원 |     | 송금 자산 | 결제  |     |     |     |
| --- | ------- | --- | ----- | --- | --- | --- | --- |
2 ios-text-color
3
그리드

2
아이콘 + 라벨 텍스트

2
| 선물하기  |     | 받은선물  | 톡딜   | 이모티콘 |     |                              | 페이지네이션 포커싱 닷     |
| ----- | --- | ----- | ---- | ---- | --- | ---------------------------- | ---------------- |
|       |     |       |      |      |     | 3 ios-text-color, alpha 0.06 | 그리드 영역 배경        |
| 라이브쇼핑 |     | 브랜드패션 | 메이커스 | 프렌즈  |     |                              |                  |
|       | 캘린더 | 캘린더   | 게임   | 예약하기 |     |                              |                  |
|       |     | 2     | 4    |      |     | HeaderStyle-Main             | 기본 메인/바디 스타일     |
|       |     |       |      |      |     | 4 ios-tab-text-color         | 그리드 페이지네이션 디폴트 닷 |
AD
나이키 골프 Collection
바로가기
게임플레이
게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
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

|     | 18  | 보  C  | .   |     |     |     |     |
| --- | --- | ----- | --- | --- | --- | --- | --- |
|     |     | 지 나   |     |     |     |     |     |

| 하   |     |     | 이모  |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 이쇼핑 | 드   | 이   | 프   |     |     |     |     |     |     |
Mainview Style 10
| 더   | 더   | 게임  | 하   |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
AD
|     |     |     |     |     | MainViewStyle-Primary |     |     | 기본 메인/바디 스타일 |     |
| --- | --- | --- | --- | --- | --------------------- | --- | --- | ------------ | --- |
게임 플레이

타이틀

공지 텍스트

| 나이키 골프 Collection |     |     | 바로가기 |     |     |     |     |     |     |
| ----------------- | --- | --- | ---- | --- | --- | --- | --- | --- | --- |
1 ios-text-color
게임 슬롯 타이틀

랭킹 타이틀 및 랭킹 정보

게임플레이
1
쇼핑포인트 타이틀 및 포인트 정보
1
2
게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
|     |     |     |     |     | 2 ios-text-color, alpha 0.06 |     |     | 게임플레이 배경 |     |
| --- | --- | --- | --- | --- | ---------------------------- | --- | --- | -------- | --- |
NEW
| 쬬르디
 |     |     |     | 쌍둥이 찾기 |     |     |     |     |     |
| ---- | --- | --- | --- | ------ | --- | --- | --- | --- | --- |
게임플레이

구출 대작전
|     |     |     |     |     | 3 ios-description-text-color |     |     | 게임 슬롯 부가 정보 및 아이콘
 |     |
| --- | --- | --- | --- | --- | ---------------------------- | --- | --- | ------------------ | --- |
랭킹 및 쇼핑 포인트 아웃링크 아이콘
| 1 쬬르디 구출 대작전 |     | 쬬르디 퍼즐탐험 |     | 쬬르디 쌍둥이 찾기 |     |     |     |     |     |
| ------------ | --- | -------- | --- | ---------- | --- | --- | --- | --- | --- |
130만 플레이 80만 플레이 110만 플레이 SectionTitleStyle-Main 기본 메인/바디 스타일
| 3   |     | 3   |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
4
| 이번주 나의 랭킹 | 1   |     | 1 23위 |     |                           |     |     |                   |     |
| --------- | --- | --- | ----- | --- | ------------------------- | --- | --- | ----------------- | --- |
|           |     |     |       |     | border-color border-alpha |     |     | 게임플레이 컨텐츠 디바이드 보더 |     |
4
| 이번 달 나의 쇼핑포인트 |     |     | 5,123P | 3   |     |     |     |     |     |
| ------------- | --- | --- | ------ | --- | --- | --- | --- | --- | --- |
카카오 나우
| 일이삼사오육칠팔구  |     | 일이삼사오육칠팔구  |     |     |     |     |     |     |     |
| ---------- | --- | ---------- | --- | --- | --- | --- | --- | --- | --- |
| 십일이삼사오육칠팔  |     | 십일이삼사오육칠팔  |     |     |     |     |     |     |     |
| 일이삼사오육칠팔구십 |     | 일이삼사오육칠팔구십 |     |     |     |     |     |     |     |
| 일이삼사오육칠팔구  |     | 일이삼사오육칠팔구  |     |     |     |     |     |     |     |
| 십일이삼사오육칠팔  |     | 십일이삼사오육칠팔  |     |     |     |     |     |     |     |
| 일이삼사오육칠팔구십 |     | 일이삼사오육칠팔구십 |     |     |     |     |     |     |     |

18
|     | 보  C  | .   |     |     |                |     |     |              |     |
| --- | ----- | --- | --- | --- | -------------- | --- | --- | ------------ | --- |
|     |       |     |     |     | eaerStyle-Main |     |     | 기본 메인/바디 스타일 |     |
나
|     |     |     |     |     | e adertle-             | ainios-text-color |                           |                   |      |
| --- | --- | --- | --- | --- | ---------------------- | ----------------- | ------------------------- | ----------------- | ---- |
|     |     |     |     |     |                        |                   |                           | 인 이 ,  이          |      |
|     |     |     |     |     | e adertle-             | ainios-t          | ab-text-color             | 드  이이             | 디 트  |
|     |     |     |     |     | SectionTitleStyle-Main |                   |                           | 기본 메인/바디 스타일      |      |
|     |     |     |     |     | 1 ectionitletle-       | ain               | border-color border-alpha | 게임플레이 컨텐츠 디바이드 보더 |      |

| 하             |     |     | 이모 콘 |     |     |     |     |     |     |     |     |
| ------------- | --- | --- | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
| 이쇼핑           |     | 메이  |      |     |     |     |     |     |     |     |     |
| 더             | 더   | 게임  | 하    |     |     |     |     |     |     |     |     |
| 나이  Collectio | n   |     |      |     |     |     |     |     |     |     |     |
이
게임하며 모으는 쇼핑포인트! 게임플레이 OPEN
NEW
| 쬬르디
 |     |     |     | 쌍둥이 찾기 |     |     |     |     |     |     |     |
| ---- | --- | --- | --- | ------ | --- | --- | --- | --- | --- | --- | --- |
구출 대작전
Mainview Style 11
| 쬬르디 구출 대작전    |     | 쬬르디 퍼즐탐험 |        | 쬬르디 쌍둥이 찾기 |                       |     |     |     |              |     |     |
| ------------- | --- | -------- | ------ | ---------- | --------------------- | --- | --- | --- | ------------ | --- | --- |
| 130만 플레이      |     | 80만 플레이  |        | 110만 플레이   |                       |     |     |     |              |     |     |
| 이번주 나의 랭킹     |     |          | 23위    |            |                       |     |     |     |              |     |     |
|               |     |          |        |            | MainViewStyle-Primary |     |     |     | 기본 메인/바디 스타일 |     |     |
| 이번 달 나의 쇼핑포인트 |     |          | 5,123P |            |                       |     |     |     |              |     |     |
카카오 나우

1 카카오 나우
타이틀

| 일이삼사오육칠팔구 |     | 일이삼사오육칠팔구 |     |     | 1 ios-text-color |     |     |     |     |     |     |
| --------- | --- | --------- | --- | --- | ---------------- | --- | --- | --- | --- | --- | --- |
날씨

| 십일이삼사오육칠팔 |     | 십일이삼사오육칠팔 |     |     |     |     |     |     |     |     |     |
| --------- | --- | --------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
위치 정보

| 일이삼사오육칠팔구십 |     | 일이삼사오육칠팔구십 |     |     |     |     |     |     |     |     |     |
| ---------- | --- | ---------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
온도 및 익일 온도 비교 정보
2
|           |     |           |     |     | 2 ios-description-text-color |     |     |     | 날씨 미세먼지 타이틀      |     |     |
| --------- | --- | --------- | --- | --- | ---------------------------- | --- | --- | --- | ---------------- | --- | --- |
|           |     |           |     |     | 3 ios-text-color, alpha 0.7  |     |     |     | 날씨 GPS 메타포 아이콘   |     |     |
| 일이삼사오육칠팔구 |     | 일이삼사오육칠팔구 |     |     |                              |     |     |     |                  |     |     |
|           |     |           |     |     | ios-text-color, alpha 0.2    |     |     |     | 날씨 GPS 아이콘 버튼 보더 |     |     |
4
| 십일이삼사오육칠팔  |     | 십일이삼사오육칠팔  |     |     |     |     |     |     |     |     |     |
| ---------- | --- | ---------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 일이삼사오육칠팔구십 |     | 일이삼사오육칠팔구십 |     |     |     |     |     |     |     |     |     |
1
| 성남시 백현동 | 1             |     |     |     |     |     |     |     |     |     |     |
| ------- | ------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 18°     | 어제보다 2°C 높아요. |     |     |     |     |     |     |     |     |     |     |
|         |               |     | 3   | 4   |     |     |     |     |     |     |     |
나쁨
| 1   | 2   |     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
삼평동, 주변 호텔
호텔 스카이파크 센트럴 서울 판교
경기 성남시 분당구 판교역로 152
|     |     |     |     |     | eeaaeerrSSttyyllee--MMaaiinn           |                    |                                     |                    | 기기본본  메메인인//바바디디  스스타타일일 |            |        |
| --- | --- | --- | --- | --- | -------------------------------------- | ------------------ | ----------------------------------- | ------------------ | ------------------------ | ---------- | ------ |
|     |     |     |     |     | ee aaddeerrSSttllee--                  | aaiinn             | iiooss--tteexxtt--ccoolloorr        |                    | 메메인인   타타이이              | ,,    아아이이 | 콘콘     |
|     |     |     |     |     | ee aaddeerrSSttllee--                  | aaiinn             | iiooss--ttaa --tteexxtt--ccoolloorr |                    |   이이이이  트트               |            |        |
|     |     |     |     |     | SSeettiinniittlleeSSttyyllee--MMaaiinn |                    |                                     |                    | 기기본본  메메인인//바바디디  스스타타일일 |            |        |
|     |     |     |     |     | 11 SSeeccttiioonn                      | iittlleeSSttllee-- | aaiinn oorrddeerr--ccoolloorr  oorr | ddeerr--aallpphhaa | 게게임임플플레레이이    이이  보보     |            | 더더     |

Mainview Style 12
1
지금
MainViewStyle-Secondary 3탭/4탭 바디 스타일
숏폼 오픈채팅 137
1 background-color: #; 배경 컬러
2 -ios-text-color: #; 타이틀/이름/피드(헤더, 본문텍스트, 부가정보, 리액션 텍스트 등)
2
지금 뜨는 커뮤니티
해외 여행 사진방 2
1시간 전 참여 중
256 1669 490 22
2
댓글256 22
와 에펠탑은 언제 봐도 로망 그 자체네요!  2
파리 감성이 듬뿍 느껴집니다.
수도권 날씨 실시간 대화방
1시간 전 참여 중
전 요
256 1669 490
요 리 시이 로 네요.
성은 니다.
해지 는 방
1시간 전
26
1669 490
방방방방방방방
방1시방간 전 참여 중
256 1669 490
에 도 도
니다.
오권 방
1시간 전 참여 중
와 성전자 이
256 1669 490
이 로 다 도
성도 네요..
방방방방방방방
방1시방간 전 참여 중
256 1669 490
이 은 도이네요
그로 느껴요
방방방방방방방
방1시방간 전 참여 중
256 1669 490
에 도 도
니다.

Mainview Style 13
지금
지금
TabbarStyle 숏폼탭 탭바 배경 컬러
숏폼 오픈채팅
숏폼 오픈채팅 137
1 background-color: #; 숏폼탭 선택 시 배경 컬러 #111113으로 변환됨
1
지금 뜨는 커뮤니티
해외 여행 사진방
이 전 여행
60.8만
12 댓글 16
1,342
설레이는 라이언 전
와 에펠탑은 언제 봐도 로망 그 자체네요!

파리 감성이 듬뿍 느껴집니다. 253
멍뭉이의 하루 친구추가
수도권 날씨 실시간 대화방
파늘 전 일상 120
엄마 아빠를 대하는 강아지의 극심한 온도차 🐶
조회수오 9늘.1만 아침 바람 완전 가을같지 않나요?
12 댓글 16
1
913979+
지표바라기 전

Feature Style / DefaultProfile Style 14
친구 친구찾기
FeatureStyle-Primary
1 -ios-text-color: #; 서비스 버튼컬러
DefaultProfileStyle
2
1 -ios-profile-images: 'profileImg01.png' 테마 기본 프로필 이미지
3
1
콘
ButtonStyle-AddFriend 글로벌탭
2 -ios-image: 'findBtnAddFriend.png'; 글로벌 찾기 친구추가 버튼 이미지

Chat Room 15
1
BackgroundStyle-ChatRoom 채팅방 배경
background-color: #;
 배경 컬러

1
-ios-background-image: 'chatroomBgImage.png'; 배경 이미지
카카오톡 테마

Chat Room 16
|     |     |     | InputBarStyle-Chat   | 인풋바       |
| --- | --- | --- | -------------------- | --------- |
|     |     |     | background-color: #; | 인풋바 배경 컬러 |
1
ae 0.  입력
1
|     |     |     | 2 -ios-send-normal-background-color: #; | 보내기 버튼 배경 컬러 |
| --- | --- | --- | --------------------------------------- | ------------ |

|     |     |     | 2 -ios-send-highlighted-background-color: #; | 보내기 버튼 배경 프레스 컬러 |
| --- | --- | --- | -------------------------------------------- | ---------------- |
ae 02.  입력  3 -ios-send-normal-foreground-color: #; 보내기 버튼 아이콘 컬러
| 6   |     | 2   |     |     |
| --- | --- | --- | --- | --- |
일이삼사오육칠팔구십 3 -ios-send-highlighted-foreground-color: #; 보내기 버튼 아이콘 프레스 컬러
| 4   | 5   | 3   |                                         |              |
| --- | --- | --- | --------------------------------------- | ------------ |
|     |     |     | -ios-button-normal-foreground-color: #; | 메뉴 버튼 아이콘 컬러 |
4
ae 0.  ree
2
|     | 5   |     | 4 -ios-button-highlighted-foreground-color: #; | 메뉴 버튼 아이콘 프레스 컬러 |
| --- | --- | --- | ---------------------------------------------- | ---------------- |
일이삼사오육칠팔구십
| 4   |     | 3   | 5  -ios-button-text-color: #;             | 인풋바 텍스트 컬러   |
| --- | --- | --- | ----------------------------------------- | ------------ |
|     |     |     | 6 -ios-button-normal-background-color: #; | 메뉴 아이콘 배경 컬러 |
채팅방 입력창 안내 (26.6.0)
 이 -    경   버튼이  보이
     배경
카카오톡 테마

Message Style 17
|     | MessageCellStyle-Send | 보낸 메시지 |
| --- | --------------------- | ------ |
1 -ios-background-image: 'chatroomBubbleSend01.png' 20px 20px; 첫 번째 말풍선  *20x20 (px) 말풍선 내 콘텐츠/텍스트 좌표
|     | 1 -ios-selected-background-image: 'chatroomBubbleSend01Selected.png' 20px 20px; | 첫 번째 말풍선 선택 |
| --- | ------------------------------------------------------------------------------- | ----------- |
7
|     | 1 -ios-title-edgeinsets: 10px 10px 7px 12px;    * 첫번째 말풍선 인셋 (top, left, bottom, right 순서)  | 첫 번째 말풍선 인셋 |
| --- | ------------------------------------------------------------------------------------------- | ----------- |
7
5
|     | 2 -ios-group-background-image: 'chatroomBubbleSend02.png' 20px 20px; | 두 번째 이상 말풍선 |
| --- | -------------------------------------------------------------------- | ----------- |
8
6
7 2
|     | -ios-group-selected-background-image: 'chatroomBubbleSend02Selected.png' 20px 20px; | 두 번째 이상 말풍선 선택 |
| --- | ----------------------------------------------------------------------------------- | -------------- |
7
7
|     | 1 -ios-group-title-edgeinsets: 10px 10px 7px 12px;   * 두번째 이상 말풍선 인셋 (top, left, bottom, right 순서)  | 두 번째 이상 말풍선 인셋 |
| --- | --------------------------------------------------------------------------------------------------- | -------------- |
5
| 8   | 3 -ios-text-color: #; | 텍스트 컬러 |
| --- | --------------------- | ------ |
6
3
|     | 3 -ios-selected-text-color: #; | 텍스트 선택 컬러 |
| --- | ------------------------------ | --------- |
3 1
|     | 4 -ios-unread-text-color: #; | 읽지않은 메세지 숫자 컬러 |
| --- | ---------------------------- | -------------- |
2
3
| 4   | MessageCellStyle-Receive | 받은 메시지 |
| --- | ------------------------ | ------ |
5 -ios-background-image: 'chatroomBubbleReceive01.png' 20px 20px; 첫 번째 말풍선  *20x20 (px) 말풍선 내 콘텐츠/텍스트 좌표
4
|     | 5 -ios-selected-background-image: 'chatroomBubbleReceive01Selected.png' 20px 20px; | 첫 번째 말풍선 선택 |
| --- | ---------------------------------------------------------------------------------- | ----------- |
1 1 -ios-title-edgeinsets: 10px 16px 7px 10px;    * 첫번째 말풍선 인셋 (top, left, bottom, right 순서)  첫 번째 말풍선 인셋
3
2 6 -ios-group-background-image: 'chatroomBubbleReceive02.png' 20px 20px; 두 번째 이상 말풍선
|     | 6 -ios-group-selected-background-image: 'chatroomBubbleReceive02Selected.png' 20px 20px ;  | 두 번째 이상 말풍선 선택 |
| --- | ------------------------------------------------------------------------------------------ | -------------- |
카카오톡 테마 1 -ios-group-title-edgeinsets: 10px 16px 7px 10px;   * 두번째 이상  말풍선 인셋 (top, left, bottom, right 순서)  두 번째 이상 말풍선 인셋
|     | 7 -ios-text-color: #;          | 텍스트 컬러         |
| --- | ------------------------------ | -------------- |
|     | 7 -ios-selected-text-color: #; | 텍스트 선택 컬러      |
|     | 8 -ios-unread-text-color: #;   | 읽지않은 메세지 숫자 컬러 |

Passcode 18
BackgroundStyle-Passcode 잠금화면 상단
background-color: #;
 배경 컬러

1
1
1
-ios-background-image: 'passcodeBgImage.png'; 배경 이미지
LabelStyle-PasscodeTitle 텍스트 컬러
2
2 -ios-text-color: #;
4
PasscodeStyle 키패드
3
-ios-bullet-first-image: 'passcodeImgCode01.png';

-ios-bullet-second-image: 'passcodeImgCode02.png';

3 잠금화면 불릿 이미지
-ios-bullet-third-image: 'passcodeImgCode03.png';

-ios-bullet-fourth-image: 'passcodeImgCode04.png';
6
-ios-bullet-selected-first-image: 'passcodeImgCode01Selected.png';

-ios-bullet-selected-second-image: 'passcodeImgCode02Selected.png';

7
5 4 잠금화면 불릿 이미지 - 입력
-ios-bullet-selected-third-image: 'passcodeImgCode03Selected.png';

-ios-bullet-selected-fourth-image: 'passcodeImgCode04Selected.png';
5 -ios-keypad-background-color: #; 키패드 배경 컬러
6 -ios-keypad-text-normal-color: #; 키패드 숫자 텍스트 컬러
7 -ios-keypad-number-highlighted-image : 'passcodeKeypadPressed.png'; 키패드 프레스 컬러

MessageNotificationBar/DirectShareBar 19
BackgroundStyle-MessageNotificationBar.
2
1 4
3
5 6
1 background-color: #; 메시지 알림 배너 - 배경 컬러
LabelStyle-MessageNotificationBarName.
2 -ios-text-color: #; 메시지 알림 배너 - 이름 컬러
LabelStyle-MessageNotificationBarMessage
3 -ios-text-color: #; 메시지 알림 배너- 텍스트 컬러
BackgroundStyle-DirectShareBar.
4 background-color: #; 전달완료 배너 - 배경 컬러
LabelStyle-DirectShareBarName.
5 -ios-text-color: #; 전달완료 배너 - 이름 컬러
카카카카오오톡톡 테 테마마 카카카카오오톡톡 테 테마마
LabelStyle DirectShareBarMessage.
6 -ios-text-color: #; 전달완료 배너 - 텍스트 컬러

BottomBanner Style 20
BottomBannerStyle
탭 배너 배경 컬러
1 background-color
* 어두운 컬러를 배경컬러로 지정하시길 권장합니다.
MainViewStyle-Primary
2 -ios-description-text-color AD 배지 컬러
2
1 일이삼사오육칠팔구십일이
1 추석 귀성길 교통상황, 서울서 부산 7시간

테마 적용하기 21
.ktheme 파일 적용
| ① 테마       | 수정이  | 완료되면  |      | CSS       | 파일과    | 이미지     | 폴더를  |                | ZIP  파일로                   | 압축합니다.
 |           |          |     |
| ---------- | ---- | ----- | ---- | --------- | ------ | ------- | ---- | -------------- | -------------------------- | -------- | --------- | -------- | --- |
| ② ZIP      | 파일의  | 확장자를  |      | ktheme로   |        | 변경합니다.  |      | (테마명.ktheme)
 |                            |          |           |          |     |
| ③ 압축된      | 테마   | 파일을   |      | 외부에서      | 다운로드할  |         | 수    | 있는             | 곳에  업로드하거나 카카오톡으로 전송합니다.
 |          |           |          |     |
| ④ 업로드한     |      | URL을  | 사파리  | 주소창에      |        | 입력      | or   | 링크를            | 선택하시면                      | <카카오톡으로  | 열기>  버튼이  | 활성화됩니다.  |
  |
| ⑤ <카카오톡으로  |      |       | 열기>  | 를  선택하시면  |        | 테마가     |      | 설치됩니다.         |                            |          |           |          |     |

E.O.D