# 온보딩 튜토리얼 (코치마크) 설계

**날짜:** 2026-06-16
**상태:** 설계 승인 대기

## 1. 목적

처음 앱을 사용하는 사람은 볼륨·체성분처럼 차트 중심 탭이 어색해서 활용하지 못한다.
첫 로그인 시 **실제 화면 위에 코치마크(스포트라이트 + 말풍선)** 를 띄워, 각 화면을
"어떻게" 쓰는지 그 자리에서 짚어주는 30초짜리 온보딩 투어를 제공한다.

### 해결하려는 문제
- 신규 사용자가 볼륨·체성분 탭의 차트가 무엇을 의미하는지 모른다.
- 운동을 어디서 추가하고 어떻게 기록하는지 첫 동선이 불명확하다.

### 성공 기준
- 첫 로그인 후 자동으로 투어가 1회 실행된다.
- 투어가 스케줄 → (하단 +탭) → 운동 → 볼륨 → 체성분 순으로 실제 화면을 이동하며 안내한다.
- 데이터가 0인 신규 사용자에게도 볼륨·체성분 탭에서 데모 차트가 보여 설명이 성립한다.
- 설정에서 언제든 다시 볼 수 있다.
- 신규 의존성을 추가하지 않는다(기존 코드 스타일 유지).

## 2. 확정된 결정사항

| 항목 | 결정 |
|------|------|
| 방식 | 실제 화면 위 코치마크(스포트라이트 + 말풍선) |
| 범위 | 핵심 흐름(스케줄→운동 기록) + 어색한 탭(볼륨, 체성분) |
| 트리거 | 첫 로그인 자동 1회 + 설정 "튜토리얼 다시 보기" 버튼 |
| 빈 화면 처리 | 투어 동안 볼륨·체성분에 **데모 데이터** 차트 렌더 (뷰 레벨, 저장 없음) |
| 구현 | **직접 제작** (react-joyride 등 라이브러리 미사용, framer-motion 재사용) |
| 신규 의존성 | 없음 |

### 직접 제작을 택한 이유
이 투어의 어려운 부분(라우트 넘나들기 제어, 데모 데이터 모드, v1/v2 테마, 한글 카피)은
어떤 라이브러리도 대신 해주지 않는 영역이다. 라이브러리가 주는 것은 스포트라이트 오버레이와
말풍선 위치잡기 정도인데, 코드베이스가 전부 hand-rolled(framer-motion + zustand, UI 라이브러리
없음)이므로 같은 패턴으로 직접 만드는 것이 일관성·유지보수·의존성 측면에서 낫다.
추가로 작성하는 것은 위치잡기 헬퍼 하나 정도이고, 스포트라이트는 CSS
`box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` 트릭으로 해결한다.

## 3. 아키텍처

### 신규 파일
```
src/components/Onboarding/
  ├─ OnboardingTour.jsx        ← 투어 컨트롤러. App(BrowserRouter 내부)에 마운트.
  │                              active/stepIndex 제어, 라우트 전환·타깃 대기 처리.
  ├─ Coachmark.jsx             ← 스포트라이트 + 말풍선 1개를 그리는 프레젠테이션 컴포넌트.
  ├─ tourSteps.js              ← 스텝 정의 배열(타깃 셀렉터, 한글 카피, page, placement).
  ├─ useCoachmarkPosition.js   ← 타깃 getBoundingClientRect 기반 말풍선 위치 계산 훅.
  └─ Onboarding.css            ← v1/v2 테마 변수 매핑 스타일.
src/stores/
  └─ tourStore.js              ← zustand: { active, stepIndex, demoActive, start, next, prev, stop }
```

### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/App.jsx` | `<OnboardingTour />` 마운트(BrowserRouter 내부), 첫 로그인 시 자동 시작 트리거 |
| `src/stores/settingsStore.js` | `tourSeen: false` 플래그 추가(localStorage 영속) |
| `src/components/Settings/SettingsModal.jsx` | "튜토리얼 다시 보기" 버튼 추가 |
| `src/pages/SchedulePage.jsx` | 오늘 일정 카드에 `data-tour="schedule-today"` |
| `src/pages/WorkoutPage.jsx` | 운동 실행/타이머 영역에 `data-tour="workout-active"` + 데모 분기 불필요 |
| `src/pages/VolumePage.jsx` | 차트에 `data-tour="volume-chart"` + 데모 데이터 분기 |
| `src/pages/BodyPage.jsx` | 차트에 `data-tour="body-chart"` + 데모 데이터 분기 |
| `src/components/Layout/BottomNav.jsx`, `BottomNavV2.jsx` | + 추가 버튼에 `data-tour="add-button"` |
| `package.json` | 변경 없음 |

타깃 요소는 CSS 클래스 변경에 깨지지 않도록 **`data-tour` 속성**으로 지정한다.

## 4. 상태 모델 (tourStore)

```
{
  active: boolean,       // 투어 진행 중 여부 (오버레이 렌더 게이트)
  stepIndex: number,     // 현재 스텝
  demoActive: boolean,   // 볼륨·체성분 데모 데이터 표시 여부 (= active 동안 true)
  start(): void,         // stepIndex=0, active=true, demoActive=true
  next(): void,          // stepIndex++ (마지막이면 stop)
  prev(): void,          // stepIndex--
  stop(): void,          // active=false, demoActive=false, settingsStore.tourSeen=true
}
```

