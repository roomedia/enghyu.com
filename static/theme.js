// iOS .ktheme CSS 파싱과 Android resource 이름 매핑.
const imageTargets = {
  mainBgImage: "theme_background_image.png",
  maintabBgImage: "theme_maintab_cell_image.9.png",
  chatroomBgImage: "theme_chatroom_background_image.png",
  passcodeBgImage: "theme_passcode_background_image.png",
  maintabIcoFriends: "theme_maintab_ico_friends_image.png",
  maintabIcoFriendsSelected: "theme_maintab_ico_friends_focused_image.png",
  maintabIcoChats: "theme_maintab_ico_chats_image.png",
  maintabIcoChatsSelected: "theme_maintab_ico_chats_focused_image.png",
  maintabIcoNow: "theme_maintab_ico_now_image.png",
  maintabIcoNowSelected: "theme_maintab_ico_now_focused_image.png",
  maintabIcoLocal: "theme_maintab_ico_local_image.png",
  maintabIcoLocalSelected: "theme_maintab_ico_local_focused_image.png",
  maintabIcoPiccoma: "theme_maintab_ico_piccoma_image.png",
  maintabIcoPiccomaSelected: "theme_maintab_ico_piccoma_focused_image.png",
  maintabIcoShopping: "theme_maintab_ico_shopping_image.png",
  maintabIcoShoppingSelected: "theme_maintab_ico_shopping_focused_image.png",
  maintabIcoMore: "theme_maintab_ico_more_image.png",
  maintabIcoMoreSelected: "theme_maintab_ico_more_focused_image.png",
  maintabIcoCall: "theme_maintab_ico_call_image.png",
  maintabIcoCallSelected: "theme_maintab_ico_call_focused_image.png",
  chatroomBubbleSend01: "theme_chatroom_bubble_me_01_image.9.png",
  chatroomBubbleSend02: "theme_chatroom_bubble_me_02_image.9.png",
  chatroomBubbleReceive01: "theme_chatroom_bubble_you_01_image.9.png",
  chatroomBubbleReceive02: "theme_chatroom_bubble_you_02_image.9.png",
  passcodeImgCode01: "theme_passcode_01_image.png",
  passcodeImgCode02: "theme_passcode_02_image.png",
  passcodeImgCode03: "theme_passcode_03_image.png",
  passcodeImgCode04: "theme_passcode_04_image.png",
  passcodeImgCode01Selected: "theme_passcode_01_checked_image.png",
  passcodeImgCode02Selected: "theme_passcode_02_checked_image.png",
  passcodeImgCode03Selected: "theme_passcode_03_checked_image.png",
  passcodeImgCode04Selected: "theme_passcode_04_checked_image.png",
  profileImg01: "theme_profile_01_image.png",
};
const blockColorTargets = {
  "HeaderStyle-Main": {"background-color": "theme_header_cell_color", "-ios-text-color": "theme_header_color", "-ios-tab-text-color": "theme_title_color", "-ios-tab-highlighted-text-color": "theme_title_pressed_color"},
  "TabBarStyle-Main": {"background-color": "theme_maintab_cell_color"},
  "MainViewStyle-Primary": {"background-color": "theme_background_color", "-ios-text-color": "theme_title_color", "-ios-highlighted-text-color": "theme_title_pressed_color", "-ios-description-text-color": "theme_description_color", "-ios-description-highlighted-text-color": "theme_description_pressed_color", "-ios-paragraph-text-color": "theme_paragraph_color", "-ios-paragraph-highlighted-text-color": "theme_paragraph_pressed_color", "-ios-normal-background-color": "theme_body_cell_color", "-ios-selected-background-color": "theme_body_cell_pressed_color"},
  "MainViewStyle-Secondary": {"background-color": "theme_body_secondary_cell_color"},
  "SectionTitleStyle-Main": {"border-color": "theme_body_cell_border_color", "-ios-text-color": "theme_section_title_color"},
  "FeatureStyle-Primary": {"-ios-text-color": "theme_feature_primary_color"},
  "BackgroundStyle-ChatRoom": {"background-color": "theme_chatroom_background_color"},
  "InputBarStyle-Chat": {"background-color": "theme_chatroom_input_bar_background_color", "-ios-send-normal-background-color": "theme_chatroom_input_bar_send_button_color", "-ios-send-highlighted-background-color": "theme_chatroom_input_bar_send_button_color", "-ios-send-normal-foreground-color": "theme_chatroom_input_bar_send_icon_color", "-ios-send-highlighted-foreground-color": "theme_chatroom_input_bar_send_icon_color", "-ios-button-normal-foreground-color": "theme_chatroom_input_bar_menu_icon_color", "-ios-button-highlighted-foreground-color": "theme_chatroom_input_bar_menu_icon_color", "-ios-button-text-color": "theme_chatroom_input_bar_color", "-ios-button-normal-background-color": "theme_chatroom_input_bar_menu_button_color"},
  "MessageCellStyle-Send": {"-ios-text-color": "theme_chatroom_bubble_me_color", "-ios-selected-text-color": "theme_chatroom_bubble_me_color", "-ios-unread-text-color": "theme_chatroom_unread_count_color"},
  "MessageCellStyle-Receive": {"-ios-text-color": "theme_chatroom_bubble_you_color", "-ios-selected-text-color": "theme_chatroom_bubble_you_color", "-ios-unread-text-color": "theme_chatroom_unread_count_color"},
  "BackgroundStyle-Passcode": {"background-color": "theme_passcode_background_color"},
  "LabelStyle-PasscodeTitle": {"-ios-text-color": "theme_passcode_color"},
  "PasscodeStyle": {"-ios-keypad-background-color": "theme_passcode_keypad_background_color", "-ios-keypad-text-normal-color": "theme_passcode_keypad_color"},
  "BackgroundStyle-MessageNotificationBar": {"background-color": "theme_notification_background_color"},
  "LabelStyle-MessageNotificationBarName": {"-ios-text-color": "theme_notification_color"},
  "LabelStyle-MessageNotificationBarMessage": {"-ios-text-color": "theme_description_color"},
  "BackgroundStyle-DirectShareBar": {"background-color": "theme_direct_share_background_color"},
  "LabelStyle-DirectShareBarName": {"-ios-text-color": "theme_direct_share_color"},
  "LabelStyle-DirectShareBarMessage": {"-ios-text-color": "theme_direct_share_button_color"},
};
const bubbleInsetProperties = {
  "theme_chatroom_bubble_me_01_image.9.png": ["MessageCellStyle-Send", "-ios-title-edgeinsets"],
  "theme_chatroom_bubble_me_02_image.9.png": ["MessageCellStyle-Send", "-ios-group-title-edgeinsets"],
  "theme_chatroom_bubble_you_01_image.9.png": ["MessageCellStyle-Receive", "-ios-title-edgeinsets"],
  "theme_chatroom_bubble_you_02_image.9.png": ["MessageCellStyle-Receive", "-ios-group-title-edgeinsets"],
};
const bubbleStretchProperties = {
  "theme_chatroom_bubble_me_01_image.9.png": ["MessageCellStyle-Send", "-ios-background-image"],
  "theme_chatroom_bubble_me_02_image.9.png": ["MessageCellStyle-Send", "-ios-group-background-image"],
  "theme_chatroom_bubble_you_01_image.9.png": ["MessageCellStyle-Receive", "-ios-background-image"],
  "theme_chatroom_bubble_you_02_image.9.png": ["MessageCellStyle-Receive", "-ios-group-background-image"],
};

