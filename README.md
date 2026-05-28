# CrashZero

영등포구 도로 교통사고 **위험 예측 → 개선책 시뮬레이션 → 예산 배분**

공공 데이터(공공데이터포털 KOROAD, V-World, KMA, OSM)와 자체 학습 위험도 모델을 결합해, 도로 단위 위험도를 예측하고 CMF(Crash Modification Factor) 기반 개선책의 효과·예산을 비교합니다.

## 구성

| 디렉토리 | 역할 |
| --- | --- |
| `frontend/` | Next.js 14 (App Router) · MapLibre · Tailwind. 지도·What-if·예산 화면 |
| `backend/` | Node.js (zero-deps 외부 SDK). KOROAD/V-World/OSM 게이트웨이 + Dual-Scenario 엔진 |
| `ml/` | numpy 기반 위험도 모델 학습·설명·아티팩트 export 파이프라인 |
| `data/` | `raw/` (원본, gitignored) · `processed/` (학습 입력) · `fixtures/` (데모용 동결 데이터) |
| `docs/` | 아키텍처, 데이터 출처, CMF 카탈로그, 운영 가이드 |
| `scripts/` | 유틸리티 (아이콘 디코드 등) |

## 빠른 시작

```bash
# 1) 환경 변수
cp .env.example .env
# data.go.kr / V-World / KMA 키를 채워주세요

# 2) 백엔드 (포트 4000)
cd backend
npm install
npm run dev

# 3) 프론트엔드 (포트 3000)  ※ 새 터미널
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## 데모 모드 (외부 API 없이 실행)

외부 API 키가 없거나 네트워크가 불가한 경우 fixture를 사용해 UI/UX 그대로 미리보기 가능합니다.

```bash
echo 'NEXT_PUBLIC_USE_FIXTURE=true' >> frontend/.env.local
cd frontend && npm run dev
```

## 학습 파이프라인 (선택)

```bash
cd ml
uv venv && source .venv/bin/activate     # 또는 python -m venv .venv
uv pip install -r requirements.txt
python src/01_fetch_data.py
python src/02_build_features.py
python src/03_train_model.py
python src/04_explain.py
python src/05_export_artifacts.py
```

생성된 아티팩트(`ml/artifacts/*.json`)는 `frontend/public/artifacts/`로 복사해 사용됩니다.

## 라이선스

MIT — `LICENSE` 참고. 외부 데이터셋·아이콘 라이선스는 `docs/DATA_SOURCES.md`에서 별도 명시.
