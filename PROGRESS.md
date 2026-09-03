# PROGRESS

- H0: 2026-09-03T17:40:50+09:00 시작. 내부 제출 목표 2026-09-04 03:30 KST (H0+16.5h가 03:30을 넘으므로 절대시각 기준으로 진행 — 필요 시 컷 규칙 우선순위: T5 E2E 자동화 → T6 Roadmap → T4 DebugPanel).
- 환경 노트: `vercel`/`gh` CLI 없음 → **사람 작업**: GitHub 공개 레포 생성 + Vercel import 필요. 스캐폴드는 push만 하면 배포되게 구성함.
- 의존성 노트: 템플릿 기본이 React 19 (계획서는 18) — 그대로 사용. @mediapipe/tasks-vision 1.0.1.
- 스킬 노트: 사용자가 요청한 "임펙커블" 디자인 스킬은 이 환경에 미설치 → PLAN §6 사양 + 자체 디자인 원칙으로 진행.
- T0 완료 17:45 KST: 스캐폴드+빌드 green. docs/WEBMCP_API_NOTES.md 작성(웹 조사: document.modelContext 확정, AbortSignal 해제, {content:[...]} 반환, agentInvoked/toolparamdescription 실재). 이슈: vercel CLI 없음 → 사람이 레포+Vercel 연결.
- T1 완료 17:55 KST: PoseSource 추상화, camera/replay 소스, fixtures 6종 생성기, 스켈레톤 오버레이. 브라우저에서 ?replay=squat_10reps_side 재생 확인. 이슈 없음.
