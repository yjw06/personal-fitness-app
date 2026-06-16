# 컬러 테마 선택 + v1/워치 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v2 레이아웃은 그대로 두고 7종 액센트 컬러 테마를 고를 수 있게 하며, UI 테마 v1과 애플워치 코드 경로를 제거한다.

**Architecture:** `data-ui='v2'`를 영구 고정하고, 액센트 색만 신규 `colors.css`의 `html[data-theme='x']` 블록으로 오버레이(소스 순서로 v2.css 액센트를 이김). v2.css의 하드코딩 accent rgba를 `rgba(var(--color-primary-rgb), …)`로 변수화해 글로우/그림자가 테마를 따라오게 한다. 상태는 `uiVersion` → `colorTheme`.

**Tech Stack:** React 19, Vite, Zustand, CSS custom properties. (색 로직은 CSS 변수라 단위 테스트 비대상 — 검증은 `npm run build` 성공 + grep 참조 0 + 수동 육안.)

---

## File Structure

| 파일 | 책임 | 신규/수정/삭제 |
|---|---|---|
| `src/themes/colors.css` | 7개 `data-theme` 액센트 변수 세트 + 밝은 테마 버튼 텍스트 대비 보정 | 신규 |
| `src/themes/v2.css` | 하드코딩 accent rgba → `rgba(var(--color-primary-rgb/-2-rgb), …)` | 수정 |
| `src/stores/settingsStore.js` | `uiVersion` → `colorTheme`; `COLOR_THEMES` 메타 export | 수정 |
| `src/App.jsx` | colors.css import, `data-ui='v2'` 고정 + `data-theme`, v1 import·분기 제거, 워치 useEffect 제거 | 수정 |
| `src/components/Settings/SettingsModal.jsx` (+`.css`) | UI 토글 → 컬러 스와치 그리드 | 수정 |
| `src/components/Layout/Header.jsx`,`Header.css`,`BottomNav.jsx`,`BottomNav.css` | v1 컴포넌트 | 삭제 |
| `src/services/watchSync.js` | 워치 브리지 | 삭제 |
| `package.json` | `@capgo/capacitor-watch` 제거 | 수정 |

### 테마 메타 (전 태스크 공통 계약)

`COLOR_THEMES` 배열 (settingsStore.js에 정의, SettingsModal이 소비). 각 항목 `{ id, name, c1, c2 }` — c1/c2는 스와치 미리보기 그라디언트 색:
```
ember   #ff5c2e #ffa62e   (기본)
volt    #c6ff00 #9be800
indigo  #7c4dff #b388ff
aqua    #00e5ff #2effd5
magenta #ff2e88 #ff6ad5
emerald #00e08a #34f5b0
sky     #3da9ff #7cc7ff
```
RGB 환산(colors.css용):
```
ember   primary 255,92,46    primary-2 255,166,46  dark #2a1208
volt    primary 198,255,0    primary-2 155,232,0   dark #1a2200
indigo  primary 124,77,255   primary-2 179,136,255 dark #160c33
aqua    primary 0,229,255    primary-2 46,255,213   dark #032027
magenta primary 255,46,136   primary-2 255,106,213 dark #2a0617
emerald primary 0,224,138    primary-2 52,245,176   dark #022017
sky     primary 61,169,255   primary-2 124,199,255 dark #06213a
```
밝은 테마(버튼 위 흰 텍스트 대비 부족 → 어두운 텍스트): **volt, aqua, sky, emerald**.

---

## Task 1: colors.css — 7 테마 액센트 오버레이

**Files:**
- Create: `src/themes/colors.css`

- [ ] **Step 1: 파일 작성**

