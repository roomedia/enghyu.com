// 역변환이 채우는 `.ktheme` 골격. base.apk가 "모든 요소를 갖고 있고 대응 입력이
// 없으면 제거"하는 것과 같은 방식이다. 다른 점은 하나 — CSS는 생성 텍스트라
// 골격을 파일로 둘 이유가 없고, 자리를 메우려고 가짜 이미지를 넣지도 않는다.

// 공식 가이드의 서술 순서. 출력 CSS의 block 순서를 여기서만 정한다.
const blockOrder = [
  "TabBarStyle-Main",
  "HeaderStyle-Main",
  "MainViewStyle-Primary",
  "MainViewStyle-Secondary",
  "SectionTitleStyle-Main",
  "FeatureStyle-Primary",
  "DefaultProfileStyle",
  "ButtonStyle-AddFriend",
  "BackgroundStyle-ChatRoom",
  "InputBarStyle-Chat",
  "MessageCellStyle-Send",
  "MessageCellStyle-Receive",
  "BackgroundStyle-Passcode",
  "LabelStyle-PasscodeTitle",
  "PasscodeStyle",
  "BackgroundStyle-MessageNotificationBar",
  "LabelStyle-MessageNotificationBarName",
  "LabelStyle-MessageNotificationBarMessage",
  "BackgroundStyle-DirectShareBar",
  "LabelStyle-DirectShareBarName",
  "LabelStyle-DirectShareBarMessage",
];

// APK에 남지 않는 iOS 전용 메타데이터. 되돌릴 근거가 없어 고정값을 쓴다.
const manifestDefaults = {
  "-kakaotalk-theme-version": "1",
  "-kakaotalk-author-name": "ktheme2apk",
};

// block 안에서는 배경, 이미지, 기하, 색 순서로 읽는 편이 자연스럽다.
const propertyRank = property => {
  if (property === "background-color") return 0;
  if (property.includes("image")) return 1;
  if (property.includes("edgeinsets")) return 2;
  return 3;
};

function orderedBlocks(blocks) {
  const known = blockOrder.filter(name => blocks.get(name)?.length);
  const extra = [...blocks.keys()].filter(name => !blockOrder.includes(name) && blocks.get(name)?.length);
  // 같은 등급이면 이름순. 출력이 실행마다 달라지지 않게 한다.
  const compare = (left, right) => propertyRank(left[0]) - propertyRank(right[0]) || left[0].localeCompare(right[0]);
  return [...known, ...extra].map(name => [name, [...blocks.get(name)].sort(compare)]);
}

export {manifestDefaults, orderedBlocks};
