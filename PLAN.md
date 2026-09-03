# FormCoach — WebMCP Challenge 19시간 작업 계획서

> 이 문서는 Claude Code가 **다른 컨텍스트 없이** 읽고 그대로 실행하도록 쓴 계획서다.
> 사람(팀장)은 병렬로 "사람 작업" 절의 일을 한다. 판단이 필요한 지점은 모두 "결정 기본값" 절에 미리 적어 두었으니 묻지 말고 그 값으로 진행한다.

- 제출 대상: OpenAI **The WebMCP Challenge** (Devpost: https://webmcp.devpost.com)
- 마감: **2026-09-03 13:00 PDT = 2026-09-04 05:00 KST**
- 내부 제출 목표: **2026-09-04 03:30 KST** (버퍼 1.5시간). 이 시각에 무엇이 남아 있든 제출한다.
- 심사 기준: WebMCP Leverage(비자명한 실제 구현), Execution(완결된 제품 경험), Potential Impact(실제 문제·실제 대상)
- 제출물: 프로젝트 설명, 라이브 앱 URL, 공개 코드 저장소(오픈소스), 3분 데모 영상

---

## 0. 실행 규칙 (Claude Code 필독)

1. **순서대로** 태스크를 수행한다. 각 태스크에는 시간 박스와 완료 조건(DoD)이 있다. 시간 박스를 넘기면 그 태스크의 "축소 규칙"을 즉시 적용하고 다음으로 간다. 완벽보다 완결.
2. 태스크 하나가 끝날 때마다 **커밋**한다. 메시지 형식: `feat(pose): rep counter for squat with fixtures`. 그리고 `PROGRESS.md`에 태스크 번호·완료 시각·남은 이슈를 한 줄씩 추가한다. 사람이 이 파일만 보고 진행 상황을 파악한다.
3. **배포는 1시간 안에 먼저** 한다. Hello world라도 라이브 URL이 있어야 한다. 이후 모든 커밋은 자동 배포된다.
4. 카메라, ChatGPT 인앱 브라우저, Chrome 확장은 Claude Code가 검증할 수 없다. **fixtures(녹화된 랜드마크 시퀀스)와 디버그 브리지로 검증**하도록 설계되어 있다. 실기기 검증은 사람이 한다.
5. WebMCP API 표면은 origin trial 중이라 이름이 흔들린다(`document.modelContext` / `navigator.modelContext`). 브라우저 API를 직접 호출하는 코드는 **`src/webmcp/adapter.ts` 한 파일**에만 둔다. 다른 코드는 어댑터만 쓴다.
6. 아래 "하지 않을 것" 목록에 있는 기능은 요청받지 않는 한 만들지 않는다. README의 Roadmap 절에만 적는다.
7. 외부 라이브러리는 아래 의존성 목록에 있는 것만 쓴다. 추가가 필요하면 `PROGRESS.md`에 이유를 적고 추가한다.
8. UI 문구, README, 코드 주석은 **영어**로 쓴다(심사위원이 글로벌). 이 계획서만 한국어다.

### 하지 않을 것 (스코프 컷)
- 브라우저 확장 프로그램
- 트래커/코치 플랫폼 등 두 번째 사이트, 크로스 사이트 툴
- 사용자 계정, 로그인, 백엔드, DB (상태는 메모리 + localStorage)
- VLM/LLM 호출 (사이트 안에는 AI 모델이 MediaPipe Pose 하나뿐이다. 판단은 에이전트가 툴을 통해 한다)
- 3종 이상의 운동, 커스텀 제스처 모델 학습
- 재활/물리치료 버티컬, 스펙 DSL 일반화
- 모바일 최적화 (데스크톱 Chrome 기준. 깨지지만 않으면 된다)

---

## 1. 제품 한 줄 정의와 심사 기준 매핑

**FormCoach**: 웹캠 앞에서 운동하면 페이지가 MediaPipe로 렙과 폼을 실시간으로 측정하고, 그 측정값과 프로그램 조작을 **WebMCP 툴**로 노출해서, 브라우저 에이전트(ChatGPT 인앱 브라우저 등)가 **영상을 보지 않고도** 코치 역할을 하게 만드는 사이트. 사용자는 손이 바쁘고 땀에 젖어 있으므로 에이전트의 제안을 **몸 제스처(양손 들기)로 승인**한다.

| 심사 기준 | 우리가 보여줄 것 |
|---|---|
| WebMCP Leverage | 명령형 툴 7개 + 선언형 폼 1개, 단계별 동적 등록/해제, `readOnlyHint` 구분, 에이전트 제출 감지(`agentInvoked`), 실시간 센서 값을 툴로 노출 |
| Execution | 플랜 생성 → 세트 → 휴식 → 조정 → 요약까지 끊김 없는 한 세션, 라이브 URL, 테스트, README |
| Potential Impact | 홈트 중 폼 교정은 실제 부상 문제. 영상이 탭 밖으로 나가지 않는 프라이버시 구조. 어떤 에이전트든 코치가 될 수 있는 개방성 |

**WebMCP가 아니면 성립하지 않는 이유(README와 영상에 반드시 넣을 문장):**
카메라 스트림은 브라우저 탭 안에만 존재한다. 서버 MCP로 같은 걸 하려면 영상을 서버로 보내야 한다. WebMCP는 탭 안에서 계산된 관절 각도·렙·폼 경고만을 툴 결과로 넘기므로 에이전트는 사용자의 몸 상태를 알되 영상은 한 프레임도 보지 않는다.

---

## 2. 제품 사양

### 2.1 사용자 여정 (데모 영상의 뼈대)
1. 사이트를 연다. 카메라 권한을 허용한다. 화면에 스켈레톤 오버레이와 "Stand so your whole body is visible" 안내가 뜬다.
2. 에이전트에게 "Create a 3x12 squat plan, 90s rest, note that my left knee is sensitive"라고 말하면 에이전트가 선언형 폼 툴 `createPlan`을 호출한다. 플랜 카드에 "Created by agent" 배지가 붙는다.
3. "Start the first set" → `startSet`. 3초 카운트다운 후 세트 시작. 사용자가 스쿼트를 한다. 화면의 렙 카운터가 올라간다. 무릎이 안쪽으로 모이면 "Knees out" 큐가 뜬다.
4. "How is my form?" → 에이전트가 `getLiveMetrics`를 호출해 "6 reps, 3 knee-valgus flags"를 읽고 말로 알려준다.
5. 에이전트가 `adjustProgram({action:"swap_exercise", exercise:"goblet_squat", reason:"..."})`를 호출한다. 화면에 제안 카드가 뜬다. 사용자가 **양손을 머리 위로 1초** 들면 적용된다. 툴 목록이 바뀐다(다음 세트가 goblet_squat).
6. 세트가 끝나면 휴식 타이머. 사용자가 한 손을 들면 휴식을 건너뛴다. 에이전트가 `setRest`로 휴식을 조정할 수도 있다.
7. "End the session and summarize" → `endSession`. 요약(총 렙, 세트, 경고 횟수, 추천)이 화면과 툴 결과로 나온다.

### 2.2 화면 구성 (단일 페이지)
- 좌측 큰 영역: 비디오 + 스켈레톤 캔버스 오버레이, 상단에 view 안내("Front view detected" / "Turn sideways for depth check"), 하단에 현재 큐(폼 경고 텍스트, 1.5초 유지)
- 우측 상단: 세션 상태 카드 — 단계(Idle/Countdown/Set/Rest/Done), 운동명, 세트 n/N, 렙 n/target, 휴식 타이머
- 우측 중단: 플랜 카드(블록 목록) + "Created by agent" 배지 + 플랜 생성 폼(선언형 툴)
- 우측 하단: **Agent log** — 모든 툴 호출을 시간·툴명·요약 인자·결과 상태로 기록. 영상에서 인간-에이전트 협업을 보여주는 핵심 UI
- 오버레이: 제안 카드(adjustProgram 대기 중) — "Agent suggests: switch to goblet squat. Raise both hands to accept, cross arms to decline." + 진행 바
- `?debug=1`: 디버그 패널 — 툴 목록, JSON 인자로 툴 호출, fixture 재생 선택, 현재 관절 각도 표시

### 2.3 운동 2종과 규칙
| 운동 | 렙 각도(3점) | down | up | 폼 규칙 |
|---|---|---|---|---|
| squat (변형: goblet_squat, box_squat — 동일 감지기) | hip–knee–ankle | < 100° | > 160° | `knee_valgus`: 정면 뷰에서 무릎 x가 발목 x보다 몸 안쪽으로 0.03(정규화) 이상. `torso_lean`: 측면 뷰에서 어깨–엉덩이 선이 수직에서 45° 초과 |
| pushup (변형: knee_pushup — 동일 감지기) | shoulder–elbow–wrist | < 90° | > 160° | `hip_sag`: shoulder–hip–ankle 각도 < 160°. `elbow_flare`: 팔꿈치 x가 어깨 x보다 바깥으로 0.12 이상 (선택, 시간 남으면) |

- 좌/우 중 visibility가 높은 쪽으로 계산. 둘 다 0.5 미만이면 `personDetected=false`.
- 규칙은 렙의 down 구간에서만 평가한다. 렙이 끝날 때 그 렙의 flags를 확정한다.
- 템포: down 진입→최저점, 최저점→up 복귀 시간(ms).

### 2.4 단계 상태머신
```
idle ──startSet──▶ countdown(3s) ──▶ set ──(reps ≥ target | endSet)──▶ rest(timer)
                                       ▲                                   │
                                       └────(timer 0 | skip, 남은 세트 有)──┘
                                                                           │(남은 세트 無)
                                                                           ▼
                                                                          done
awaiting_confirmation: set/rest 위에 오버레이. 렙 카운팅 일시정지. 승인/거절/20초 타임아웃으로 해제.
```
`endSession`은 idle 외 어느 단계에서든 done으로 보낸다.

### 2.5 몸 제스처 (Pose Landmarker만 사용, 손 모델 없음)
| 제스처 | 판정 | 언제 |
|---|---|---|
| 양손 들기 = 승인 | 양 손목 y < 코 y, 1.0초 연속 | awaiting_confirmation |
| 팔짱 = 거절 | 왼 손목 x > 오른 손목 x(교차), 두 손목 y가 어깨~엉덩이 사이, 1.0초 연속 | awaiting_confirmation |
| 한 손 들기 = 휴식 스킵 | 한쪽 손목만 코보다 위, 1.0초 연속 | rest |
- 제스처 판정 중에는 렙 카운팅을 하지 않는다(팔 올리는 동작이 팔굽혀펴기 렙으로 잡히지 않게).
- 거울 반전(mirror) 표시와 무관하게 정규화 좌표로 판정한다.

---

## 3. 아키텍처와 파일 구조

### 3.1 스택 (고정)
- Vite + React 18 + TypeScript, npm, Node 20+
- `@mediapipe/tasks-vision` (Pose Landmarker, running mode VIDEO, numPoses 1, lite 모델)
- 테스트: Vitest(단위), Playwright(E2E, chromium)
- 스타일: 단일 CSS 파일 + CSS 변수. Tailwind 등 추가 금지(설치 시간 절약)
- 배포: Vercel (정적). `vercel.json` 불필요. HTTPS 자동 → 카메라·WebMCP secure context 충족
- 모델 파일: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- WASM: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<설치된 버전>/wasm` (버전을 package.json과 맞춘다)

### 3.2 폴더 구조
```
formcoach/
  PLAN.md  PROGRESS.md  CLAUDE.md  README.md  LICENSE (MIT)
  index.html
  src/
    main.tsx  App.tsx  styles.css
    pose/
      types.ts          # Landmark, Frame, PoseSource, LiveMetrics
      angles.ts         # angle3(a,b,c), verticalAngle, smoothing(EMA)
      view.ts           # front/side 판별
      repCounter.ts     # 히스테리시스 FSM (운동별 threshold 주입)
      rules.ts          # knee_valgus, torso_lean, hip_sag, elbow_flare
      gestures.ts       # 양손 들기/팔짱/한 손 들기, dwell 타이머
      engine.ts         # Frame → LiveMetrics 갱신, 렙 확정 이벤트 발행
      sources/
        camera.ts       # getUserMedia + PoseLandmarker.detectForVideo
        replay.ts       # fixtures JSON 재생 (테스트·디버그)
    session/
      types.ts          # Plan, Block, SetRecord, Proposal
      machine.ts        # 2.4 상태머신 (순수 함수 + 이벤트)
      store.ts          # React 외부 스토어(useSyncExternalStore), localStorage에 plan 저장
      summary.ts        # endSession 요약·추천 규칙
    webmcp/
      adapter.ts        # 브라우저 API 유일 접점 + 내부 레지스트리 + 디버그 브리지
      tools.ts          # 툴 정의 7개 (스키마·설명·execute)
      phaseTools.ts     # 단계 → 활성 툴 집합, AbortController로 등록/해제
      log.ts            # Agent log 스토어
    ui/
      CameraView.tsx  SessionCard.tsx  PlanCard.tsx  PlanForm.tsx
      AgentLog.tsx  ProposalOverlay.tsx  DebugPanel.tsx
  fixtures/
    squat_10reps_side.json  squat_3valgus_front.json  pushup_5reps_side.json
    gesture_hands_up.json   gesture_arms_crossed.json  gesture_one_hand.json
  scripts/
    gen-fixtures.ts     # 합성 랜드마크 시퀀스 생성기
  tests/
    unit/  (angles, repCounter, rules, gestures, machine, phaseTools)
    e2e/   (session.spec.ts)
```

### 3.3 PoseSource 추상화 (테스트 가능성의 핵심)
```ts
export interface Frame { t: number; landmarks: Landmark[] | null } // 33개, {x,y,z,visibility}, 정규화 좌표
export interface PoseSource { start(onFrame: (f: Frame) => void): Promise<void>; stop(): void }
```
- `CameraPoseSource`: requestAnimationFrame 루프에서 `detectForVideo(video, t)` 호출.
- `ReplayPoseSource`: fixtures를 실제 시간 흐름(또는 `speed` 배속)으로 재생. URL `?replay=squat_10reps_side&speed=4`로 선택.
- 엔진·상태머신·툴은 소스가 무엇인지 모른다.

---

## 4. 포즈 엔진 사양

### 4.1 계산
- `angle3(a,b,c)`: b를 꼭짓점으로 하는 각도(도). 2D(x,y)만 사용.
- 좌/우 선택: 해당 관절 3점 visibility 평균이 높은 쪽. 매 프레임 바뀌지 않게 0.1 이상 차이 날 때만 전환.
- 스무딩: 각도에 EMA(alpha 0.5). 좌표에는 하지 않는다.
- view 판별: 정규화 어깨 폭 > 0.22 → front, < 0.12 → side, 사이는 이전 값 유지. 운동별 `preferredView`(squat: side가 깊이 판정에 유리하지만 front도 허용, pushup: side).

### 4.2 렙 FSM
```
state=up. angle < down → state=down, downAt=t, minAngle 추적
state=down, angle > up → 렙 확정 {minAngle, tempoDownMs, tempoUpMs, flags}, state=up
```
- 렙 확정 시 `onRep(RepRecord)` 이벤트. 규칙 평가는 down 구간 동안 누적한 위반을 렙 확정 시 flags로 넣는다.
- 첫 렙에서 `minAngle`이 down 임계보다 15° 이상 크면(얕음) `shallow` 플래그.

### 4.3 LiveMetrics (툴 `getLiveMetrics`가 그대로 반환)
```ts
interface LiveMetrics {
  phase: "idle"|"countdown"|"set"|"rest"|"awaiting_confirmation"|"done";
  cameraOk: boolean; personDetected: boolean; view: "front"|"side"|"unknown";
  exercise: string|null; setIndex: number|null; reps: number; targetReps: number|null;
  currentAngle: number|null;
  lastRep: { minAngle: number; tempoDownMs: number; tempoUpMs: number; flags: string[] } | null;
  flagCounts: Record<string, number>;   // 현재 세트 누적
  restRemainingSec: number|null;
  updatedAt: string; // ISO
}
```

### 4.4 Fixtures 생성기 (`scripts/gen-fixtures.ts`, `npm run gen:fixtures`)
- 30fps, 측면 뷰 스쿼트: 무릎 각도 `160 − 70·(1−cos(2πt/T))/2`, T=3s, 10회. hip/knee/ankle 좌표는 각도로부터 역산(허벅지·정강이 길이 0.25 정규화). 어깨·손목·코는 고정.
- 정면 뷰 스쿼트 3회 valgus: 3개 렙의 down 구간에서 무릎 x를 발목 x보다 몸 안쪽으로 0.05 이동.
- 팔굽혀펴기 5회: 팔꿈치 각도 사인파, hip_sag 없음.
- 제스처 3종: 1.5초 동안 조건 만족, 앞뒤 1초 중립.
- 모든 fixture는 `{ fps, frames: Frame[] }` 형식. visibility는 0.9로 채운다.

### 4.5 DoD (Task 2)
- 단위 테스트: `squat_10reps_side` → reps=10, `squat_3valgus_front` → knee_valgus 3, `pushup_5reps_side` → reps=5, 제스처 3종 각각 정확히 1회 발화, 중립 구간에서 0회.

---

## 5. WebMCP 툴 사양 (심사의 핵심)

### 5.0 API 표면 확인 (T0에서 15분, 결과는 `docs/WEBMCP_API_NOTES.md`)
웹을 읽을 수 있으면 아래를 확인하고 기록한다. 못 읽으면 "기본 가정"으로 구현한다(어댑터의 기능 감지가 차이를 흡수한다).
- 읽을 곳: 스펙 https://github.com/webmachinelearning/webmcp · Chrome 문서 허브 https://developer.chrome.com/docs/ai/agents (Imperative, Declarative, Best practices, Tool security) · 챌린지 페이지의 OpenAI WebMCP 가이드 · https://github.com/sdras/webmcp-tools · https://github.com/WebMCP-org/npm-packages
- 기록 항목: (1) 진입점 `document.modelContext` vs `navigator.modelContext` (2) `registerTool(tool, options?)` 시그니처와 tool 필드(`name`,`title`,`description`,`inputSchema`,`annotations`,`execute`) (3) 해제 방법: `AbortSignal` 옵션인지 `unregisterTool(name)`인지 (4) `execute(input, client)` 반환 형식: 평문 객체 vs `{ content:[{type:"text",text}] }`, 에러 표현 (5) `annotations.readOnlyHint` 지원 여부 (6) `client.requestUserInteraction` 존재 여부 (7) 선언형 속성 실제 이름: `toolname`, `tooldescription`, 필드 설명 속성, `SubmitEvent.agentInvoked` (8) 테스트 API: `chrome://flags/#enable-webmcp-testing`, `navigator.modelContextTesting.getTools()/executeTool()` (9) ChatGPT 인앱 브라우저 site tools의 추가 요구사항
- 기본 가정: 진입점 `document.modelContext ?? navigator.modelContext`. `registerTool({...}, { signal })`. 해제는 `AbortSignal`, 없으면 `unregisterTool(name)`. 브라우저 API에는 `{ content:[...] }` 형식으로 반환하되 어댑터 상수 `RETURN_FORMAT: "mcp" | "plain"`으로 전환 가능. 선언형 속성은 `toolname`/`tooldescription`.

### 5.1 어댑터 (`src/webmcp/adapter.ts`)
```ts
type ToolDef = {
  name: string; title?: string; description: string;
  inputSchema: JSONSchema; annotations?: { readOnlyHint?: boolean };
  execute: (input: any, client?: unknown) => Promise<unknown>;
};
export function getModelContext(): any | null {
  const d = document as any, n = navigator as any;
  return d.modelContext ?? n.modelContext ?? null;
}
// 내부 레지스트리: name → ToolDef. registerTool은 (1) 레지스트리에 넣고 (2) 브라우저 API가 있으면 거기에도 등록.
// unregister는 AbortSignal로: registerTool(def, { signal }) — signal abort 시 양쪽에서 제거.
// 브라우저 API가 { signal } 옵션을 거부하면 반환값의 unregister()/dispose() 등을 try 순서대로 시도하고, 다 없으면 재등록 방식(전체 clear 후 활성 툴 재등록)으로 폴백. 폴백 사용 여부를 log에 남긴다.
// 결과 정규화: execute가 객체를 돌려주면 { content: [{ type: "text", text: JSON.stringify(obj) }] } 로 감싸서 브라우저 API에 전달. 내부 브리지는 원본 객체를 그대로 준다.
// 디버그 브리지(항상 활성, 문서화): window.__formcoach = { listTools(): {name, description, readOnly}[], callTool(name, input): Promise<unknown>, phase(): string, replay(fixtureName, speed?): Promise<void>, setConfirmTimeoutMs(ms): void }
// 브라우저 API 존재 여부·이름(document/navigator)·등록 성공 여부를 Agent log 첫 줄에 기록한다.
```
- 브라우저 API에 등록되는 툴과 내부 레지스트리는 **항상 같은 집합**이어야 한다. 테스트는 내부 브리지로 하고, 실기기에서는 브라우저 API로 같은 코드가 돈다.

### 5.2 툴 목록 (7 + 선언형 1)
| 툴 | 활성 단계 | readOnly | 입력 | 출력 |
|---|---|---|---|---|
| `getWorkoutPlan` | 전부 | ✓ | `{}` | `Plan` (blocks[], createdBy: "user"/"agent", userNote) |
| `getLiveMetrics` | 전부 | ✓ | `{}` | `LiveMetrics` (4.3) |
| `getSetHistory` | 전부 | ✓ | `{}` | `SetRecord[]` (exercise, setIndex, reps, target, flagCounts, avgTempo, startedAt, endedAt) |
| `startSet` | idle, rest | | `{ blockIndex?: number }` | `{ status:"started", exercise, setIndex, targetReps }` 또는 `{ status:"error", reason }` |
| `setRest` | rest, set | | `{ seconds: number }` (10~600) | `{ status:"applied", restSec }` |
| `adjustProgram` | set, rest | | `{ action: "swap_exercise"\|"reduce_reps"\|"add_set"\|"extend_rest", exercise?: "goblet_squat"\|"box_squat"\|"knee_pushup"\|"squat"\|"pushup", reps?: number, seconds?: number, reason: string }` | `{ status:"applied"\|"rejected"\|"timeout", proposalId, plan? }` — 사용자 제스처 승인 전까지 pending (최대 20초) |
| `endSession` | countdown, set, rest, awaiting_confirmation | | `{}` | `Summary` (totalReps, sets, flagCounts, durationSec, recommendations: string[]) |
| `createPlan` (선언형 폼) | idle, done | | 폼 필드: exercise(select), sets, reps, restSec, userNote | 플랜 생성. 핸들러는 `event.agentInvoked`를 읽어 `createdBy`를 정한다 |

- description은 에이전트가 **언제** 호출해야 하는지까지 쓴다. 예: `getLiveMetrics` → "Returns the live rep count, joint angle, and form flags measured by the webcam in this tab. Call this whenever the user asks how they are doing, or before deciding to adjust the program. Contains no images."
- `adjustProgram` description에 "The user must confirm with a body gesture (raising both hands); the call resolves after confirmation. If status is rejected, do not retry the same proposal."라고 명시한다.
- `readOnlyHint: true`인 툴은 부작용이 없어야 한다(로그 기록 제외).

### 5.3 단계별 등록 (`phaseTools.ts`)
| 단계 | 활성 툴 |
|---|---|
| idle | getWorkoutPlan, getLiveMetrics, getSetHistory, startSet, createPlan(폼 표시) |
| countdown | 읽기 3종, endSession |
| set | 읽기 3종, adjustProgram, setRest, endSession |
| rest | 읽기 3종, startSet, setRest, adjustProgram, endSession |
| awaiting_confirmation | 읽기 3종, endSession |
| done | 읽기 3종, createPlan(폼 표시) |
- 구현: 단계 전환 시 이전 AbortController abort → 새 집합 등록. 읽기 3종은 한 번만 등록하고 abort하지 않는다(깜빡임 방지).
- 선언형 폼은 단계에 따라 DOM에 마운트/언마운트한다(폼이 있으면 툴이 있는 것).

### 5.4 선언형 폼 (`PlanForm.tsx`)
```html
<form toolname="createPlan" tooldescription="Create today's workout plan: exercise, sets, reps, rest seconds, and a note about injuries or limits.">
  <select name="exercise"> squat | pushup </select>
  <input name="sets" type="number" min="1" max="10" value="3">
  <input name="reps" type="number" min="1" max="50" value="12">
  <input name="restSec" type="number" min="10" max="600" value="90">
  <input name="userNote" placeholder="e.g. left knee is sensitive">
  <button type="submit">Create plan</button>
</form>
```
- 제출 핸들러: `preventDefault`, 유효성 검사, `store.setPlan(plan, createdBy: (e as any).agentInvoked ? "agent" : "user")`. 필드별 설명 속성(예: `toolparamdescription`)이 스펙에 있으면 붙이되, 없어도 동작해야 한다.

### 5.5 승인 흐름 (`adjustProgram` 내부)
1. 제안 생성 `{ proposalId, action, ..., reason }` → store에 저장 → phase를 `awaiting_confirmation`으로 오버레이 → ProposalOverlay 표시 → TTS로 "The agent suggests ... Raise both hands to accept" 읽기(`speechSynthesis`, 실패해도 무시).
2. gestures.ts가 승인/거절을 발화하면 store가 적용/거절 → execute의 Promise를 resolve.
3. 20초 내 제스처 없으면 `{ status:"timeout" }`. 오버레이에는 클릭 가능한 Accept/Decline 버튼도 둔다(접근성·폴백). 버튼 클릭도 같은 경로로 resolve.
4. 적용 규칙: `swap_exercise`는 **다음 세트부터**, `reduce_reps`는 다음 세트 target 변경, `add_set`은 블록 sets+1, `extend_rest`는 현재/다음 휴식에 반영.

### 5.6 Agent log (`log.ts`, `AgentLog.tsx`)
- 항목: `{ at, tool, input(요약 80자), status: "ok"|"error"|"pending"|"applied"|"rejected"|"timeout", durationMs, source: "browser-api"|"debug-bridge" }`
- 첫 항목: WebMCP API 감지 결과. 예: "WebMCP: document.modelContext detected, 5 tools registered" / "WebMCP: API not found — tools available via debug bridge only".

### 5.7 DoD (Task 3)
- 디버그 브리지로: idle에서 `listTools()`가 정확히 [getWorkoutPlan, getLiveMetrics, getSetHistory, startSet]을 돌려준다(순서 무관). `startSet` 후 set 단계에서 adjustProgram·setRest·endSession이 추가되고 startSet이 빠진다.
- `callTool("getLiveMetrics")`가 4.3 타입의 객체를 돌려준다.
- `callTool("adjustProgram", {...})` 호출 후 `gesture_hands_up` fixture 재생 → `{status:"applied"}`; `gesture_arms_crossed` → rejected; 아무것도 안 하면 20초 후 timeout(테스트에서는 타임아웃을 2초로 주입 가능하게).
- 단위 테스트: phaseTools 표 그대로 검증.

---

## 6. UI 사양 (최소한, 그러나 완결)

- 레이아웃: 2열 그리드(좌 62% / 우 38%), 최소 폭 1100px 기준. 다크 배경, 한 가지 강조색.
- CameraView: `<video>` 위에 `<canvas>` 오버레이. 33개 점 중 어깨·팔꿈치·손목·엉덩이·무릎·발목 12개와 연결선만 그린다. 현재 렙 각도의 꼭짓점 관절에 각도 숫자 표시. 큐 텍스트는 캔버스 하단 중앙에 1.5초 표시.
- SessionCard: 단계 배지, 운동명(변형 포함), "Set 2 / 3", 큰 렙 숫자 "6 / 12", 휴식 남은 초, 현재 세트 flagCounts 칩.
- PlanCard: 블록 목록(운동·세트×렙·휴식), `createdBy==="agent"`면 "Created by agent" 배지, userNote 표시.
- PlanForm: idle/done에서만 마운트. 5.4 그대로.
- AgentLog: 최근 50개, 최신이 위. 상태별 색. 첫 줄은 WebMCP 감지 결과(5.6).
- ProposalOverlay: 화면 중앙 카드. 제안 내용, 이유, "Raise both hands to accept · Cross arms to decline", 20초 진행 바, Accept/Decline 버튼.
- DebugPanel(`?debug=1`): 툴 목록(이름·readOnly·설명 툴팁), 툴 이름 선택 + JSON textarea + Call 버튼 + 결과 pre, fixture 선택 + Play/Stop, 현재 각도·view·personDetected, confirm timeout 입력.
- 카메라 권한 거부/없음: CameraView 자리에 "Camera unavailable — replay mode" + fixture 선택 드롭다운. 데모가 카메라 없이도 죽지 않게.
- TTS: 제안 생성 시와 세트 종료 시 한 문장. `speechSynthesis` 없으면 무시.

---

## 7. 테스트와 검증

### 7.1 Claude Code가 직접 하는 검증
- `npm run test` (Vitest): angles, repCounter(fixtures 3종), rules, gestures, machine(모든 전이), phaseTools(5.3 표), summary.
- `npm run e2e` (Playwright chromium, `npx playwright install chromium` 선행): `tests/e2e/session.spec.ts`
  1. `/?debug=1&replay=none` 열기 → `window.__formcoach.listTools()`에 읽기 3종 + startSet.
  2. `callTool("createPlan")`는 폼이므로 대신 폼에 값 입력 후 submit → `getWorkoutPlan().createdBy === "user"`.
  3. `callTool("startSet")` → 3.5초 대기 → `phase()==="set"` → `replay("squat_10reps_side", 4)` 재생 완료 대기 → `getLiveMetrics().reps === 10`.
  4. `setConfirmTimeoutMs(3000)` → `callTool("adjustProgram", {action:"swap_exercise", exercise:"goblet_squat", reason:"test"})`를 await 하지 않고 시작 → `replay("gesture_hands_up")` → 결과 `status==="applied"` → `getWorkoutPlan()`의 다음 블록 exercise가 goblet_squat.
  5. 같은 흐름으로 `gesture_arms_crossed` → rejected, 아무 것도 안 함 → timeout.
  6. `callTool("endSession")` → summary.totalReps === 10, Agent log DOM에 endSession 항목 존재.
- 브라우저 API 유무와 무관하게 위 테스트가 통과해야 한다. 선택: chromium 실행 인자에 `--enable-experimental-web-platform-features`를 넣어 `navigator.modelContextTesting`이 보이면 `getTools()` 결과가 내부 레지스트리와 같은지 검사하는 테스트를 추가한다(없으면 skip).
- `npm run build` 경고 0, `npm run lint`(eslint 기본) 통과.

### 7.2 사람이 하는 실기기 검증 (라운드 1: 약 H10, 라운드 2: 약 H14)
- Chrome: `chrome://flags/#enable-webmcp-testing` 활성화(없으면 `#enable-experimental-web-platform-features`), Model Context Tool Inspector 확장 설치 → 라이브 URL에서 툴 목록·스키마 확인, 각 툴 수동 실행, 단계 전환 시 목록 변화 확인, 확장 안의 Gemini 에이전트로 프롬프트 스크립트 실행.
- ChatGPT 데스크톱 앱 인앱 브라우저(site tools 지원 계정): 라이브 URL을 열고 아래 프롬프트 스크립트를 순서대로. 안 되면 Inspector 경로로 영상을 찍는다.
- 프롬프트 스크립트(영상과 동일):
  1. "Create a 3x12 squat plan with 90 seconds rest. Note that my left knee is sensitive."
  2. "Start the first set."
  3. (스쿼트 8회, 그중 3회 무릎 모으기) "How's my form so far?"
  4. "If my knees keep caving in, switch me to something safer."  → adjustProgram 기대
  5. (양손 들기) "What changed?"
  6. "Cut the rest to 45 seconds." → setRest
  7. "End the session and give me a summary."
- 확인 항목: 카메라 권한 흐름, 정면/측면 안내, 렙 카운트 정확도(±1), valgus 큐, 제안 오버레이와 제스처 승인, Agent log, TTS.

---

## 8. 배포·문서·제출물

### 8.1 배포
- GitHub 공개 레포(사람이 생성) → Vercel import(사람) → main push마다 자동 배포. Claude Code는 `vercel` CLI가 로그인돼 있으면 `vercel --prod`로 직접 배포한다.
- (선택) Chrome origin trial: 사람이 배포 origin으로 WebMCP 토큰을 발급받으면 `index.html`에 `<meta http-equiv="origin-trial" content="...">` 추가. 없어도 플래그 경로로 데모 가능.

### 8.2 README.md 구성 (영어)
1. 제목, 한 줄 설명, 라이브 URL, 영상 링크, 스크린샷 1장
2. Why WebMCP — 1절의 "카메라 스트림은 탭 안에만 있다" 문단
3. What the agent can do — 5.2 툴 표(사용자용 문장으로) + 단계별 활성 툴
4. Try it — ChatGPT 인앱 브라우저 / Chrome 플래그 + Inspector 두 경로, 프롬프트 스크립트 7개
5. Human-agent experience — 제스처 승인, Agent log, agentInvoked 배지
6. How it works — ASCII 다이어그램(Camera → Pose Landmarker → metrics → WebMCP tools ← Agent), 프라이버시(프레임은 브라우저 밖으로 나가지 않음, 툴은 숫자만 반환)
7. Run locally / tests / fixtures / debug bridge
8. Roadmap — 확장 프로그램으로 "눈" 분리, 어떤 사이트든 운동 스펙을 툴로 발행, 트래커·코치 크로스 사이트, 재활 처방 스펙
9. License MIT, 사용한 오픈소스(MediaPipe 등)

### 8.3 데모 영상 대본 (3분, 사람 촬영, 화면+웹캠 동시 녹화)
| 시간 | 화면 | 내레이션(영어) 요지 |
|---|---|---|
| 0:00–0:20 | 웹캠 앞 사용자, 사이트 | Hands busy, sweaty, mid-set. Agents can't see you. WebMCP lets this page hand the agent what the camera measures — as tools, never as video. |
| 0:20–0:50 | 프롬프트 1 → 폼 자동 입력, "Created by agent" 배지 | The plan form is a declarative WebMCP tool. The page knows an agent submitted it. |
| 0:50–1:30 | 프롬프트 2, 스쿼트, 카운터·큐, 프롬프트 3 → 에이전트 답변 | getLiveMetrics returns reps, angle, flags. The agent coaches from numbers computed in this tab. |
| 1:30–2:10 | 프롬프트 4 → 제안 오버레이 → 양손 들기 → 적용, Inspector/Agent log에서 툴 목록 변화 | Write tools need the human. Confirmation is a body gesture. Tools change with the phase of the workout. |
| 2:10–2:40 | 휴식, 프롬프트 6, 프롬프트 7 → 요약 | Rest control, session summary, recommendations — all through the same contract. |
| 2:40–3:00 | 다이어그램, 레포 링크 | Camera never leaves the tab. Any WebMCP-aware agent can be the coach. Open source. |

### 8.4 Devpost 설명 초안 (영어, 사람이 붙여넣기)
**Inspiration** — Home workouts get people hurt because nobody is watching their form, and existing AI coaches want your video. **What it does** — FormCoach measures reps, joint angles, tempo, and form faults with MediaPipe Pose entirely inside the browser tab, then exposes those measurements and the workout controls as WebMCP tools. Any WebMCP-aware agent becomes a coach that sees numbers, never frames. **How WebMCP is used** — seven imperative tools plus a declarative plan form; read-only tools annotated so agents can poll freely; write tools gated by a body-gesture confirmation because the user's hands are busy; the tool set changes with the workout phase (idle → set → rest → done); the form handler distinguishes agent submissions from human ones. **Why it needs WebMCP** — the camera stream exists only in the tab. A server-side MCP would have to receive video; here the agent gets a live `getLiveMetrics` contract instead. **Built with** — MediaPipe Tasks Vision, React, TypeScript, Vite, Vitest, Playwright, Vercel. **What's next** — moving the "eyes" into a browser extension so any workout or rehab site can publish its own exercise spec and be coached by the same agent.

### 8.5 제출 체크리스트 (03:30 KST)
- [ ] 라이브 URL에서 카메라 권한 → 세트 → 요약까지 사람이 1회 완주
- [ ] 레포 public, LICENSE, README, PROGRESS.md 정리, `v1.0` 태그
- [ ] 영상 업로드(YouTube unlisted 가능) 3:00 이내
- [ ] Devpost 폼: 설명(8.4), 라이브 URL, 레포 URL, 영상 URL, 스크린샷 3장, Built with
- [ ] 팀원 전원 Devpost 팀 등록

---

## 9. 타임라인 (H0 = Claude Code 시작 시각, PROGRESS.md 첫 줄에 기록)

| 태스크 | 시간 박스 | 산출물 | DoD | 시간 초과 시 축소 규칙 |
|---|---|---|---|---|
| **T0 스캐폴드·배포** | H0–H1 | Vite 프로젝트, 의존성, LICENSE, PROGRESS.md, CLAUDE.md, 카메라 켜지는 hello world, Vercel 배포, §5.0 API 확인 노트 | `npm run build` 성공, 라이브 URL 존재(사람 확인) | 배포가 막히면 사람에게 넘기고 T1 진행 |
| **T1 포즈 소스·fixtures** | H1–H2 | 3.3 인터페이스, camera.ts, replay.ts, gen-fixtures.ts, fixtures 6개, 스켈레톤 오버레이 | replay로 스켈레톤이 움직임(`?replay=squat_10reps_side`) | 제스처 fixture는 T2로 미룸 |
| **T2 포즈 엔진** | H2–H4.5 | angles, view, repCounter, rules, gestures, engine + 단위 테스트 | 4.5 DoD 전부 | pushup 삭제(squat만). elbow_flare 삭제. torso_lean 삭제 순 |
| **T3 세션·WebMCP** | H4.5–H7.5 | machine, store, summary, adapter, tools, phaseTools, log, PlanForm + 단위 테스트 | 5.7 DoD 전부 | `setRest` 삭제 → `add_set`·`extend_rest` 액션 삭제 → 그래도 안 되면 adjustProgram을 swap_exercise만 |
| **T4 UI 조립** | H7.5–H9.5 | 6절 컴포넌트 전부, styles, TTS | 7.2 프롬프트 스크립트를 디버그 패널로 끝까지 재현 가능 | DebugPanel 단순화, TTS 삭제, 캔버스는 점만 |
| **T5 E2E·수정** | H9.5–H11.5 | session.spec.ts, 사람 라운드 1 피드백 반영 | 7.1 E2E 통과, 라운드 1 치명 이슈 0 | E2E는 3·4단계까지만 자동화, 나머지 수동 |
| **T6 문서** | H11.5–H13.5 | README, Devpost 텍스트 최종, 영상 대본 확정, 코드 정리 | README만 읽고 새 사람이 로컬 실행 가능 | Roadmap·스크린샷 생략 |
| **T7 촬영 대기·픽스** | H13.5–H16 | 사람 촬영 중 발견되는 버그 즉시 수정, 라운드 2, `v1.0` 태그 | 라이브 URL과 태그 일치 | — |
| **제출** | ~H16.5 (늦어도 03:30 KST) | Devpost 제출 | 8.5 체크리스트 | 무엇이 남았든 제출 |

- 절대 시각 체크: H0 + 16.5h가 **03:30 KST를 넘기면** T5의 E2E 자동화와 T6의 Roadmap을 먼저 버린다. 그래도 넘기면 T4의 DebugPanel을 버린다. 영상(사람)과 README(핵심 3절)는 마지막까지 지킨다.

### 사람이 병렬로 하는 일
| 시점 | 일 |
|---|---|
| H0 | GitHub 공개 레포 생성 → Vercel import → 자동 배포 확인. Devpost 등록, 팀 등록 |
| H0–H2 | ChatGPT 데스크톱 앱 인앱 브라우저에서 site tools가 되는 계정인지 확인(아무 WebMCP 데모 사이트로). 안 되면 Chrome 플래그 + Model Context Tool Inspector 설치. (선택) origin trial 토큰 발급 |
| H10 | 실기기 검증 라운드 1 (7.2) → 이슈를 PROGRESS.md에 번호 붙여 적기 |
| H11–H13 | 촬영 환경 준비: 전신이 보이는 카메라 위치, 조명, OBS(화면+웹캠 PiP), 프롬프트 스크립트 인쇄 |
| H13.5–H16 | 촬영 (테이크 3회 이내), 편집, 업로드. 스크린샷 3장 |
| H14 | 라운드 2 |
| ~H16.5 | Devpost 제출 폼 작성·제출 |

---

## 10. 결정 기본값 (묻지 말고 이 값으로)

| 항목 | 값 |
|---|---|
| 프로젝트명 | FormCoach (레포명 `formcoach`) |
| 패키지 매니저 / Node | npm / 20+ |
| 프레임워크 | Vite + React 18 + TS strict |
| 스타일 | `src/styles.css` 단일 파일, CSS 변수, 시스템 폰트 |
| 상태 관리 | `useSyncExternalStore` 기반 자체 스토어. 외부 라이브러리 없음 |
| MediaPipe | `@mediapipe/tasks-vision` 최신 안정 버전, lite 모델, `runningMode: "VIDEO"`, `numPoses: 1`, GPU delegate 시도 후 실패 시 CPU |
| 각도 임계 | 2.3 표. 히스테리시스 각 10° |
| 제스처 dwell | 1.0초. 확인 타임아웃 20초(브리지로 변경 가능) |
| 기본 플랜(플랜 없이 startSet 시) | squat 3×12, rest 90s |
| 운동 변형 매핑 | goblet_squat/box_squat → squat 감지기, knee_pushup → pushup 감지기(down 100°) |
| 툴 결과 형식 | 내부: 객체. 브라우저 API: `{ content:[{type:"text", text: JSON}] }` |
| Agent log 보관 | 메모리 50개 |
| localStorage | plan만 저장(키 `formcoach.plan.v1`). 세트 기록은 세션 메모리 |
| 언어 | UI·README·주석 영어. 커밋 메시지 영어 |
| 라이선스 | MIT |
| 테스트 러너 | Vitest + Playwright(chromium만) |
| 에러 정책 | 툴 execute는 절대 throw하지 않는다. `{ status:"error", reason }` 반환 |

---

## 11. 부록: 코드 스켈레톤

### 11.1 adapter.ts
```ts
const registry = new Map<string, ToolDef>();
let api: any = null; let apiName: "document.modelContext" | "navigator.modelContext" | null = null;

export function initWebMCP() {
  const d = document as any, n = navigator as any;
  if (d.modelContext) { api = d.modelContext; apiName = "document.modelContext"; }
  else if (n.modelContext) { api = n.modelContext; apiName = "navigator.modelContext"; }
  log.add({ tool: "system", status: api ? "ok" : "error",
    input: api ? `WebMCP: ${apiName} detected` : "WebMCP: API not found — debug bridge only" });
  (window as any).__formcoach = {
    listTools: () => [...registry.values()].map(t => ({ name: t.name, description: t.description, readOnly: !!t.annotations?.readOnlyHint })),
    callTool: (name: string, input: unknown = {}) => call(name, input, "debug-bridge"),
    phase: () => store.get().phase,
    replay: (name: string, speed = 1) => replaySource.play(name, speed),
    setConfirmTimeoutMs: (ms: number) => store.setConfirmTimeout(ms),
  };
}

export function registerTool(def: ToolDef, opts: { signal: AbortSignal }) {
  registry.set(def.name, def);
  let handle: any = null;
  if (api) {
    const browserDef = { ...def, execute: async (input: any, client: any) => wrap(await call(def.name, input, "browser-api", client)) };
    try { handle = api.registerTool(browserDef, { signal: opts.signal }); }
    catch { try { handle = api.registerTool(browserDef); } catch (e) { log.add({ tool: def.name, status: "error", input: `registerTool failed: ${String(e)}` }); } }
  }
  opts.signal.addEventListener("abort", () => {
    registry.delete(def.name);
    try { handle?.unregister?.(); handle?.dispose?.(); api?.unregisterTool?.(def.name); } catch {}
  });
}

async function call(name: string, input: unknown, source: string, client?: unknown) {
  const def = registry.get(name); const t0 = performance.now();
  if (!def) return { status: "error", reason: `tool ${name} is not available in phase ${store.get().phase}` };
  const entry = log.add({ tool: name, input, status: "pending", source });
  try { const out = await def.execute(input, client); log.update(entry, { status: (out as any)?.status ?? "ok", durationMs: performance.now() - t0 }); return out; }
  catch (e) { log.update(entry, { status: "error" }); return { status: "error", reason: String(e) }; }
}
const wrap = (obj: unknown) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
```

### 11.2 repCounter.ts
```ts
export function createRepCounter(cfg: { down: number; up: number; hysteresis?: number }) {
  let state: "up" | "down" = "up"; let minAngle = 999; let downAt = 0; let bottomAt = 0;
  return {
    feed(angle: number, t: number, flagsSoFar: Set<string>): RepRecord | null {
      if (state === "up" && angle < cfg.down) { state = "down"; downAt = t; minAngle = angle; bottomAt = t; return null; }
      if (state === "down") {
        if (angle < minAngle) { minAngle = angle; bottomAt = t; }
        if (angle > cfg.up) {
          state = "up";
          const flags = [...flagsSoFar]; if (minAngle > cfg.down + 15) flags.push("shallow");
          return { minAngle, tempoDownMs: bottomAt - downAt, tempoUpMs: t - bottomAt, flags };
        }
      }
      return null;
    },
    get state() { return state; },
  };
}
```

### 11.3 gestures.ts (dwell)
```ts
export function createGestureDetector(dwellMs = 1000) {
  const since: Record<string, number | null> = { hands_up: null, arms_crossed: null, one_hand_up: null };
  return function feed(lm: Landmark[], t: number): GestureEvent | null {
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16], lh = lm[23], rh = lm[24];
    const lUp = lw.y < nose.y, rUp = rw.y < nose.y;
    const between = (p: Landmark) => p.y > Math.min(ls.y, rs.y) && p.y < Math.max(lh.y, rh.y);
    const now: Record<string, boolean> = {
      hands_up: lUp && rUp,
      arms_crossed: !lUp && !rUp && between(lw) && between(rw) && lw.x > rw.x,
      one_hand_up: lUp !== rUp,
    };
    for (const k of Object.keys(now)) {
      if (!now[k]) { since[k] = null; continue; }
      if (since[k] === null) since[k] = t;
      else if (t - since[k]! >= dwellMs) { since[k] = Number.POSITIVE_INFINITY; return { type: k as GestureType, t }; } // 1회만 발화
    }
    return null;
  };
}
```

### 11.4 phaseTools.ts
```ts
const PHASE_TOOLS: Record<Phase, string[]> = {
  idle: ["startSet"], countdown: ["endSession"], set: ["adjustProgram", "setRest", "endSession"],
  rest: ["startSet", "setRest", "adjustProgram", "endSession"], awaiting_confirmation: ["endSession"], done: [],
};
let ac: AbortController | null = null;
export function syncToolsToPhase(phase: Phase) {
  ac?.abort(); ac = new AbortController();
  for (const name of PHASE_TOOLS[phase]) registerTool(TOOLS[name], { signal: ac.signal });
}
// 읽기 3종은 initWebMCP 직후 한 번만: registerTool(TOOLS.getWorkoutPlan, { signal: neverAbort.signal }) ...
```

### 11.5 gen-fixtures.ts 핵심
```ts
function squatFrame(t: number, period: number, valgus: boolean): Landmark[] {
  const knee = 160 - 70 * (1 - Math.cos((2 * Math.PI * t) / period)) / 2; // 160 → 90 → 160
  const hip = { x: 0.5, y: 0.45 }, L = 0.25, th = ((180 - knee) / 2) * (Math.PI / 180);
  const kneePt = { x: hip.x + L * Math.sin(th), y: hip.y + L * Math.cos(th) };
  const ankle = { x: hip.x, y: kneePt.y + L * Math.cos(th) };
  const lm = blankPose(); // 33개, visibility 0.9, 어깨·손목·코 고정
  set(lm, 23, hip); set(lm, 25, valgus ? { ...kneePt, x: kneePt.x - 0.05 } : kneePt); set(lm, 27, ankle);
  mirror(lm); // 24, 26, 28에 좌우 대칭 복사
  return lm;
}
```

### 11.6 Playwright 스케치
```ts
test("full session via debug bridge", async ({ page }) => {
  await page.goto("/?debug=1&replay=none");
  const fc = (fn: string, ...args: any[]) => page.evaluate(([f, a]) => (window as any).__formcoach[f](...a), [fn, args]);
  expect((await fc("listTools")).map((t: any) => t.name).sort()).toEqual(["getLiveMetrics", "getSetHistory", "getWorkoutPlan", "startSet"]);
  await page.fill('input[name="reps"]', "10"); await page.click('form[toolname="createPlan"] button[type="submit"]');
  expect(await fc("callTool", "startSet")).toMatchObject({ status: "started" });
  await page.waitForTimeout(3500); expect(await fc("phase")).toBe("set");
  await fc("replay", "squat_10reps_side", 4); await page.waitForFunction(() => (window as any).__formcoach.callTool("getLiveMetrics").then((m: any) => m.reps >= 10));
  await fc("setConfirmTimeoutMs", 3000);
  const pending = page.evaluate(() => (window as any).__formcoach.callTool("adjustProgram", { action: "swap_exercise", exercise: "goblet_squat", reason: "test" }));
  await page.waitForTimeout(300); await fc("replay", "gesture_hands_up", 1);
  expect(await pending).toMatchObject({ status: "applied" });
});
```

---

### 11.7 참고 링크
- Devpost 챌린지 https://webmcp.devpost.com/ · OpenAI 안내 https://openai.com/webmcp-challenge/
- WebMCP 스펙 https://github.com/webmachinelearning/webmcp · Chrome 문서 https://developer.chrome.com/docs/ai/agents
- 도구·데모·폴리필 https://github.com/sdras/webmcp-tools · MCP-B 타입/폴리필 https://github.com/WebMCP-org/npm-packages
- MediaPipe Pose Landmarker (Web) https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- 테스트 경로: ChatGPT 데스크톱 인앱 브라우저(site tools) 또는 `chrome://flags/#enable-webmcp-testing` + Model Context Tool Inspector 확장

---

## 12. 시작 명령

```bash
git init formcoach && cd formcoach
npm create vite@latest . -- --template react-ts
npm i @mediapipe/tasks-vision
npm i -D vitest @playwright/test @types/node tsx
npx playwright install chromium
echo "# PROGRESS\n- H0: $(date -Iseconds) 시작" > PROGRESS.md
```
그 다음 T0부터. 각 태스크 끝에 커밋 + PROGRESS.md 갱신. 막히면 5분 이상 붙들지 말고 축소 규칙을 적용하고 PROGRESS.md에 남긴다.
