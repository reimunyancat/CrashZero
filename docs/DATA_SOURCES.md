# Data Sources

모든 데이터는 **실제 공개 API**에서 가져와요. 살면서 만든 수치는 없어요.

## 적용 범위

- 서울특별시 영등포구 (siDo=11, guGun=560)
- BBOX: 37.4915, 126.8780 ~ 37.5470, 126.9430

## 1. KOROAD · 도로교통공단 (data.go.kr)

| 항목 | 엔드포인트 | 용도 |
| --- | --- | --- |
| 일반 사고다발구역 | `/B552061/frequentzoneLg/getRestFrequentzoneLg` | 블랙스팟 용 |
| 어린이 사고다발구역 | `/B552061/frequentzoneChild/getRestFrequentzoneChild` | school_zone 가중치 |

황금비 원키: 2022–2024 / siDo=11 / guGun=560. 세부 필드: `spot_nm`, `occrrnc_cnt`,
`caslt_cnt`, `dth_dnv_cnt`, `se_dnv_cnt`, `sl_dnv_cnt`, `lo_crd` (경도), `la_crd` (위도).

## 2. OSM · Overpass API

- Endpoint: `https://overpass-api.de/api/interpreter` (mirror 필요하면 `OVERPASS_URL` 환경변수).
- 쿼리: 영등포구 BBOX, `highway` 14개 클래스.
- 산출: way id + geometry + tags (name, highway).
- ITS LinkID는 송말 5자리 OSM way id를 접두어 `35XXXXX`로 장알 잘해서 만들어요.
  (실제 ITS LinkID로 교체할 때는 `roadNetwork.js`의 `buildSegment`만 수정하면 돼요.)

## 3. 기상청 · 단기예보

- Endpoint: `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`
- 환경변수 `KMA_KEY`.
- 5회차 넘은 양으로 쓰는 건 안 했고, 계절 가중치와 우천 플래그만 쓰세요.

## 4. V-World (선택, 온라인 시 자동)

- 신호교차로 · CCTV · 어린이보호구역 경계 레이어. 온라인 환경에서만 호출.

## 5. Fallback fixtures

- 샌드박스/데모 용도의 fixture가 `frontend/public/fixtures/*.json`에 있어요.
- 레이블에 "데이터 데모 fixture · 실데이터 아님"라고 명시해둔 용도이에요.
- 프론트엔드 `lib/api.ts`는 백엔드가 없을 때만 fixture로 폴백해요.

## 키 관리

- 모든 키는 `backend/.env`와 `ml/` 디렉토리의 환경변수로만 관리하고,
  프론트엔드에 직접 주입하지 않아요 (클라이언트는 자신 백엔드만 봅니다).
- `.env`는 git에 안 올라가고 `.env.example`만 올라가요.
