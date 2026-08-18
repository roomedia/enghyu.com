// 채팅 외 화면의 정적 목업. 매핑된 색과 이미지가 실제로 어디에 쓰이는지 보여 준다.
// 상호작용은 탭 전환뿐이고 채팅처럼 입력을 받지 않는다.

// 내부 색 형식은 Android `#AARRGGBB`다. CSS는 `#RRGGBBAA`로 읽으므로 그대로 넣으면
// alpha와 red가 뒤바뀐다. `#FF000000`이 투명한 빨강이 되는 식이다.
function cssColor(value) {
  return value && value.length === 9 ? `#${value.slice(3)}${value.slice(1, 3)}` : value;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function backgroundStyle(color, source) {
  const layers = [];
  if (source) layers.push(`background-image:url(${source.url});background-size:cover;background-position:center`);
  if (color) layers.push(`background-color:${color}`);
  return layers.join(";");
}

const tabs = [
  {id: "friends", label: "친구", icon: "maintabIcoFriends"},
  {id: "chats", label: "채팅", icon: "maintabIcoChats"},
  {id: "more", label: "더보기", icon: "maintabIcoMore"},
];

function tabBarMarkup(theme, images, active, dark) {
  const background = dark ? "" : cssColor(theme.colors.theme_maintab_cell_color);
  const items = tabs.map(tab => {
    const source = images[active === tab.id ? `${tab.icon}Selected` : tab.icon] || images[tab.icon];
    const icon = source ? `<img class="tab-icon" src="${source.url}" alt="">` : "";
    const color = dark ? "" : (active === tab.id ? cssColor(theme.colors.theme_title_color) : cssColor(theme.colors.theme_description_color));
    return `<button type="button" class="tab${active === tab.id ? " is-active" : ""}" data-screen="${tab.id}"${color ? ` style="color:${color}"` : ""}>${icon}<span>${tab.label}</span></button>`;
  }).join("");
  return `<div class="tab-bar"${background ? ` style="background:${background}"` : ""}>${items}</div>`;
}

// 다크모드는 카카오톡 chrome만 어둡게 한다. 테마가 준 색·이미지는 그대로 두고
// 같은 테마가 어두운 배경에서 어떻게 보이는지 확인하는 용도다.
function darkToggleMarkup(dark) {
  const icon = dark
    ? `<svg class="mode-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.1"/><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"/></g></svg>`
    : `<svg class="mode-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.4 10.6A5.9 5.9 0 0 1 5.4 2.6a5.7 5.7 0 1 0 8 8Z"/></svg>`;
  const label = dark ? "라이트 모드로 전환" : "다크 모드로 전환";
  return `<button type="button" class="mode-toggle" data-preview-mode aria-pressed="${dark}" aria-label="${label}" title="${label}">${icon}</button>`;
}

function headerMarkup(theme, title, dark, className = "screen-header") {
  const background = cssColor(theme.colors.theme_header_cell_color);
  const color = cssColor(theme.colors.theme_header_color);
  // 다크모드에서는 테마 chrome 색을 걷어내고 어두운 표면을 쓴다.
  const style = dark ? "" : `${background ? `background:${background};` : ""}${color ? `color:${color}` : ""}`;
  return `<div class="${className}" style="${style}"><span>${escapeHtml(title)}</span>${darkToggleMarkup(dark)}</div>`;
}

// 누가 봐도 예시임을 알 수 있는 이름만 쓴다. 이 프로젝트가 다루는 개념에서 따왔다.
const friends = [
  {name: "내 프로필", status: "테마를 적용했어요"},
  {name: "김테마", status: "다크모드 켜봤어요"},
  {name: "이픽셀", status: ""},
  {name: "박알파", status: "투명도 0.09"},
];

function friendsScreen(theme, images, dark) {
  const titleColor = cssColor(theme.colors.theme_title_color) || "#202124";
  const descriptionColor = cssColor(theme.colors.theme_description_color) || "#69707d";
  const borderColor = cssColor(theme.colors.theme_body_cell_border_color) || "rgb(0 0 0 / 0.08)";
  const sectionColor = cssColor(theme.colors.theme_section_title_color) || descriptionColor;
  const avatar = images.profileImg01;
  const rows = friends.map(friend => `
    <div class="list-row" style="border-color:${borderColor}">
      ${avatar ? `<img class="avatar" src="${avatar.url}" alt="">` : `<span class="avatar avatar-empty"></span>`}
      <span class="list-text">
        <strong style="color:${titleColor}">${escapeHtml(friend.name)}</strong>
        ${friend.status ? `<small style="color:${descriptionColor}">${escapeHtml(friend.status)}</small>` : ""}
      </span>
    </div>`).join("");
  return `
    ${headerMarkup(theme, "친구", dark)}
    <div class="screen-body" style="${backgroundStyle(cssColor(theme.colors.theme_background_color), images.mainBgImage)}">
      <div class="section-title" style="color:${sectionColor};border-color:${borderColor}">친구 ${friends.length}</div>
      ${rows}
    </div>`;
}

const moreItems = ["프로필", "설정", "테마", "알림"];

function moreScreen(theme, images, dark) {
  const titleColor = cssColor(theme.colors.theme_title_color) || "#202124";
  const descriptionColor = cssColor(theme.colors.theme_description_color) || "#69707d";
  const borderColor = cssColor(theme.colors.theme_body_cell_border_color) || "rgb(0 0 0 / 0.08)";
  const cellColor = cssColor(theme.colors.theme_body_cell_color);
  const grid = moreItems.map(item => `<span class="more-cell"${cellColor ? ` style="background:${cellColor}"` : ""}><small style="color:${descriptionColor}">${escapeHtml(item)}</small></span>`).join("");
  return `
    ${headerMarkup(theme, "더보기", dark)}
    <div class="screen-body" style="${backgroundStyle(cssColor(theme.colors.theme_background_color), images.mainBgImage)}">
      <div class="section-title" style="color:${cssColor(theme.colors.theme_section_title_color) || descriptionColor};border-color:${borderColor}">전체 서비스</div>
      <div class="more-grid">${grid}</div>
      <button type="button" class="list-row list-link" data-screen="passcode" style="border-color:${borderColor}">
        <span class="list-text"><strong style="color:${titleColor}">잠금화면</strong><small style="color:${descriptionColor}">비밀번호 화면 미리보기</small></span>
      </button>
    </div>`;
}

const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

function passcodeScreen(theme, images, dark) {
  const titleColor = cssColor(theme.colors.theme_passcode_color) || "#202124";
  const keypadBackground = cssColor(theme.colors.theme_passcode_keypad_background_color);
  const keypadColor = cssColor(theme.colors.theme_passcode_keypad_color) || titleColor;
  // 앞 두 자리는 입력된 상태로 보여 준다. checked 이미지가 실제로 쓰이는 자리다.
  const bullets = [1, 2, 3, 4].map(index => {
    const key = `passcodeImgCode0${index}${index <= 2 ? "Selected" : ""}`;
    const source = images[key] || images[`passcodeImgCode0${index}`];
    return source ? `<img class="bullet" src="${source.url}" alt="">` : `<span class="bullet bullet-empty" style="border-color:${titleColor}${index <= 2 ? `;background:${titleColor}` : ""}"></span>`;
  }).join("");
  const keys = keypadKeys.map(key => `<span class="keypad-key" style="color:${keypadColor}">${key}</span>`).join("");
  return `
    <div class="screen-body passcode" style="${backgroundStyle(cssColor(theme.colors.theme_passcode_background_color), images.passcodeBgImage)}">
      <button type="button" class="passcode-back" data-screen="more" style="color:${titleColor}">← 더보기</button>
      <div class="passcode-title" style="color:${titleColor}">비밀번호를 입력하세요</div>
      <div class="bullets">${bullets}</div>
      <div class="keypad"${keypadBackground ? ` style="background:${keypadBackground}"` : ""}>${keys}</div>
    </div>`;
}

const screens = {friends: friendsScreen, more: moreScreen, passcode: passcodeScreen};

// 잠금화면은 탭이 아니라 더보기 안에서 들어간다. 탭바를 왜곡하지 않으려는 선택이다.
function screenMarkup(name, theme, images, dark) {
  const body = screens[name](theme, images, dark);
  return name === "passcode" ? body : `${body}${tabBarMarkup(theme, images, name, dark)}`;
}

export {cssColor, escapeHtml, headerMarkup, screenMarkup, tabBarMarkup};
