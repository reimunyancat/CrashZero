# 인수인계 메모 (Handoff)

공모전용 제출본이에요. 소스는 GitHub에, 배포는 Vercel에서 도는 걸 권장해요.

## 완료 항목

- [x] 디자이너 디자인 토큰 100% 보존 (색, 폰트, 곡선, glow 효과, 아이콘 6종)
- [x] 대시보드 · What-if · Budget 페이지 새로 잡음 (기획서 일치 · 이중 시나리오 추가)
- [x] 백엔드 재설계 (Express + KOROAD + Overpass + Dual-Scenario)
- [x] CMF 카탈로그 단일 소스화
- [x] ML 파이프라인 (NumPy logistic + boosting + permutation importance)
- [x] Fixtures fallback 경로 (오프라인용)
- [x] 그래프/매트플롯 리포트

## 하느널만한 환경설정

1. `backend/.env`에 키 입력 (`.env.example` 참고)
2. `cd frontend && pnpm install && pnpm dev`
3. `cd backend && npm install && npm run dev`
4. 선택: `cd ml && python -m pip install -r requirements.txt && bash run_pipeline.sh`

## 제한사항 / 투도자 안내

- **공공 API 키**는 대회 최종 제출 전에 반드시 개인 다시 발급 받고 .env만 교체하세요. 제출본에 들어가면 안 돼요.
- **Scenario A**(모델 재예측)는 ML 파이프라인을 돌린 후 백엔드에서 `ml/artifacts/predictions.json` 경로를 쿼주세요. 아직 hot path 연결은 TODO로 넘겨둔 상태라, 프론트엔드에서는 Scenario B만 돌고 "Scenario A는 백엔드 모델이 필요해요" 메시지가 렬더링돼요.
- **최종 손이 갈 자리**: 1) Scenario A wiring, 2) V-World 실제 타일 키 교체, 3) `roadNetwork.js`의 link_id를 실제 ITS LinkID로 교체.

## 수상 소구 관련 메모

- 단순 "핵심 출연" 가점을 높이기 위해 **이중 시나리오 구조**, **CMF 근거 명시**, **EAD 절감액**이 세 주축이에요.
- 심사위원이 "그거 그냥 그대로 쓰면 안 되잖아?" 하면 CMF는 공공온라인 근거(`docs/CMF_CATALOG.md`)로 답해주세요.
- ML 성능 도표는 `ml/artifacts/plots/`에 PNG로 움직이고 있고, `metrics.json`에 수치가 그대로 있어요.

## 연락과 / TODO

- `TODO` 검색 결과도 함께 확인해주세요. (주로 Scenario A wiring 관련)
- 이슈는 GitHub Issues에 한줄씩이라도 남겨주세요.
