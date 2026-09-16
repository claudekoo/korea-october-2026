# 콘텐츠 추가 가이드 (Claude 용)

**트리거:** 메시지에 인스타그램 게시물 링크(`instagram.com/p/...`)가 있으면,
"추가해줘" 같은 말이 없어도 이 문서를 읽고 그대로 `data/places.json`에 항목을 추가한다.
**링크 자체가 트리거다.** 매번 설명을 다시 듣지 않는다.
(링크를 주면서 다른 걸 해달라고 한 경우는 예외 — 그때는 시킨 걸 한다.)

---

## 작업 순서

1. 링크를 하나씩 브라우저로 연다 (`mcp__Claude_Browser__navigate` → `get_page_text`).
   로그인 벽에 막히면 캡션만이라도 읽고, 못 읽으면 그 링크를 사용자에게 알린다.
2. 게시물에서 뽑는다: **이름 · 설명 · 기간 · 영업시간 · 주소 · 가격 · 종류**.
   같은 게시물에 장소가 여러 곳이면(예: 전시 + 옆 카페 + 굿즈숍) 각각 따로 만든다.
3. 주소를 좌표로 바꾼다 (Nominatim `https://nominatim.openstreetmap.org/search?q=<주소>&format=json&limit=1`
   또는 아는 좌표). 소수점 4자리면 충분하다.
4. `id`는 영문 kebab-case 슬러그로 만든다 (`seongsu-coffee-popup`). 기존 `id`와 겹치면 뒤에 숫자를 붙인다.
5. 썸네일을 받아 `images/`에 저장한다 (아래 '이미지' 참고).
6. `data/places.json` 배열에 **추가**한다. 기존 항목은 건드리지 않는다.
7. 끝나고 사용자에게 보고한다: 몇 개 추가했는지, **게시물에 없어서 `null`로 둔 필드가 무엇인지**.

### 지어내지 않는다
게시물에 없는 정보는 추측하지 말고 `null`로 두고 보고한다.
특히 영업시간, 종료일, 가격은 틀리면 헛걸음이 된다.

### 주소·좌표는 게시물에 없어도 검색해서 채운다
`address`/`lat`/`lng`만은 예외다. 게시물에 주소가 없으면 바로 `null`로 두지 말고,
장소 이름 + 지역명으로 웹 검색을 한 번 해본다 (예: "황금어장 광안리점 주소").
찾으면 채우고, `description`에 "주소는 게시물에 없어 별도로 검색해 채웠다"처럼 출처를 한 줄 남긴다.

- **지점이 여러 곳이거나 상호가 특정이 안 되면** 그래도 대략적인 위치를 채운다.
  대표 지점(본점 등) 주소를 쓰거나, 그것도 안 되면 동네 중심 좌표(예: 광안리해수욕장)를 쓰고
  `address`에 "정확한 상호 미상" 같은 단서를 붙인다. 완전히 못 찾을 때만 `null`로 남긴다.
- 이 예외는 주소·좌표에만 적용된다. **영업시간·가격·종료일은 여전히 게시물에 없으면 `null`이다** —
  이 정보들은 틀리면 헛걸음으로 이어지지만, 위치는 대략만 맞아도 지도에서 쓸모가 있기 때문.

### 이미지 — 받아서 저장한다
인스타 CDN URL(`scontent*.cdninstagram.com`)을 JSON에 **직접 넣지 않는다.** 며칠이면 만료돼서 전부 깨진다.
받아서 `images/`에 저장하고, 파일명은 **게시물 shortcode**로 한다
(`https://www.instagram.com/p/Dc2sDDsRKPj/` → `images/Dc2sDDsRKPj.jpg`).
한 게시물에서 장소를 여러 개 뽑았다면 같은 파일을 함께 쓰면 된다.

일반 브라우저 UA로 게시물 HTML을 받으면 `og:image`가 없다. **크롤러 UA로 받아야 나온다.**

```python
# python - <<'PY' 로 실행. codes 에 shortcode 를 넣는다.
import re, os, time, urllib.request
CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
codes = ["Dc2sDDsRKPj"]
os.makedirs("images", exist_ok=True)
for code in codes:
    html = urllib.request.urlopen(urllib.request.Request(
        f"https://www.instagram.com/p/{code}/", headers={"User-Agent": CRAWLER}), timeout=30
    ).read().decode("utf-8", "ignore")
    url = re.search(r'property="og:image" content="([^"]+)"', html).group(1).replace("&amp;", "&")
    data = urllib.request.urlopen(urllib.request.Request(
        url, headers={"User-Agent": BROWSER}), timeout=40).read()
    open(f"images/{code}.jpg", "wb").write(data)
    time.sleep(1.5)
```

릴스는 `og:image`가 영상 첫 프레임이라 재생 버튼이 얹혀 보일 수 있다. 정상이다.
받는 데 실패했으면 `"image": null` — 종류별 아이콘 placeholder가 대신 나온다. 깨져 보이지 않는다.

캡션은 이 방법으로 다 못 읽는다(`og:description`은 잘려 있다). 캡션은 브라우저로 읽고,
이미지만 위 스크립트로 받는 게 빠르다.

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
  "image": "images/XXXXXXXXXXX.jpg",
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
| `address` | | 카드에 그대로 표시된다. 게시물에 없으면 검색해서 채운다 ('주소·좌표는 게시물에 없어도 검색해서 채운다' 참고) |
| `lat` / `lng` | | 가능하면 꼭 채운다. `null`이면 목록에만 나오고 지도·거리 필터에서 빠진다 |
| `startDate` | | `YYYY-MM-DD`. 상설이면 `null` |
| `endDate` | | `YYYY-MM-DD`. **`null`이면 상설** — 날짜 필터를 항상 통과한다 |
| `hours` | | 7일 전부 적는다. 그날 쉬면 `null`. 시간 모르면 `hours` 자체를 `null` |
| `hoursNote` | | "라스트오더 30분 전", "월요일 휴무" 같은 단서 |
| `price` | | 자유 문자열. `"무료"`도 좋다 |
| `image` | | `images/<게시물 shortcode>.jpg` 또는 `null` — 받는 법은 위 참고 |
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