- `tourSeen`은 settingsStore(localStorage)에 영속. 자동 실행 여부 판단에만 사용.
- `tourStore`는 휘발성(런타임) 상태. 영속 불필요.

## 5. 라우트 넘나들기 제어 (핵심 난관)

투어는 `/schedule` → `/workout` → `/volume` → `/body`로 이동해야 한다.
`OnboardingTour.jsx`가 controlled 방식으로 처리한다:

1. `stepIndex` 변경 시 현재 스텝의 `page`와 현재 라우트를 비교.
2. 다르면 `navigate(step.page)` 호출 후, 코치마크 렌더를 일시 보류.
3. `useEffect`에서 `document.querySelector([data-tour="..."])`가 나타날 때까지 폴링
   (rAF 또는 짧은 interval, 타임아웃 가드 포함).
4. 타깃이 마운트되면 위치를 계산하고 코치마크를 표시.

타깃을 끝내 못 찾으면(타임아웃) 해당 스텝은 화면 중앙 말풍선으로 폴백한다.

## 6. 빈 화면 처리 — 데모 데이터

신규 사용자는 데이터가 0이라 볼륨·체성분 차트가 비어 있다.
투어 동안만 가짜 차트를 보여 설명이 성립하게 한다.

- `VolumePage`/`BodyPage`는 `useTourStore(s => s.demoActive)`를 구독.
- `demoActive && 실데이터 없음`이면 모듈 상수 `DEMO_VOLUME` / `DEMO_BODY`로 차트 렌더.
- 실데이터가 이미 있으면 데모를 쓰지 않는다(실데이터 우선).
- Firestore/스토어에 쓰지 않는 **순수 뷰 레벨** 분기 → 투어 종료 시 자동 복귀, 완전 가역적.

데모 상수 예시(실제 값은 구현 시 자연스럽게 채움):
- `DEMO_VOLUME`: 가슴/등/하체/어깨/팔/코어 부위별 세트 수 막대.
- `DEMO_BODY`: 최근 4~5개 시점의 체중·골격근량·체지방률 라인.

## 7. 스텝 흐름

| # | page | 타깃(data-tour) | 카피 요지 |
|---|------|-----------------|-----------|
| 0 | (중앙) | — | "WORK OUT! 사용법, 30초만 안내할게요" |
| 1 | /schedule | schedule-today | "여기서 오늘 할 운동·식사를 한눈에 봐요" |
| 2 | /schedule | add-button | "+ 버튼으로 운동·식단을 직접 추가해요" |
| 3 | /workout | workout-active | "운동을 시작하면 세트와 휴식 타이머가 여기서 돌아가요" |
| 4 | /volume | volume-chart | "막대가 길수록 그 부위를 많이 한 거예요" (데모) |
| 5 | /body | body-chart | "인바디를 기록하면 체중·근육량 변화가 그래프로 보여요" (데모) |
| 6 | (중앙) | — | "설정에서 언제든 다시 볼 수 있어요. 시작해볼까요?" |

- 각 말풍선: 본문 + `이전`/`다음`(마지막은 `완료`) + 우상단 `건너뛰기(Skip)`.
- 진행 표시: `n / 7`.
- `Skip` 또는 `완료` 시 `stop()` 호출 → `tourSeen=true`.

## 8. 트리거 로직 (App.jsx)

```
첫 로그인 자동:
  user가 로그인 상태이고 settingsStore.tourSeen === false 이고
  현재 native/web 모두 → tourStore.start() 1회 호출.
  (이미 진행 중이면 재호출하지 않음)

다시 보기(SettingsModal):
  버튼 클릭 → navigate('/schedule') → tourStore.start().
  (tourSeen 값과 무관하게 강제 시작)
```

## 9. 테마

- `Onboarding.css`는 v1/v2 공통 CSS 변수(accent, surface 등)를 사용해
  말풍선·버튼 색을 테마에 맞춘다(`document.documentElement.dataset.ui` 기반).
- 등장/이동 애니메이션은 기존 의존성인 framer-motion으로 처리.

## 10. 테스트

**단위 (Vitest)**
- `tourSteps.js`: 스텝 배열 순서/페이지 매핑/필수 필드 존재 검증.
- `tourStore.js`: start → next×n → 마지막에서 next 시 stop, stop 시 tourSeen=true, demoActive 토글.

**수동**
- 신규 계정 첫 로그인 시 자동 실행.
- 라우트 전환(스케줄→운동→볼륨→체성분)이 끊김 없이 진행.
- 볼륨·체성분에서 데모 차트가 보이고, 투어 종료 후 사라짐(실데이터 0 복귀).
- 설정 "다시 보기" 동작.
- 중간 Skip 시 즉시 종료 + 데모 해제 + tourSeen 저장.
- v1/v2 두 테마에서 말풍선 스타일 정상.

## 11. 범위 밖 (YAGNI)

- 7개 탭 전체 투어(식단·코치·어시스턴트는 직관적이라 제외).
- 빈 empty-state 화면 자체의 상시 개선(이번 작업은 투어 한정).
- 다국어/영어 카피(현재 한국어 단일).
- 단계별 강제 인터랙션("실제로 버튼을 눌러야 다음")은 도입하지 않음 — 읽기 기반 안내.