// iOS 테마는 CSS 선언이 정본이다. 같은 파일을 여러 슬롯에 재사용하는 테마가 실제로 있어
// 파일명 규약만으로는 어느 Android resource로 갈지 정할 수 없다.
const imagePropertyTargets = {
  "TabBarStyle-Main:-ios-background-image": "theme_maintab_cell_image.9.png",
  "TabBarStyle-Main:-ios-friends-normal-icon-image": "theme_maintab_ico_friends_image.png",
  "TabBarStyle-Main:-ios-friends-selected-icon-image": "theme_maintab_ico_friends_focused_image.png",
  "TabBarStyle-Main:-ios-chats-normal-icon-image": "theme_maintab_ico_chats_image.png",
  "TabBarStyle-Main:-ios-chats-selected-icon-image": "theme_maintab_ico_chats_focused_image.png",
  "TabBarStyle-Main:-ios-now-normal-icon-image": "theme_maintab_ico_now_image.png",
  "TabBarStyle-Main:-ios-now-selected-icon-image": "theme_maintab_ico_now_focused_image.png",
  "TabBarStyle-Main:-ios-shopping-normal-icon-image": "theme_maintab_ico_shopping_image.png",
  "TabBarStyle-Main:-ios-shopping-selected-icon-image": "theme_maintab_ico_shopping_focused_image.png",
  "TabBarStyle-Main:-ios-more-normal-icon-image": "theme_maintab_ico_more_image.png",
  "TabBarStyle-Main:-ios-more-selected-icon-image": "theme_maintab_ico_more_focused_image.png",
  "TabBarStyle-Main:-ios-call-normal-icon-image": "theme_maintab_ico_call_image.png",
  "TabBarStyle-Main:-ios-call-selected-icon-image": "theme_maintab_ico_call_focused_image.png",
  "TabBarStyle-Main:-ios-local-normal-icon-image": "theme_maintab_ico_local_image.png",
  "TabBarStyle-Main:-ios-local-selected-icon-image": "theme_maintab_ico_local_focused_image.png",
  "TabBarStyle-Main:-ios-piccoma-normal-icon-image": "theme_maintab_ico_piccoma_image.png",
  "TabBarStyle-Main:-ios-piccoma-selected-icon-image": "theme_maintab_ico_piccoma_focused_image.png",
  "MainViewStyle-Primary:-ios-background-image": "theme_background_image.png",
  "DefaultProfileStyle:-ios-profile-images": "theme_profile_01_image.png",
  "ButtonStyle-AddFriend:-ios-background-image": "theme_find_add_friend_button_image.png",
  "ButtonStyle-AddFriend:-ios-selected-background-image": "theme_find_add_friend_button_pressed_image.png",
  "BackgroundStyle-ChatRoom:-ios-background-image": "theme_chatroom_background_image.png",
  "BackgroundStyle-Passcode:-ios-background-image": "theme_passcode_background_image.png",
  "MessageCellStyle-Send:-ios-background-image": "theme_chatroom_bubble_me_01_image.9.png",
  "MessageCellStyle-Send:-ios-group-background-image": "theme_chatroom_bubble_me_02_image.9.png",
  "MessageCellStyle-Receive:-ios-background-image": "theme_chatroom_bubble_you_01_image.9.png",
  "MessageCellStyle-Receive:-ios-group-background-image": "theme_chatroom_bubble_you_02_image.9.png",
  "PasscodeStyle:-ios-bullet-first-image": "theme_passcode_01_image.png",
  "PasscodeStyle:-ios-bullet-second-image": "theme_passcode_02_image.png",
  "PasscodeStyle:-ios-bullet-third-image": "theme_passcode_03_image.png",
  "PasscodeStyle:-ios-bullet-fourth-image": "theme_passcode_04_image.png",
  "PasscodeStyle:-ios-bullet-selected-first-image": "theme_passcode_01_checked_image.png",
  "PasscodeStyle:-ios-bullet-selected-second-image": "theme_passcode_02_checked_image.png",
  "PasscodeStyle:-ios-bullet-selected-third-image": "theme_passcode_03_checked_image.png",
  "PasscodeStyle:-ios-bullet-selected-fourth-image": "theme_passcode_04_checked_image.png",
};