Create `src/themes/colors.css`:
```css
/* ════════════════════════════════════════════════════════════
   컬러 테마 — 액센트 오버레이
   v2.css 뒤에 import. html[data-theme='x'] 가 액센트 변수만 덮어쓴다.
   레이아웃/배경은 v2.css·index.css 공통. 배경은 모든 테마 니어블랙 공통.
   특이성 동률(0,1,1)이므로 소스 순서(이 파일이 나중)로 액센트가 이긴다.
   ════════════════════════════════════════════════════════════ */

html[data-theme='ember'] {
  --color-primary:#ff5c2e; --color-primary-rgb:255,92,46;  --color-primary-2:#ffa62e; --color-primary-2-rgb:255,166,46; --color-primary-dark:#2a1208; --color-accent:#ff5c2e;
}
html[data-theme='volt'] {
  --color-primary:#c6ff00; --color-primary-rgb:198,255,0;  --color-primary-2:#9be800; --color-primary-2-rgb:155,232,0;  --color-primary-dark:#1a2200; --color-accent:#c6ff00;
}
html[data-theme='indigo'] {
  --color-primary:#7c4dff; --color-primary-rgb:124,77,255; --color-primary-2:#b388ff; --color-primary-2-rgb:179,136,255;--color-primary-dark:#160c33; --color-accent:#7c4dff;
}
html[data-theme='aqua'] {
  --color-primary:#00e5ff; --color-primary-rgb:0,229,255;  --color-primary-2:#2effd5; --color-primary-2-rgb:46,255,213; --color-primary-dark:#032027; --color-accent:#00e5ff;
}
html[data-theme='magenta'] {
  --color-primary:#ff2e88; --color-primary-rgb:255,46,136; --color-primary-2:#ff6ad5; --color-primary-2-rgb:255,106,213;--color-primary-dark:#2a0617; --color-accent:#ff2e88;
}
html[data-theme='emerald'] {
  --color-primary:#00e08a; --color-primary-rgb:0,224,138;  --color-primary-2:#34f5b0; --color-primary-2-rgb:52,245,176; --color-primary-dark:#022017; --color-accent:#00e08a;
}
html[data-theme='sky'] {
  --color-primary:#3da9ff; --color-primary-rgb:61,169,255; --color-primary-2:#7cc7ff; --color-primary-2-rgb:124,199,255;--color-primary-dark:#06213a; --color-accent:#3da9ff;
}

/* 밝은 액센트 테마 — 그라디언트 버튼 위 텍스트를 어둡게(대비 확보).
   특이성 (0,2,1) 동률 + 소스 순서 → v2.css 의 color:#fff 를 이긴다. */
html[data-theme='volt'] .btn-primary,
html[data-theme='aqua'] .btn-primary,
html[data-theme='sky'] .btn-primary,
html[data-theme='emerald'] .btn-primary {
  color:#0a0a0a;
  text-shadow:none;
}
```

- [ ] **Step 2: 파일 존재·구문 확인**

Run: `npx stylelint src/themes/colors.css 2>/dev/null || echo "stylelint 없음 — 건너뜀"`
Expected: stylelint 미설치면 메시지 출력(정상). 설치돼 있으면 에러 없음.
(이 파일은 아직 import되지 않으므로 빌드에 포함되지 않는다 — Task 4에서 import.)

- [ ] **Step 3: Commit**

```bash
git add src/themes/colors.css
git commit -m "feat: add color theme accent overlay (7 themes)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: v2.css 하드코딩 accent rgba 변수화

**Files:**
- Modify: `src/themes/v2.css`

ember 기준 색은 그대로 유지(시각 동일). `255,92,46`→`var(--color-primary-rgb)`, `255,166,46`→`var(--color-primary-2-rgb)`. 장식용 보라 글로우 `124,77,255`(line 54)는 테마 무관 — **유지**.

- [ ] **Step 1: base에 `--color-primary-2-rgb` 추가**

`src/themes/v2.css` line 21 `--color-primary-2:   #ffa62e;` 바로 아래에 추가:
```css
  --color-primary-2-rgb: 255, 166, 46;
```

- [ ] **Step 2: dim/mid/shadow 변수화**

다음 4줄을 각각 교체:
```css
  --color-primary-dim: rgba(255,92,46,0.13);
  --color-primary-mid: rgba(255,92,46,0.28);
```
→
```css
  --color-primary-dim: rgba(var(--color-primary-rgb),0.13);
  --color-primary-mid: rgba(var(--color-primary-rgb),0.28);
```
그리고:
```css
  --shadow-glow: 0 8px 30px rgba(255,92,46,0.28);
  --shadow-glow-strong: 0 10px 44px rgba(255,92,46,0.42);
```
→
```css
  --shadow-glow: 0 8px 30px rgba(var(--color-primary-rgb),0.28);
  --shadow-glow-strong: 0 10px 44px rgba(var(--color-primary-rgb),0.42);
```

- [ ] **Step 3: 앰비언트 글로우(line 53)·카드·버튼 rgba 변수화**

