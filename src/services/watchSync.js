// 애플워치 동기화 브리지 (네이티브 iOS 전용)
// 폰이 단일 진실 공급원(source of truth):
//   workoutStore 변화 → applicationContext로 워치에 푸시
//   워치 버튼 → message 수신 → store 액션 실행 → 변경이 다시 워치로 푸시
//
// 워치로 보내는 컨텍스트 형태:
//   { phase, idx, set, restEnd, date, exercises: [{ name, part, sets, reps, weight, done }] }
// 워치에서 받는 메시지:
//   { action: 'start' | 'completeSet' | 'pick' (index) | 'afterRest' | 'extendRest' (delta) | 'skipReps' | 'requestState' }

import { Capacitor } from '@capacitor/core'
import { useWorkoutStore } from '../stores/workoutStore'

let initialized = false
let lastPayloadKey = ''

function buildContext() {
  const s = useWorkoutStore.getState()
  const exercises = (s.workoutData || []).map((ex, i) => ({
    name:   ex.exercise_name || '',
    part:   ex.body_part || '',
    sets:   parseInt(ex.sets) || 3,
    reps:   String(ex.reps_or_duration ?? ''),
    weight: ex.weight_kg != null ? Number(ex.weight_kg) : -1, // plist에 null 불가 → -1 = 없음
    done:   s.completedSets[i] || 0,
  }))
  return {
    phase:   s.phase,
    idx:     s.currentIndex,
    set:     s.currentSet,
    restEnd: s.restEndTime || 0,   // ms epoch
    date:    s.selectedDate || '',
    exercises,
  }
}

async function pushContext(Watch, force = false) {
  const ctx = buildContext()
  const key = JSON.stringify(ctx)
  if (!force && key === lastPayloadKey) return
  lastPayloadKey = key
  try {
    await Watch.updateApplicationContext({ context: { ...ctx, ts: Date.now() } })
  } catch {
    // 워치 미페어링/미설치 등 — 조용히 무시
  }
}

function handleWatchMessage(msg, Watch) {
  const s = useWorkoutStore.getState()
  const action = msg?.action
  switch (action) {
    case 'start':
      if (s.phase === 'overview') s.startWorkout()
      break
    case 'completeSet':
      if (s.phase === 'active') s.completeSet()
      break
    case 'pick': {
      const i = Number(msg.index)
      if (Number.isInteger(i) && i >= 0 && i < (s.workoutData?.length || 0)) s.pickExercise(i)
      break
    }
    case 'afterRest':
      if (s.phase === 'rest') s.afterRest()
      break
    case 'extendRest': {
      const d = Number(msg.delta)
      if (s.phase === 'rest' && Number.isFinite(d)) s.extendRest(d)
      break
    }
    case 'skipReps':
      if (s.phase === 'log_reps') s.skipExerciseReps()
      break
    case 'requestState':
      pushContext(Watch, true)
      return // pushContext가 이미 전송
    default:
      return
  }
  // 액션 처리 후 최신 상태 즉시 푸시 (subscribe로도 가지만 즉답성 확보)
  pushContext(Watch, true)
}

export async function initWatchSync() {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true

  try {
    const { Watch } = await import('@capgo/capacitor-watch')

    // 워치 → 폰 명령 (즉시 전송)
    await Watch.addListener('messageReceived', (event) => {
      handleWatchMessage(event?.message, Watch)
    })

    // 워치 → 폰 명령 (미연결 시 큐잉됐다 늦게 도착하는 경로)
    await Watch.addListener('userInfoReceived', (event) => {
      handleWatchMessage(event?.userInfo, Watch)
    })

    // 워치가 연결되면 현재 상태 전송
    await Watch.addListener('reachabilityChanged', (event) => {
      if (event?.isReachable) pushContext(Watch, true)
    })

    // 스토어 변화 → 워치 푸시 (내용이 실제로 바뀐 경우만)
    useWorkoutStore.subscribe(() => pushContext(Watch))

    // 초기 1회
    pushContext(Watch, true)
  } catch (e) {
    console.warn('[watchSync] init 실패:', e?.message || e)
  }
}
