# 콘텐츠 추가 가이드 (Claude 용)

**트리거:** 사용자가 인스타그램 링크를 주면 — "이 링크들 추가해줘" 같은 말이면 —
이 문서를 읽고 `data/places.json`에 항목을 추가한다. 매번 설명을 다시 듣지 않는다.

---

## 작업 순서

1. 링크를 하나씩 브라우저로 연다 (`mcp__Claude_Browser__navigate` → `get_page_text`).
   로그인 벽에 막히면 캡션만이라도 읽고, 못 읽으면 그 링크를 사용자에게 알린다.
2. 게시물에서 뽑는다: **이름 · 설명 · 기간 · 영업시간 · 주소 · 가격 · 종류**.
3. 주소를 좌표로 바꾼다 (Nominatim `https://nominatim.openstreetmap.org/search?q=<주소>&format=json&limit=1`
   또는 아는 좌표). 소수점 4자리면 충분하다.
4. `id`는 영문 kebab-case 슬러그로 만든다 (`seongsu-coffee-popup`). 기존 `id`와 겹치면 뒤에 숫자를 붙인다.
5. `data/places.json` 배열에 **추가**한다. 기존 항목은 건드리지 않는다.
6. 끝나고 사용자에게 보고한다: 몇 개 추가했는지, **게시물에 없어서 `null`로 둔 필드가 무엇인지**.

### 지어내지 않는다
게시물에 없는 정보는 추측하지 말고 `null`로 두고 보고한다.
특히 영업시간, 종료일, 가격은 틀리면 헛걸음이 된다.

### 이미지
인스타 CDN 이미지 URL(`scontent-*.cdninstagram.com`)은 **직접 링크하지 않는다.** 며칠 뒤 만료된다.
- 이미지를 쓰려면 파일을 받아 `images/<id>.jpg`로 저장하고 `"image": "images/<id>.jpg"`로 적는다.
- 아니면 `"image": null` — 종류별 아이콘 placeholder가 대신 나온다. 깨져 보이지 않는다.

---

## 필드 레퍼런스

```json
{
  "id": "seongsu-coffee-popup",
  "name": "성수 커피 팝업",
  "nameEn": "Seongsu Coffee Pop-up",
  "type": "cafe",
  "description": "1–2문장 요약.",
  "city": "서울",
  "area": "성수동",
  "address": "서울 성동구 연무장길 33",
  "lat": 37.5445,
  "lng": 127.0557,
  "startDate": "2026-10-03",
  "endDate": "2026-10-19",
  "hours": {
    "mon": null,
    "tue": ["11:00", "20:00"],
    "wed": ["11:00", "20:00"],
    "thu": ["11:00", "20:00"],
    "fri": ["11:00", "21:00"],
    "sat": ["11:00", "21:00"],
    "sun": ["11:00", "20:00"]
  },
  "hoursNote": "라스트오더 30분 전",
  "price": "입장 무료 / 음료 7,000원",
  "image": null,
  "instagram": "https://www.instagram.com/p/XXXXXXXXXXX/"
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `id` | ✅ | 영문 kebab-case, 중복 금지 |
| `name` | ✅ | 한글 이름 그대로 |
| `nameEn` | | 없으면 `null` |
| `type` | ✅ | `restaurant` / `cafe` / `entertainment` **셋 중 하나만** |
| `description` | ✅ | 1–2문장. 홍보 문구 말고 갈지 말지 판단할 정보 |
| `city` | ✅ | `서울`, `부산` … 도시 필터 칩이 여기서 자동 생성된다 |
| `area` | | 동네 (`성수동`, `해운대`) |
| `address` | ✅ | 카드에 그대로 표시된다 |
| `lat` / `lng` | ✅ | 없으면 지도·거리 필터에서 빠진다 |
| `startDate` | | `YYYY-MM-DD`. 상설이면 `null` |
| `endDate` | | `YYYY-MM-DD`. **`null`이면 상설** — 날짜 필터를 항상 통과한다 |
| `hours` | | 7일 전부 적는다. 그날 쉬면 `null`. 시간 모르면 `hours` 자체를 `null` |
| `hoursNote` | | "라스트오더 30분 전", "월요일 휴무" 같은 단서 |
| `price` | | 자유 문자열. `"무료"`도 좋다 |
| `image` | | `images/<id>.jpg` 또는 `null` |
| `instagram` | ✅ | 출처 게시물 링크 |

### 자동으로 만들어지는 것 — 적지 않는다
구글맵 · 네이버 · 카카오 링크는 `lat`/`lng`/`name`으로 앱이 직접 만든다.
JSON에 넣을 필요 없다.

### 새벽까지 여는 곳
`["17:00", "02:00"]`처럼 종료가 시작보다 이르면 자정을 넘긴 것으로 처리된다. 그대로 적으면 된다.

---

## 붙여넣기용 프롬프트

```
이 링크들 추가해줘:
https://www.instagram.com/p/...
https://www.instagram.com/p/...
```