`src/themes/v2.css`에서 `rgba(255,92,46,` 로 시작하는 **나머지 모든** 값을 `rgba(var(--color-primary-rgb),`로, `rgba(255,166,46,`는 `rgba(var(--color-primary-2-rgb),`로 치환한다. 해당 라인(현재 번호 기준): 53, 107, 108, 113, 116, 151(2곳), 152, 160(2곳), 193(2곳), 194. **단 line 54의 `rgba(124,77,255,0.07)`는 그대로 둔다.**

확인용 — 치환 후 다음이 0이어야 함(line 54 보라색만 남으면 안 되고 255,92,46/255,166,46이 전부 사라져야 함):
Run: `grep -n "255,92,46\|255, 92, 46\|255,166,46\|255, 166, 46" src/themes/v2.css`
Expected: 출력 없음(0건).

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 성공. (data-ui='v2'는 아직 ember 기본값이라 화면 동일.)

- [ ] **Step 5: Commit**

```bash
git add src/themes/v2.css
git commit -m "refactor: drive v2 accent rgba from --color-primary-rgb vars

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: settingsStore — colorTheme + COLOR_THEMES

**Files:**
- Modify: `src/stores/settingsStore.js`

- [ ] **Step 1: 기본값 교체**

`src/stores/settingsStore.js`의 defaults에서:
```js
  // UI 테마 버전 ('v1' 클래식 라임 | 'v2' 인프라레드)
  uiVersion: 'v2',
```
→
```js
  // 컬러 테마 (액센트 색) — colors.css 의 data-theme 키와 일치
  colorTheme: 'ember',
```

- [ ] **Step 2: COLOR_THEMES export 추가**

`src/stores/settingsStore.js` 파일 끝(맨 아래)에 추가:
```js
// 설정창 스와치 그리드용 테마 메타. id = colors.css 의 data-theme 값.
export const COLOR_THEMES = [
  { id: 'ember',   name: 'Ember',   c1: '#ff5c2e', c2: '#ffa62e' },
  { id: 'volt',    name: 'Volt',    c1: '#c6ff00', c2: '#9be800' },
  { id: 'indigo',  name: 'Indigo',  c1: '#7c4dff', c2: '#b388ff' },
  { id: 'aqua',    name: 'Aqua',    c1: '#00e5ff', c2: '#2effd5' },
  { id: 'magenta', name: 'Magenta', c1: '#ff2e88', c2: '#ff6ad5' },
  { id: 'emerald', name: 'Emerald', c1: '#00e08a', c2: '#34f5b0' },
  { id: 'sky',     name: 'Sky',     c1: '#3da9ff', c2: '#7cc7ff' },
]
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공. (아직 App/Settings가 `uiVersion`을 참조하지만 store에 키가 없으면 `undefined`가 됨 — Task 4·5에서 정리. 빌드 자체는 통과.)

- [ ] **Step 4: Commit**

```bash
git add src/stores/settingsStore.js
git commit -m "feat: replace uiVersion with colorTheme in settings store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: App.jsx — 테마 적용 + v1/워치 제거

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: colors.css import 추가**

`src/App.jsx`의 `import './themes/v2.css'` **바로 아래**에 추가(v2.css 뒤여야 액센트가 이김):
```js
import './themes/colors.css'
```

- [ ] **Step 2: v1 컴포넌트 import 제거**

다음 두 줄을 삭제:
```js
import Header         from './components/Layout/Header'
import BottomNav      from './components/Layout/BottomNav'
```

- [ ] **Step 3: store 셀렉터 교체**

```js
  const uiVersion     = useSettingsStore((s) => s.uiVersion)
```
→
```js
  const colorTheme    = useSettingsStore((s) => s.colorTheme)
```

- [ ] **Step 4: data 속성 적용 교체**

```js
  // UI 테마 버전 적용 (v1 클래식 / v2 인프라레드)
  useEffect(() => {
    document.documentElement.dataset.ui = uiVersion
  }, [uiVersion])
```
→
```js
  // 레이아웃은 v2 고정, 액센트만 컬러 테마로 적용
  useEffect(() => {
    document.documentElement.dataset.ui = 'v2'
    document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])
```

- [ ] **Step 5: 워치 useEffect 제거**

다음 블록을 삭제:
```js
  // 네이티브(iOS): 애플워치 동기화 브리지 초기화
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    import('./services/watchSync').then(({ initWatchSync }) => initWatchSync())
  }, [])
