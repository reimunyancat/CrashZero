# CMF Catalog

개선안 카탈로그는 `backend/data/cmf_catalog.json`에 단일 소스로 존재하고,
프론트엔드는 `/cmf-catalog` 엔드포인트로 가져가요.

## 출처

- **FHWA CMF Clearinghouse** (Federal Highway Administration).
- **도로교통공단 국내 적용사례** (2022–2023 시범사업 보고서).

## 공식

여러 개선을 동시에 적용할 때는 HSM 권고치대로 **곱셈 결합**과 **상한 62%**를 가해요.

```
total_reduction = min(0.62, 1 - ∏(1 - r_i))
```

이렇게 해야 가렴 "모든 세이프티 장치 다 깔아놓으면 사고가 0이 되겠지?" 같은
말이 안 나와요.

## 카탈로그

| ID | 이름 | CMF 범위 | 단가 (억원) | 주요 근거 |
| --- | --- | --- | --- | --- |
| `traffic_signal` | 신호교차로 설치/개선 | 0.08–0.22 | 0.55 | FHWA CMF #4051 |
| `crosswalk` | 횝단보도 강화 | 0.05–0.16 | 0.28 | FHWA CMF #5042 |
| `median_barrier` | 중앙분리대 | 0.12–0.31 | 0.72 | FHWA CMF #314 |
| `speed_bump` | 과속방지턱·속도저감 | 0.04–0.14 | 0.18 | FHWA CMF #2492 |
| `school_zone` | 어린이보호구역 강화 | 0.10–0.28 | 0.65 | KOROAD 2023 + FHWA CMF #2783 |

## 수정 절차

1. `backend/data/cmf_catalog.json` 업데이트.
2. 백엔드 재시작 또는 `POST /admin/refresh`.
3. 프론트엔드는 자동으로 새 카탈로그를 가져와요.

## 근거 링크

- FHWA CMF Clearinghouse: <https://www.cmfclearinghouse.org/>
- KOROAD 교통안전공단 시범사업 보고서 · 교통과학연구장
- AASHTO Highway Safety Manual (HSM) 1st Edition
