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
const colorTargets = {
  "background-color": "theme_background_color",
};
const blockColorTargets = {
  "HeaderStyle-Main": {"-ios-text-color": "theme_header_color", "-ios-tab-text-color": "theme_title_color", "-ios-tab-highlighted-text-color": "theme_title_pressed_color"},
  "MainViewStyle-Primary": {"background-color": "theme_background_color", "-ios-text-color": "theme_title_color", "-ios-highlighted-text-color": "theme_title_pressed_color", "-ios-description-text-color": "theme_description_color", "-ios-description-highlighted-text-color": "theme_description_pressed_color", "-ios-paragraph-text-color": "theme_paragraph_color", "-ios-paragraph-highlighted-text-color": "theme_paragraph_pressed_color", "-ios-normal-background-color": "theme_body_cell_color", "-ios-selected-background-color": "theme_body_cell_pressed_color"},
  "MainViewStyle-Secondary": {"background-color": "theme_body_secondary_cell_color"},
  "SectionTitleStyle-Main": {"border-color": "theme_body_cell_border_color", "-ios-text-color": "theme_section_title_color"},
  "FeatureStyle-Primary": {"-ios-text-color": "theme_feature_primary_color"},
  "BackgroundStyle-ChatRoom": {"background-color": "theme_chatroom_background_color"},
  "InputBarStyle-Chat": {"background-color": "theme_chatroom_input_bar_background_color", "-ios-send-normal-background-color": "theme_chatroom_input_bar_send_button_color", "-ios-send-highlighted-background-color": "theme_chatroom_input_bar_send_button_color", "-ios-send-normal-foreground-color": "theme_chatroom_input_bar_send_icon_color", "-ios-send-highlighted-foreground-color": "theme_chatroom_input_bar_send_icon_color", "-ios-button-normal-foreground-color": "theme_chatroom_input_bar_menu_icon_color", "-ios-button-highlighted-foreground-color": "theme_chatroom_input_bar_menu_icon_color", "-ios-button-text-color": "theme_chatroom_input_bar_color", "-ios-button-normal-background-color": "theme_chatroom_input_bar_menu_button_color"},
  "MessageCellStyle-Send": {"-ios-text-color": "theme_chatroom_bubble_me_color", "-ios-selected-text-color": "theme_chatroom_bubble_me_color", "-ios-unread-text-color": "theme_chatroom_unread_count_color"},
  "MessageCellStyle-Receive": {"-ios-text-color": "theme_chatroom_bubble_you_color", "-ios-selected-text-color": "theme_chatroom_bubble_you_color", "-ios-unread-text-color": "theme_chatroom_unread_count_color"},
  "BackgroundStyle-Passcode": {"background-color": "theme_passcode_background_color"},
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
  for (const block of css.matchAll(/([\w-]+)\s*\{([\s\S]*?)\}/g)) {
    const blockName = block[1];
    for (const property of block[2].matchAll(/([-\w]+)\s*:\s*(#[0-9a-fA-F]{6,8})\s*;/g)) {
      const target = blockColorTargets[blockName]?.[property[1]] || colorTargets[property[1]];
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
  }
  return {colors, edgeInsets, stretchPoints, name: css.match(/-kakaotalk-theme-name\s*:\s*'([^']*)'/)?.[1]?.trim() || "Converted Theme"};
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

function unsupportedImageInputs(images) {
  return Object.keys(images).filter(key => !imageTargets[key]);
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
  bubbleStretchProperties,
  imageKey,
  imageSourcesByDensity,
  imageTargets,
  parseTheme,
  previewImage,
  sourceScaleForPath,
  unsupportedImageInputs,
};
