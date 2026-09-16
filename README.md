# 한국 2026년 10월 — 가볼 곳

인스타에서 모은 팝업 · 카페 · 음식점 · 놀거리를 목록과 지도로 보는 정적 웹앱.
빌드 없음, 의존성은 CDN의 Leaflet 하나뿐.

## 기능

- **필터** — 종류(음식점·카페·놀거리), 날짜 구간, 도시, 기준점 반경. 모두 AND로 합쳐진다.
- **날짜** — 구간이 겹치면 나온다. `endDate`가 없는 상설 장소는 항상 통과.
- **거리** — `내 위치` 또는 지도에서 기준점을 찍고 반경(0.5–20km)을 고르면, 가까운 순으로 정렬된다.
- **지도** — 목록 카드를 누르면 핀으로, 핀을 누르면 카드로 간다.
- **모바일** — 지도 위에 올라오는 바텀 시트. 손잡이를 끌면 3단계(살짝/반/전체)로 붙는다. 탭하면 순환.
- **데스크톱** — 왼쪽 사이드바(필터 + 목록) + 오른쪽 지도.
- 각 장소마다 인스타 원본, 구글맵 · 네이버 · 카카오 길찾기 링크가 자동으로 붙는다.

## 파일

```
index.html          마크업
styles.css          스타일 (모바일 우선)
app.js              로직 전부
data/places.json    장소 데이터 — 평소에 고치는 건 여기뿐
images/             게시물 썸네일 (파일명 = 인스타 shortcode)
CONTENT_GUIDE.md    인스타 링크로 데이터 채우는 규칙
CLAUDE.md           Claude가 링크만 보고도 알아서 움직이게 하는 트리거
```

## 로컬에서 보기

`file://`로 열면 `fetch`가 막혀서 데이터가 안 뜬다. 간단한 서버를 띄운다.

```bash
python -m http.server 8000
```

그리고 http://localhost:8000 을 연다.

## 장소 추가

Claude에게 인스타 링크만 던지면 된다. "추가해줘"라고 안 해도 알아서 한다
(`CLAUDE.md`가 트리거, `CONTENT_GUIDE.md`가 절차):

```
https://www.instagram.com/p/...
https://www.instagram.com/p/...
```

규칙은 [CONTENT_GUIDE.md](CONTENT_GUIDE.md)에 있다. 직접 넣고 싶으면 그 문서의 필드 표를 보고
`data/places.json` 배열에 객체 하나를 더하면 된다.

## GitHub Pages 배포

1. 이 저장소를 GitHub에 올린다.
2. Settings → Pages → Source: **Deploy from a branch**, Branch: `main` / `(root)`.
3. 몇 분 뒤 `https://<사용자명>.github.io/<저장소명>/` 에서 열린다.

빌드 단계가 없어서 푸시하면 그게 곧 배포다. 장소를 추가하면 `data/places.json`만 커밋하면 된다.