```

- [ ] **Step 6: 헤더/내비 분기 제거 (V2 고정)**

```jsx
        {uiVersion === 'v2' ? <HeaderV2 /> : <Header user={user} />}
```
→
```jsx
        <HeaderV2 />
```
그리고:
```jsx
        {uiVersion === 'v2' ? <BottomNavV2 /> : <BottomNav />}
```
→
```jsx
        <BottomNavV2 />
```

- [ ] **Step 7: 빌드 확인 + 참조 0 확인**

Run: `npm run build`
Expected: 성공.
Run: `grep -n "uiVersion\|watchSync\|Layout/Header'\|Layout/BottomNav'" src/App.jsx`
Expected: 출력 없음(0건).

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: apply color theme, lock v2 layout, remove v1/watch wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: SettingsModal — 컬러 스와치 그리드

**Files:**
- Modify: `src/components/Settings/SettingsModal.jsx`, `src/components/Settings/SettingsModal.css`

- [ ] **Step 1: COLOR_THEMES import**

`src/components/Settings/SettingsModal.jsx`의 settingsStore import 줄:
```js
import { useSettingsStore } from '../../stores/settingsStore'
```
→
```js
import { useSettingsStore, COLOR_THEMES } from '../../stores/settingsStore'
```

- [ ] **Step 2: UI 토글 마크업 교체**

다음 블록 전체:
```jsx
        {/* ─── UI 테마 버전 ─── */}
        <p className="set-section-label">UI 테마</p>
        <div className="set-ui-toggle" role="radiogroup" aria-label="UI 테마 버전">
          {[
            { id: 'v1', name: 'ver.1', desc: '네온 라임 클래식' },
            { id: 'v2', name: 'ver.2', desc: '인프라레드' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={settings.uiVersion === t.id}
              className={`set-ui-option ${t.id}${settings.uiVersion === t.id ? ' active' : ''}`}
              onClick={() => settings.update({ uiVersion: t.id })}
            >
              <span className={`set-ui-swatch ${t.id}`} aria-hidden="true" />
              <span className="set-ui-name">{t.name}</span>
              <span className="set-ui-desc">{t.desc}</span>
            </button>
          ))}
        </div>
```
→
```jsx
        {/* ─── 컬러 테마 ─── */}
        <p className="set-section-label">컬러 테마</p>
        <div className="set-theme-grid" role="radiogroup" aria-label="컬러 테마">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={settings.colorTheme === t.id}
              aria-label={t.name}
              className={`set-theme-option${settings.colorTheme === t.id ? ' active' : ''}`}
              onClick={() => settings.update({ colorTheme: t.id })}
            >
              <span
                className="set-theme-swatch"
                style={{ background: `linear-gradient(135deg, ${t.c1}, ${t.c2})` }}
                aria-hidden="true"
              />
              <span className="set-theme-name">{t.name}</span>
            </button>
          ))}
        </div>