// 실물 테마와 공식 가이드의 표기가 갈리는 block 이름을 하나로 모은다.
const blockAliases = {"TabbarStyle-Main": "TabBarStyle-Main", "TabBarStyle": "TabBarStyle-Main", "TabbarStyle": "TabBarStyle-Main"};

function normalizeBlockName(name) {
  return blockAliases[name] || name;
}

function imageKey(name) {
  return name.split("/").pop().replace(/@(2|3|4)x(?=\.)/, "").replace(/\.[^.]+$/, "");
}

function cssColorWithAlpha(value, body, property) {
  const alphaProperty = property.replace(/-color$/, "-alpha");
  const alphaMatch = body.match(new RegExp(`${alphaProperty}\\s*:\\s*([0-9.]+)\\s*;`));
  if (!alphaMatch) return value.toUpperCase();
  const alpha = Math.max(0, Math.min(1, Number.parseFloat(alphaMatch[1])));
  const rgb = value.length === 9 ? value.slice(3) : value.slice(1);
  return `#${Math.round(alpha * 255).toString(16).padStart(2, "0")}${rgb}`.toUpperCase();
}

function parseEdgeInsets(value) {
  const parts = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!parts || parts.length !== 4 || parts.some(item => !Number.isFinite(item) || item < 0)) return null;
  const [top, left, bottom, right] = parts;
  // Keep CSS point precision until the final @Nx bitmap-pixel conversion.
  return [left, top, right, bottom];
}

