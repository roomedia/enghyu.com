// 테마를 적용한 채팅 화면 프리뷰 렌더링.
import {imageKey, parseTheme, previewImage, sourceScaleForPath} from "./theme.js";

const previewDevice = document.getElementById("preview-device");
const previewMetrics = document.getElementById("preview-metrics");
const previewState = {themeBytes: null, messages: []};
let previewRenderToken = 0;
let previewComposing = false;

function drawResizable(canvas, bitmap, width, height, scale, point, mode) {
  // Android preview consumes the original bitmap; the generated .9.png border
  // is metadata-only for layout, so do not shift the visual source by 1px.
  const border = 0;
  const sourceWidth = bitmap.width / scale;
  const sourceHeight = bitmap.height / scale;
  // toNinePatch() adds a 1px transparent border before writing npTc.
  // The border is metadata space, so subtract it when previewing the original bitmap.
  const x0 = mode === "ios" ? point[0] : Math.round(point[0] * scale) / scale;
  const y0 = mode === "ios" ? point[1] : Math.round(point[1] * scale) / scale;
  const x1 = x0 + 1 / scale;
  const y1 = y0 + 1 / scale;
  // x/y stretch divs control the fixed artwork. edgeInsets only controls where
  // text may appear; using it as a visual cap moves the character artwork.
  const targetLeft = x0;
  const targetRight = sourceWidth - x1;
  const targetTop = y0;
  const targetBottom = sourceHeight - y1;
  const stretchSourceWidth = Math.max(1, x1 - x0);
  const stretchSourceHeight = Math.max(1, y1 - y0);
  const stretchTargetWidth = Math.max(1, width - targetLeft - targetRight);
  const stretchTargetHeight = Math.max(1, height - targetTop - targetBottom);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  const patches = [
    [0, 0, x0, y0, 0, 0, targetLeft, targetTop],
    [x0, 0, stretchSourceWidth, y0, targetLeft, 0, stretchTargetWidth, targetTop],
    [x1, 0, sourceWidth - x1, y0, width - targetRight, 0, targetRight, targetTop],
    [0, y0, x0, stretchSourceHeight, 0, targetTop, targetLeft, stretchTargetHeight],
    [x0, y0, stretchSourceWidth, stretchSourceHeight, targetLeft, targetTop, stretchTargetWidth, stretchTargetHeight],
    [x1, y0, sourceWidth - x1, stretchSourceHeight, width - targetRight, targetTop, targetRight, stretchTargetHeight],
    [0, y1, x0, sourceHeight - y1, 0, height - targetBottom, targetLeft, targetBottom],
    [x0, y1, stretchSourceWidth, sourceHeight - y1, targetLeft, height - targetBottom, stretchTargetWidth, targetBottom],
    [x1, y1, sourceWidth - x1, sourceHeight - y1, width - targetRight, height - targetBottom, targetRight, targetBottom],
  ];
  for (const [sx, sy, sw, sh, dx, dy, dw, dh] of patches) {
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) context.drawImage(bitmap, border + sx * scale, border + sy * scale, sw * scale, sh * scale, dx, dy, dw, dh);
  }
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function previewBubbleSize(text, naturalWidth, naturalHeight, insets, maxWidth) {
  const [left, top, right, bottom] = insets;
  const context = document.createElement("canvas").getContext("2d");
  context.font = "16px system-ui";
  const rawLines = text.split("\n");
  const widestLine = Math.max(...rawLines.map(line => context.measureText(line).width), 0);
  const width = Math.min(maxWidth, Math.max(naturalWidth, widestLine + left + right));
  const contentWidth = Math.max(1, width - left - right);
  let visualLines = 0;
  for (const rawLine of rawLines) {
    if (!rawLine) { visualLines += 1; continue; }
    let row = "";
    for (const character of Array.from(rawLine)) {
      // CSS width and Canvas text metrics can differ by a fractional pixel.
      // Keep text that exactly fits the measured content area on one line;
      // Android's rounded dp layout does the same for the generated npTc.
      if (row && context.measureText(row + character).width > contentWidth + 0.5) {
        visualLines += 1;
        row = character;
      } else {
        row += character;
      }
    }
    visualLines += 1;
  }
  return {width, height: Math.max(naturalHeight, visualLines * 24 + top + bottom), visualLines};
}

