// 변환 동작을 고치면 이 값을 올린다. 캐시 키가 이 값을 섞어 해시하므로 판을 올리면
// 예전 산출물이 돌아오지 않는다.
//
// 브라우저와 Worker 가 같은 값을 봐야 한다. 브라우저는 캐시 키를 만들 때 쓰고 Worker 는
// 올라온 본문이 정말 그 key 의 입력인지 되계산할 때 쓴다. 두 곳에 따로 적어 두면 한쪽만
// 올라간 순간 공용 캐시 저장이 조용히 전부 거절된다.
const converterVersion = "2026-08-18.1";

// 판을 올려도 직전 판으로 만든 산출물이 잠깐 더 올라온다. 그 사이 저장이 막히지 않게
// 최근 판을 함께 받는다. 오래된 판은 여기서 빼면 그때부터 거절된다.
const acceptedConverterVersions = [converterVersion];

export {acceptedConverterVersions, converterVersion};