```

- [ ] **Step 3: CSS 교체 — 기존 `.set-ui-*` 제거, `.set-theme-*` 추가**

`src/components/Settings/SettingsModal.css`에서 기존 `.set-ui-toggle`, `.set-ui-option`, `.set-ui-option.active`, `.set-ui-swatch`, `.set-ui-swatch.v1`, `.set-ui-swatch.v2`, `.set-ui-name`, `.set-ui-desc` 규칙(현재 430~약 480행 블록)을 통째로 삭제하고, 그 자리에 추가:
```css
.set-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
  margin-bottom: var(--space-md, 16px);
}
.set-theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid var(--color-border, rgba(255,255,255,0.08));
  background: var(--color-surface-2, #1d1c23);
  cursor: pointer;
}
.set-theme-option.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}
.set-theme-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
}
.set-theme-name {
  font-size: 12px;
  color: var(--color-text-2, #a8a3a0);
}
.set-theme-option.active .set-theme-name {
  color: var(--color-text, #f7f5f3);
}
```

- [ ] **Step 4: 빌드 + 참조 0 확인**

Run: `npm run build`
Expected: 성공.
Run: `grep -rn "uiVersion\|set-ui-" src/components/Settings/`
Expected: 출력 없음(0건).

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/SettingsModal.jsx src/components/Settings/SettingsModal.css
git commit -m "feat: color theme swatch picker in settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: v1·워치 파일 삭제 + 패키지 제거

**Files:**
- Delete: `src/components/Layout/Header.jsx`, `Header.css`, `BottomNav.jsx`, `BottomNav.css`, `src/services/watchSync.js`
- Modify: `package.json` (`@capgo/capacitor-watch` 제거)

- [ ] **Step 1: 잔존 참조 0 확인 (삭제 전 안전 점검)**

Run: `grep -rn "Layout/Header'\|Layout/BottomNav'\|watchSync\|capacitor-watch\|@capgo" src`
Expected: 출력 없음. (있으면 BLOCKED로 보고 — 해당 참조 먼저 정리 필요.)

- [ ] **Step 2: v1 컴포넌트 + watchSync 삭제**

```bash
git rm src/components/Layout/Header.jsx src/components/Layout/Header.css \
       src/components/Layout/BottomNav.jsx src/components/Layout/BottomNav.css \
       src/services/watchSync.js
```

- [ ] **Step 3: 패키지 의존성 제거**

Run: `npm uninstall @capgo/capacitor-watch`
Expected: `package.json` dependencies에서 제거, `package-lock.json` 갱신.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete v1 layout components and watch sync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 통합 검증 (수동 + 자동)

**Files:** 없음

- [ ] **Step 1: 자동 검증**

Run: `npm run build`
Expected: 성공.
Run: `npm test`
Expected: 기존 11개 통과(영향 없음).
Run: `grep -rn "uiVersion\|set-ui-\|watchSync\|@capgo" src`
Expected: 0건.

- [ ] **Step 2: 수동 육안 검증**

Run: `npm run dev`
설정창 → 컬러 테마에서 7색을 차례로 선택하며 확인:
1. 선택 즉시 헤더(HeaderV2)·하단 FAB 독(BottomNavV2)·버튼·차트·앰비언트 배경 글로우의 액센트가 모두 바뀐다.
2. 배경 베이스(니어블랙)는 모든 테마 공통으로 유지된다.
3. 밝은 테마(Volt/Aqua/Sky/Emerald)에서 `.btn-primary` 위 글자가 **어두운색**으로 읽기 쉽다.
4. 밝은 테마에서 하단 중앙 FAB 아이콘과 차트 라벨이 잘 보이는지 확인 — 대비가 나쁘면 colors.css에 해당 셀렉터(`.btn-primary` 옆에 FAB/라벨 셀렉터)를 추가해 어두운색 보정.
5. 새로고침 후에도 선택한 테마가 유지된다(localStorage).
6. 설정창에 더 이상 v1/v2 토글이 없다.

- [ ] **Step 3: (이슈 발견 시) 보정 후 커밋**

대비 보정 등 수정이 생기면:
```bash
git add -A
git commit -m "fix: improve accent contrast on light themes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 7종 테마 / 기본 ember → Task 1 colors.css + Task 3 COLOR_THEMES. ✓
- 액센트만 변경, 배경 공통 → Task 1(액센트 변수만), Task 2(글로우 변수화). ✓
- data-ui 영구 고정 + data-theme 오버레이 → Task 4 Step 4. ✓
- 하드코딩 rgba 변수화 → Task 2. ✓
- uiVersion→colorTheme → Task 3. ✓
- 설정창 토글→스와치 → Task 5. ✓
- v1 삭제(컴포넌트/분기) → Task 4(분기·import) + Task 6(파일). ✓
- 워치 삭제(watchSync/App 호출/패키지) → Task 4 Step 5(호출) + Task 6(파일·패키지). ✓
- 밝은 테마 텍스트 대비 → Task 1(.btn-primary 보정) + Task 7 Step 2.4(FAB/라벨 육안). ✓
- 마이그레이션(구 uiVersion 무시) → Task 3에서 키 교체, 구 값 자동 무시(기본 ember). ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드/명령 포함. CSS라 단위 테스트 없음은 명시(검증=빌드/grep/육안). ✓

**Type consistency:** `colorTheme` 키, `COLOR_THEMES` 항목 형태 `{ id, name, c1, c2 }`, `data-theme` 값 = colors.css 블록 키 = COLOR_THEMES id, 모두 Task 1/3/4/5에서 동일. CSS 변수명(`--color-primary-rgb`, `--color-primary-2-rgb`)이 colors.css(Task1)·v2.css(Task2)에서 일치. ✓