async function renderPreview(themeBytes, token = previewRenderToken) {
  const zip = await JSZip.loadAsync(themeBytes);
  const cssEntry = zip.files["KakaoTalkTheme.css"];
  if (!cssEntry) return;
  const theme = parseTheme(await cssEntry.async("string"));
  const images = {};
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!path.startsWith("Images/") || entry.dir) continue;
    const key = imageKey(path);
    if (!["mainBgImage", "chatroomBgImage", "chatroomBubbleSend01", "chatroomBubbleSend02", "chatroomBubbleReceive01", "chatroomBubbleReceive02", "maintabIcoChats", "maintabIcoChatsSelected"].includes(key)) continue;
    if (!images[key]) {
      try { images[key] = {bitmap: await createImageBitmap(await entry.async("blob")), scale: sourceScaleForPath(path)}; } catch { /* 프리뷰용 이미지가 아니면 색상 화면으로 계속 표시 */ }
    }
  }
  const messages = previewState.messages.length ? previewState.messages : [{direction: "you", text: "테마가 적용된 채팅 화면입니다."}];
  const maxBubbleWidth = Math.max(170, Math.min(310, previewDevice.clientWidth - 32));
  const background = theme.colors.theme_chatroom_background_color || theme.colors.theme_background_color || "#ffffff";
  const meColor = theme.colors.theme_chatroom_bubble_me_color || "#202124";
  const youColor = theme.colors.theme_chatroom_bubble_you_color || "#202124";
  const bubbleConfigs = (direction, group) => {
    if (direction === "me") {
      return {
        className: "me",
        color: meColor,
        source: previewImage(images, group ? "chatroomBubbleSend02" : "chatroomBubbleSend01"),
        insets: theme.edgeInsets[`MessageCellStyle-Send:${group ? "-ios-group-title-edgeinsets" : "-ios-title-edgeinsets"}`] || [24, 16, 24, 16],
        point: theme.stretchPoints[`MessageCellStyle-Send:${group ? "-ios-group-background-image" : "-ios-background-image"}`] || [1, 1],
      };
    }
    return {
      className: "you",
      color: youColor,
      source: previewImage(images, group ? "chatroomBubbleReceive02" : "chatroomBubbleReceive01"),
      insets: theme.edgeInsets[`MessageCellStyle-Receive:${group ? "-ios-group-title-edgeinsets" : "-ios-title-edgeinsets"}`] || [24, 16, 24, 16],
      point: theme.stretchPoints[`MessageCellStyle-Receive:${group ? "-ios-group-background-image" : "-ios-background-image"}`] || [1, 1],
    };
  };
  const bubbles = messages.map((message, index) => {
    const group = index > 0 && messages[index - 1].direction === message.direction;
    const config = bubbleConfigs(message.direction, group);
    const scale = config.source?.scale || 1;
    const naturalWidth = config.source ? config.source.bitmap.width / scale : message.direction === "me" ? 170 : 150;
    const naturalHeight = config.source ? config.source.bitmap.height / scale : 66;
    const size = previewBubbleSize(message.text, naturalWidth, naturalHeight, config.insets, maxBubbleWidth);
    return {...config, ...message, group, scale, naturalWidth, naturalHeight, ...size};
  });
  const lastBubble = bubbles.at(-1);
  const insetStyle = ([left, top, right], color) => `left:${left}px;top:${top}px;right:${right}px;color:${color}`;
  const bubbleMarkup = bubbles.map((bubble, index) => `<div class="bubble ${bubble.className}${bubble.group ? " group" : ""}" data-message-index="${index}" data-natural-width="${bubble.naturalWidth}" data-natural-height="${bubble.naturalHeight}" style="width:${bubble.width}px;height:${bubble.height}px"><canvas width="${Math.ceil(bubble.width)}" height="${Math.ceil(bubble.height)}"></canvas><span class="bubble-text" style="${insetStyle(bubble.insets, bubble.color)}">${escapeHtml(bubble.text)}</span></div>`).join("");
  if (token !== previewRenderToken) return;
  previewMetrics.textContent = `채팅 · ${bubbles.length}개 메시지 · 마지막 ${lastBubble.visualLines}줄, ${Math.round(lastBubble.width)} × ${Math.round(lastBubble.height)}px`;
  previewDevice.style.setProperty("--preview-bg", theme.colors.theme_chatroom_background_color || "#ffffff");
  previewDevice.innerHTML = `<div class="chat-header"><span>${escapeHtml(theme.name)} 테마</span></div><div class="chat" style="background:${background}"><div class="chat-meta">오늘</div><div class="notice">새로운 메시지가 도착했습니다</div>${bubbleMarkup}</div><div class="input-bar"><label class="sr-only" for="preview-message-input">메시지 입력</label><input id="preview-message-input" class="preview-message-input" type="text" maxlength="120" placeholder="메시지를 입력하세요" autocomplete="off"><button class="preview-send" type="button">전송</button></div><div class="tab-bar"><span>친구</span><strong>채팅</strong><span>더보기</span></div>`;
  if (token !== previewRenderToken) return;
  const chat = previewDevice.querySelector(".chat");
  if (chat) chat.scrollTop = chat.scrollHeight;
  for (const [index, bubble] of bubbles.entries()) {
    if (bubble.source) drawResizable(previewDevice.querySelector(`[data-message-index="${index}"] canvas`), bubble.source.bitmap, bubble.width, bubble.height, bubble.source.scale, bubble.point, "android");
  }
}

async function refreshPreview() {
  if (!previewState.themeBytes) return;
  const token = ++previewRenderToken;
  try {
    await renderPreview(previewState.themeBytes, token);
  } catch (error) {
    if (token === previewRenderToken) previewDevice.innerHTML = `<div class="empty-preview">프리뷰 실패: ${error.message}</div>`;
  }
}

function sendPreviewMessage() {
  const input = document.getElementById("preview-message-input");
  const text = input?.value.trim();
  if (!text || !previewState.themeBytes) return;
  previewState.messages.push({direction: "me", text});
  void refreshPreview().then(() => document.getElementById("preview-message-input")?.focus());
}

document.addEventListener("click", event => {
  if (event.target.closest(".preview-send")) sendPreviewMessage();
});
document.addEventListener("compositionstart", event => {
  if (event.target.matches(".preview-message-input")) previewComposing = true;
});
document.addEventListener("compositionend", event => {
  if (event.target.matches(".preview-message-input")) previewComposing = false;
});
document.addEventListener("keydown", event => {
  if (!event.target.matches(".preview-message-input") || event.key !== "Enter") return;
  if (event.isComposing || event.keyCode === 229 || event.repeat || previewComposing) return;
  event.preventDefault();
  event.stopPropagation();
  sendPreviewMessage();
});

export {previewState, refreshPreview};
