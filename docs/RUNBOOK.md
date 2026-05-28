# Runbook

## 처음 한 번

```bash
# 1) 최초 설치
git clone https://github.com/reimunyancat/CrashZero.git
cd CrashZero

# 2) 프론트엔드
cd frontend
pnpm install   # or npm install
pnpm dev       # http://localhost:3000

# 3) 백엔드 (새 터미널)
cd ../backend
cp .env.example .env
# .env 에 DATA_GO_KR_KEY 와 VWORLD_KEY 채움
npm install
npm run dev    # http://localhost:4000

# 4) ML 파이프라인 (선택)
cd ../ml
python -m pip install -r requirements.txt
bash run_pipeline.sh
```

## 일상 모드

| 목적 | 명령 |
| --- | --- |
| 프론트엔드 개발서버 | `cd frontend && pnpm dev` |
| 프론트엔드 빌드 | `cd frontend && pnpm build && pnpm start` |
| 백엔드 개발서버 | `cd backend && npm run dev` |
| 백엔드 smoke 테스트 | `cd backend && npm run smoke` |
| ML 파이프라인 | `cd ml && bash run_pipeline.sh` |
| 캐시 강제 갱신 | `curl -X POST http://localhost:4000/admin/refresh` |

## 오프라인 모드

- `backend/.env`에 `USE_FIXTURES=true`를 설정하면 fixture만 쓰고 외부 API 호출 안 해요.
- ML 파이프라인도 같은 환경변수를 읽어서 fixture로 돌아가요.
- 대외 시연 필요한 경우 언제든 재현 가능.

## 자주 마주치는 이슈

- **Overpass 429**: rate limit. `OVERPASS_URL`을 mirror로 전환하거나 30초 대기.
- **KOROAD 401/403**: `DATA_GO_KR_KEY` 오타/만료. data.go.kr에서 재생성.
- **MapLibre style not loading**: `frontend/lib/api.ts`의 V-World tile URL 키 교체 필요.
- **계산된 구간이 고어있을 때**: `/admin/refresh`로 캐시 플러시 후 재로드.

## 배포

- 프론트엔드는 Vercel 추천 (Next.js standalone build).
- 백엔드는 Fly.io / Render / EC2 어디든 OK. Node 18+ 요구.
- ML 파이프라인은 GitHub Actions 주간 워크플로우로 돌릴 수 있어요.