function parseStretchPoint(value) {
  const parts = value.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s*$/)?.slice(1).map(Number);
  if (!parts || parts.length !== 2 || parts.some(item => !Number.isFinite(item) || item < 0)) return null;
  return parts;
}

function parseTheme(css) {
  const colors = {};
  const edgeInsets = {};
  const stretchPoints = {};
  const imageRefs = {};
  for (const block of css.matchAll(/([\w-]+)\s*\{([\s\S]*?)\}/g)) {
    const blockName = normalizeBlockName(block[1]);
    for (const property of block[2].matchAll(/([-\w]+)\s*:\s*(#[0-9a-fA-F]{6,8})\s*;/g)) {
      // block별 매핑만 본다. 전역 fallback을 두면 매핑에 없는 block의 background-color가
      // 다른 block의 값을 덮어쓴다 — BottomBannerStyle이 배경색을 가로채는 사례가 있었다.
      const target = blockColorTargets[blockName]?.[property[1]];
      if (target) colors[target] = cssColorWithAlpha(property[2], block[2], property[1]);
    }
    for (const property of block[2].matchAll(/(-ios-(?:group-)?title-edgeinsets)\s*:\s*([^;]+);/g)) {
      const value = parseEdgeInsets(property[2]);
      if (value) edgeInsets[`${blockName}:${property[1]}`] = value;
    }
    for (const property of block[2].matchAll(/(-ios-(?:group-)?background-image)\s*:\s*([^;]+);/g)) {
      const value = parseStretchPoint(property[2]);
      if (value) stretchPoints[`${blockName}:${property[1]}`] = value;
    }
    for (const property of block[2].matchAll(/(-ios-[\w-]*image[\w-]*)\s*:\s*(?:'([^']+)'|"([^"]+)"|url\(\s*([^)]+?)\s*\))/g)) {
      imageRefs[`${blockName}:${property[1]}`] = imageKey(property[2] || property[3] || property[4]);
    }
  }
  return {colors, edgeInsets, stretchPoints, imageRefs, name: css.match(/-kakaotalk-theme-name\s*:\s*'([^']*)'/)?.[1]?.trim() || "Converted Theme"};
}

// Android resource 파일명이 어느 테마 이미지에서 오는지 정한다.
// CSS 선언이 먼저이고, 선언이 없으면 파일명 규약으로 채운다.
function imageKeysByTarget(imageRefs = {}) {
  const byTarget = {};
  for (const [slot, key] of Object.entries(imageRefs)) {
    const target = imagePropertyTargets[slot];
    if (target && !(target in byTarget)) byTarget[target] = key;
  }
  for (const [key, target] of Object.entries(imageTargets)) {
    if (!(target in byTarget)) byTarget[target] = key;
  }
  return byTarget;
}

// CSS가 참조하지만 Android template에 대응 resource가 없는 슬롯.
function unsupportedImageSlots(imageRefs = {}) {
  return Object.keys(imageRefs).filter(slot => !imagePropertyTargets[slot]);
}

function sourceScaleForPath(path) {
  return Number(path.match(/@([234])x\./)?.[1] || 1);
}

function densityScaleForPath(path) {
  if (path.includes("xxxhdpi")) return 4;
  if (path.includes("xxhdpi")) return 3;
  if (path.includes("xhdpi")) return 2;
  if (path.includes("hdpi")) return 1.5;
  return 1;
}

function unsupportedImageInputs(images, byTarget) {
  const used = new Set(Object.values(byTarget));
  return Object.keys(images).filter(key => !used.has(key));
}

function canReplaceDensity(path, sourceScale) {
  return densityScaleForPath(path) === sourceScale;
}

function imageSourcesByDensity(images, key, path) {
  const sourceScale = densityScaleForPath(path);
  return images[key]?.[sourceScale] && canReplaceDensity(path, images[key][sourceScale].scale)
    ? images[key][sourceScale]
    : null;
}

function previewImage(images, key) {
  return images[key] || null;
}

export {
  bubbleInsetProperties,
  imageKeysByTarget,
  unsupportedImageSlots,
  bubbleStretchProperties,
  imageKey,
  imageSourcesByDensity,
  imageTargets,
  parseTheme,
  previewImage,
  sourceScaleForPath,
  unsupportedImageInputs,
};
