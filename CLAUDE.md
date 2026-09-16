# korea-october-2026

2026년 10월 한국 여행에서 갈 곳을 모아 보는 정적 웹앱. 빌드 없음, GitHub Pages로 배포.
`index.html` + `styles.css` + `app.js` + `data/places.json` 이 전부다.

## 인스타 링크를 받으면 (자동 트리거)

메시지에 인스타그램 게시물 링크(`instagram.com/p/...`)가 하나라도 있으면,
**다른 지시가 없어도 먼저 [CONTENT_GUIDE.md](CONTENT_GUIDE.md)를 읽고 그 절차대로**
게시물을 열어 내용을 뽑고, 썸네일을 받고, `data/places.json`에 장소를 추가한다.
"추가해줘" 같은 말을 기다리지 않는다 — 링크 자체가 트리거다.

예외: 링크를 주면서 명백히 다른 일을 시킨 경우(예: "이 링크 열어서 캡션만 보여줘")는 시킨 것만 한다.

핵심 규칙 세 가지만 여기 옮겨둔다. 나머지는 CONTENT_GUIDE.md에 있다.
- 게시물에 없는 정보는 **지어내지 않는다.** `null`로 두고 끝나고 보고한다.
- 인스타 CDN 이미지 URL은 만료되니 **직접 링크하지 말고 받아서** `images/<shortcode>.jpg`로 저장한다.
- `type`은 `restaurant` / `cafe` / `entertainment` 셋 중 하나뿐이다.

## 코드 고칠 때

- 프레임워크·빌드 도구·npm 의존성을 새로 들이지 않는다. 외부 의존성은 CDN Leaflet 하나로 끝.
- 로직은 `app.js` 한 파일에 평범한 함수로. 클래스·추상화 금지.
- 모바일(<768px)은 바텀 시트, 데스크톱(≥768px)은 사이드바. 둘 다 보고 고친다.
- 로컬 확인: `python -m http.server 8000` (`file://`로는 `fetch`가 막힌다).
