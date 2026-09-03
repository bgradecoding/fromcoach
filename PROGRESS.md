# PROGRESS

- H0: 2026-09-03T17:40:50+09:00 시작. 내부 제출 목표 2026-09-04 03:30 KST (H0+16.5h가 03:30을 넘으므로 절대시각 기준으로 진행 — 필요 시 컷 규칙 우선순위: T5 E2E 자동화 → T6 Roadmap → T4 DebugPanel).
- 환경 노트: `vercel`/`gh` CLI 없음 → **사람 작업**: GitHub 공개 레포 생성 + Vercel import 필요. 스캐폴드는 push만 하면 배포되게 구성함.
- 의존성 노트: 템플릿 기본이 React 19 (계획서는 18) — 그대로 사용. @mediapipe/tasks-vision 1.0.1.
- 스킬 노트: 사용자가 요청한 "임펙커블" 디자인 스킬은 이 환경에 미설치 → PLAN §6 사양 + 자체 디자인 원칙으로 진행.
- T0 완료 17:45 KST: 스캐폴드+빌드 green. docs/WEBMCP_API_NOTES.md 작성(웹 조사: document.modelContext 확정, AbortSignal 해제, {content:[...]} 반환, agentInvoked/toolparamdescription 실재). 이슈: vercel CLI 없음 → 사람이 레포+Vercel 연결.
- T1 완료 17:55 KST: PoseSource 추상화, camera/replay 소스, fixtures 6종 생성기, 스켈레톤 오버레이. 브라우저에서 ?replay=squat_10reps_side 재생 확인. 이슈 없음.
- T2 완료 18:00 KST: angles/view/repCounter/rules/gestures/ExerciseTracker + 단위테스트 21개 통과. 변경점: (1) knee_valgus를 부호 기반(무릎이 발목보다 중앙선 쪽 0.03+)으로 정의 — 정면 fixture에서 2D 각도가 유지되도록 굽힘 방향 반전 방식 채택. (2) arms_crossed는 손목 좌우 순서가 어깨 순서와 반전됐는지로 판정(거울/비거울 좌표 모두 안전).
- T3 완료 18:10 KST: machine(순수 리듀서)+store(타이머/엔진/TTS/localStorage)+adapter/tools/phaseTools/log/PlanForm. 단위테스트 40개 통과. 브라우저 브리지로 5.7 DoD 전부 검증(idle 툴 4개, 단계 전환, applied/rejected/timeout, endSession 요약). 수정: 숨김 탭 타이머 스로틀 대응으로 replay를 경과시간 캐치업 방식으로 변경.
- T4 완료 18:20 KST: UI 전체 조립(SessionCard/PlanCard/PlanForm/AgentLog/ProposalOverlay/DebugPanel/CameraView 큐·각도라벨·카운트다운) + styles.css 디자인 시스템. 브라우저 시각 검증: idle/countdown/set(밸거스 칩)/오버레이/요약/디버그패널 전부 확인. 폼 클릭 제출 → createdBy=user 확인.
