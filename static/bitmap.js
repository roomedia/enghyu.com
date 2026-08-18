// Canvas로 픽셀을 다루는 helper. 변환 양방향이 함께 쓴다.

function drawToCanvas(bitmap, width, height, offsetX = 0, offsetY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, offsetX, offsetY);
  return canvas;
}

// 눌림 상태 이미지는 단색 채움이 관례다. iOS는 이미지로, Android는 색으로 같은 것을
// 표현하므로 가운데 픽셀을 읽어 색으로 건넨다.
async function sampleFillColor(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  context.drawImage(bitmap, Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1, 0, 0, 1, 1);
  bitmap.close();
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  return `#${[alpha, red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// 정방향이 붙인 1px 투명 테두리를 걷어내 원본 비트맵을 복원한다.
async function cropNinePatchBorder(bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes], {type: "image/png"}));
  const canvas = drawToCanvas(bitmap, bitmap.width - 2, bitmap.height - 2, -1, -1);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export {cropNinePatchBorder, sampleFillColor};
