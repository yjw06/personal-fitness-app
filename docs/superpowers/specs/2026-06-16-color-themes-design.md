# 컬러 테마 선택 + v1/워치 제거 — 설계 문서

작성일: 2026-06-16

## 배경 / 목표

앱을 일반 사용자에게 공유하면서, 사용자가 취향에 맞는 액센트 색을 고를 수 있게 한다. 동시에 더 이상 쓰지 않는 두 가지를 제거한다:
- **UI 테마 v1**(클래식 라임) — v2(INFRARED) 레이아웃만 유지.
- **애플워치 앱** — 유지보수 부담 제거.

핵심 원칙: **레이아웃은 v2 그대로, 액센트 색만 교체.** 배경 톤(니어블랙)은 모든 테마 공통.

## 결정 사항 (확정)

1. 컬러 테마 **7종**, 기본값 **Ember**(현재 색).
2. 변경 범위: **액센트 색만** (배경 공통). 앰비언트 글로우·버튼 그라디언트·그림자는 액센트를 따라감.
3. v2 레이아웃이 유일 — `uiVersion` 토글/분기 제거.
4. 설정창의 기존 "UI 테마(v1/v2)" 토글 자리를 **컬러 테마 선택 UI**로 교체.
5. 워치 앱 전면 제거.

## 비목표 (YAGNI)

- 라이트 모드 / 배경 톤 변형 — 액센트 스왑만.
- 사용자 커스텀(임의 HEX) 색 — 프리셋 7종만.
- 테마별 폰트/라운드/레이아웃 변경 — 색만.

---

## 컬러 테마 정의

각 테마는 액센트 변수 세트다. `주색(primary) → 그라디언트 끝색(primary-2)`:

| key | 이름 | primary | primary-2 |
|---|---|---|---|
| `ember` | Ember (기본) | `#ff5c2e` | `#ffa62e` |
| `volt` | Volt | `#c6ff00` | `#9be800` |
| `indigo` | Indigo | `#7c4dff` | `#b388ff` |
| `aqua` | Aqua | `#00e5ff` | `#2effd5` |
| `magenta` | Magenta | `#ff2e88` | `#ff6ad5` |
| `emerald` | Emerald | `#00e08a` | `#34f5b0` |
| `sky` | Sky | `#3da9ff` | `#7cc7ff` |

각 테마가 정의해야 하는 변수 (현재 v2.css의 액센트 관련 변수 일체):
```
--color-primary
--color-primary-rgb      /* "r, g, b" 형식 — rgba() 합성·앰비언트 글로우에 사용 */
--color-primary-2        /* 그라디언트 끝색 */
--color-primary-dim      /* rgba(primary, 0.13) */
--color-primary-mid      /* rgba(primary, 0.28) */
--color-primary-dark     /* 어두운 톤 (배지/딥 배경) */
--color-accent           /* = primary */
--shadow-glow            /* 0 8px 30px rgba(primary, 0.28) */
--shadow-glow-strong     /* 0 10px 44px rgba(primary, 0.42) */
```

> `--color-primary-dark`는 색마다 톤이 달라 단순 합성이 어렵다 → 테마별로 직접 지정.
> 그 외 그림자/글로우/dim/mid는 `--color-primary-rgb`로 합성하면 한 곳만 바꿔도 따라온다.

---

## 아키텍처

### 핵심 결정: `data-ui='v2'`는 영구 고정, 그 위에 `data-theme` 오버레이

`index.css :root`는 공통 디자인 토큰(spacing·radius·semantic·text + `--color-primary-rgb`로 rgba 합성하는 패턴, 주석에 "테마별 오버라이드"라 명시)이고, `v2.css`가 `html[data-ui='v2']`로 그 위에 ember 액센트 + 레이아웃을 덮는 구조다. 따라서 `data-ui` 스코프를 풀면 특이성·소스순서 충돌로 레이아웃이 깨질 위험이 있다.

**안전한 방식**: 레이아웃 CSS는 한 줄도 건드리지 않는다.
- `data-ui='v2'`를 토글 없이 **영구 적용**(마운트 시 항상 `v2` 설정).
- 액센트 색은 **별도 `data-theme` 오버레이**로 얹는다. 액센트 *변수만* 오버라이드하므로 레이아웃과 무관.

### 1) 액센트 오버레이 — 신규 `src/themes/colors.css`

`v2.css` **다음에** import되는 새 파일. 7개 테마 블록이 액센트 변수만 정의:
```css
html[data-theme='ember']  { --color-primary:#ff5c2e; --color-primary-rgb:255,92,46;  --color-primary-2:#ffa62e; --color-primary-dark:#2a1208; --color-accent:#ff5c2e; }
html[data-theme='volt']   { --color-primary:#c6ff00; --color-primary-rgb:198,255,0;  --color-primary-2:#9be800; --color-primary-dark:#1a2200; --color-accent:#c6ff00; }
/* ... indigo, aqua, magenta, emerald, sky ... */
```
- `--color-primary-dim`/`-mid`/`--shadow-glow`/`--shadow-glow-strong`는 `rgba(var(--color-primary-rgb), …)`로 정의돼 있어 `-rgb`만 바꾸면 자동으로 따라온다. v2.css에서 이들이 하드코딩 rgba면 변수 합성형으로 치환한다.
- 특이성: `html[data-theme='x']`(0,1,1) = `html[data-ui='v2']`(0,1,1). 동률이므로 **소스 순서로 결정** → `colors.css`가 `v2.css` 뒤에 import되어 액센트가 이긴다.
- 텍스트 대비: Volt/Aqua/Sky/Emerald 같은 밝은 액센트는 버튼 위 텍스트가 흰색이면 대비 부족. `--color-text-on-primary`(index.css에 이미 존재, 어두운색)를 버튼 텍스트에 쓰는지 확인하고, v2 `.btn-primary`가 흰색 텍스트 고정이면 밝은 테마에서 어두운 텍스트로 보정.

