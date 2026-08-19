// 앱이 어느 경로에 마운트됐는지 알아낸다. 프로덕션은 `/ktheme/`, e2e 로컬 서버와
// 옛 workers.dev 는 `/` 다.
//
// 문서 경로(`location.pathname`)로 계산하지 않는다. 같은 페이지가 `/ktheme/`,
// `/ktheme`, `/ktheme/index.html` 로 다 들어올 수 있어서 슬래시 하나에 결과가 갈린다.
// 모듈 자신의 URL은 항상 `<마운트>/static/base-path.js` 라 흔들리지 않는다.
const basePath = new URL("../", import.meta.url).pathname;

export {basePath};