### 2) v2.css 내 하드코딩 rgba 변수화

앰비언트 배경 글로우(`rgba(255,92,46,0.08)` 등)·카드/버튼 그림자에서 액센트 색을 `rgba(var(--color-primary-rgb), …)`로 치환 → 테마 전환 시 글로우까지 따라옴. (보조 보라색 글로우 `rgba(124,77,255,…)` 같은 장식은 테마와 무관하니 유지 가능 — 단 통일성 위해 함께 검토.)

### 3) 상태 — settingsStore

```diff
- uiVersion: 'v2',
+ colorTheme: 'ember',
```
- `App.jsx`: `document.documentElement.dataset.ui = 'v2'` **고정**, `document.documentElement.dataset.theme = colorTheme` 추가.
- `App.jsx`: `uiVersion === 'v2' ? <HeaderV2/> : <Header/>` 분기 제거 → `<HeaderV2/>`·`<BottomNavV2/>` 고정.
- 마이그레이션: 기존 localStorage `uiVersion` 값은 무시(기본 `ember`로 시작). 별도 변환 불필요.

### 4) 설정창 UI

기존 "UI 테마(v1/v2)" 토글 자리(`set-ui-*` 클래스, `set-ui-swatch` 포함)를 **컬러 테마 선택 그리드**로 교체:
- 7개 스와치 버튼(각 테마 `primary→primary-2` 그라디언트 미리보기 + 이름).
- 현재 선택 테마 강조.
- 클릭 즉시 `settings.update({ colorTheme })` → 실시간 반영.

### 5) 삭제 대상

**v1:**
- `src/components/Layout/Header.jsx`, `Header.css`
- `src/components/Layout/BottomNav.jsx`, `BottomNav.css`
- `App.jsx`의 v1 import(`Header`, `BottomNav`)·분기.
- `SettingsModal`의 UI 테마(v1/v2) 토글 마크업·관련 state.
- `index.css`는 **공통 베이스이므로 유지**. v1 컴포넌트(`Header`/`BottomNav`)가 사라지면 그들을 겨냥한 클래스 규칙은 죽은 코드가 되지만 무해 — 명백히 v1 컴포넌트 전용인 규칙만 정리(선택적), base 토큰·리셋·공유 클래스는 보존.

**워치** (설정 UI 없음 — 코드 경로만 존재):
- `src/services/watchSync.js` 삭제.
- `src/App.jsx:40`의 `import('./services/watchSync').then(({ initWatchSync }) => initWatchSync())` 제거.
- `package.json`의 `@capgo/capacitor-watch` 의존성 제거.
- iOS 네이티브 워치 타깃은 본 작업 범위 밖(웹 코드만) — 빌드/실행에 영향 없음 확인.

---

## 데이터 플로우

```
설정창 스와치 클릭
  → settings.update({ colorTheme })  (localStorage 저장)
  → App.jsx useEffect: html[data-theme] 갱신
  → CSS 변수 세트 교체 → 전 화면 액센트 즉시 변경
```

## 에러 처리 / 엣지

| 상황 | 처리 |
|---|---|
| localStorage에 구 `uiVersion` 값만 있음 | 무시, `colorTheme` 기본값 `ember` |
| 알 수 없는 `colorTheme` 값 | `data-theme`가 매칭 안 되면 CSS에서 액센트 변수 미정의 → 안전하게 `html` 루트에 `ember` 기본 변수를 정의해 폴백 |
| 워치 코드 제거 후 잔존 호출 | 빌드/grep으로 참조 0 확인 |

## 테스트 / 검증

- 색 로직은 CSS 변수라 단위 테스트 비대상. **빌드 성공 + grep으로 v1/워치 참조 0** 확인.
- 수동: 7개 테마 전환 시 헤더·FAB·버튼·차트·글로우 색이 모두 따라오는지, 배경은 공통인지 육안 확인.
- `npm run build` 성공, 기존 11개 Vitest 통과 유지.

## 영향받는 파일 요약

| 파일 | 변경 |
|---|---|
| `src/themes/colors.css` | **신규** — `data-theme` 7세트 액센트 변수. v2.css 뒤에 import |
| `src/themes/v2.css` | 하드코딩 accent rgba → `rgba(var(--color-primary-rgb), …)` 변수화 (레이아웃·data-ui 스코프 유지) |
| `src/stores/settingsStore.js` | `uiVersion` → `colorTheme`(기본 `ember`) |
| `src/App.jsx` | `data-ui='v2'` 고정 + `data-theme` 적용, v1 import·분기 제거, 워치 호출(line 40) 제거, colors.css import |
| `src/components/Settings/SettingsModal.jsx`(+css) | UI 테마 토글 → 컬러 스와치 그리드 |
| `src/components/Layout/Header.jsx`, `Header.css`, `BottomNav.jsx`, `BottomNav.css` | 삭제 |
| `src/services/watchSync.js` | 삭제 |
| `package.json` | `@capgo/capacitor-watch` 제거 |
