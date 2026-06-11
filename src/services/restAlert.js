// 휴식 종료 강력 알림 시스템
// - 큰 비프 + 멜로디 + 반복
// - TTS 음성 안내
// - 진동 패턴
// - 시스템 Notification (백그라운드 탭에서도)
// - Wake Lock (휴식 중 화면 꺼짐 방지)
//
// 네이티브(iOS Capacitor)에서는:
// - 진동 → Haptics (navigator.vibrate가 iOS에서 미지원이므로)
// - 알림 → LocalNotifications: 휴식 시작 시 종료 시각에 OS 알림 예약
//   → 앱이 백그라운드/잠금화면이어도 정확히 울림
// - Wake Lock → KeepAwake

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics } from '@capacitor/haptics'
import { KeepAwake } from '@capacitor-community/keep-awake'

const isNative = Capacitor.isNativePlatform()
const REST_NOTIFICATION_ID = 7301

let audioCtx = null
let activeOscillators = []
let activeRepeatTimer = null
let wakeLock = null
let notificationRef = null

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// 사용자 인터랙션 시점에 호출해 AudioContext를 깨워둔다 (모바일 자동재생 정책 우회)
export function unlockAudio() {
  const ctx = getCtx()
  if (!ctx) return
  // 무음 비프 1회 → 컨텍스트 활성화
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.01)
  } catch {}
}

// 단일 비프
function playBeep(ctx, startTime, freq, duration, volume = 0.8) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'square' // square가 sine보다 훨씬 잘 들림
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02)
  gain.gain.setValueAtTime(volume, startTime + duration - 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
  activeOscillators.push(osc)
  osc.onended = () => {
    activeOscillators = activeOscillators.filter((o) => o !== osc)
  }
}

// 종료 멜로디 (도-미-솔-도, 트리플 페어)
function playEndMelody(volume) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const v = Math.max(0, Math.min(1, volume))

  // 첫번째 신호: 빠른 3연속 비프 (관심 끌기)
  playBeep(ctx, now + 0.00, 880,  0.12, v)
  playBeep(ctx, now + 0.15, 880,  0.12, v)
  playBeep(ctx, now + 0.30, 1175, 0.20, v)

  // 두번째 신호: 상승 멜로디
  playBeep(ctx, now + 0.65, 523.25, 0.15, v) // C5
  playBeep(ctx, now + 0.82, 659.25, 0.15, v) // E5
  playBeep(ctx, now + 0.99, 783.99, 0.15, v) // G5
  playBeep(ctx, now + 1.16, 1046.5, 0.35, v) // C6 (긴 음)
}

// 진동 — 네이티브는 Haptics, 웹은 navigator.vibrate
function vibrate(pattern) {
  if (isNative) {
    // 패턴 총 길이만큼 단발 진동 (iOS는 패턴 미지원)
    const total = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern
    Haptics.vibrate({ duration: Math.min(total, 2000) }).catch(() => {})
    return
  }
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch {}
}

// 시스템 알림
async function showNotification(title, body) {
  // 네이티브: 백그라운드용 OS 알림은 scheduleRestEndNotification이 이미 예약함.
  // 포그라운드에서는 멜로디+햅틱으로 충분 — 웹 Notification API 사용 안 함.
  if (isNative) return
  try {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    // Service Worker 알림 우선 (백그라운드에서도 작동)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/personal-fitness-app/icon-192.png',
          badge: '/personal-fitness-app/icon-192.png',
          tag: 'rest-end',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 400],
        })
        return
      }
    }

    notificationRef = new Notification(title, {
      body,
      icon: '/personal-fitness-app/icon-192.png',
      tag: 'rest-end',
      requireInteraction: true,
    })
  } catch {}
}

// 알림 권한 요청 (사용자 액션 시점에 호출)
export async function requestNotifyPermission() {
  if (isNative) {
    try {
      const { display } = await LocalNotifications.requestPermissions()
      return display === 'granted' ? 'granted' : 'denied'
    } catch {
      return 'error'
    }
  }
  try {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied')  return 'denied'
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'error'
  }
}

// ─── 네이티브 전용: 휴식 종료 OS 알림 예약/취소 ─────────────
// 휴식 시작·연장 시 호출 — JS 타이머는 백그라운드에서 멈추지만
// OS에 예약된 로컬 알림은 잠금화면에서도 정확한 시각에 울린다.
export async function scheduleRestEndNotification(endTimeMs, exerciseName = '') {
  if (!isNative) return
  try {
    // iOS는 권한 없이 예약하면 조용히 무시됨 — 예약 직전 확인/요청
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    if (perm.display !== 'granted') return

    await cancelRestEndNotification()
    if (endTimeMs - Date.now() < 1500) return // 너무 임박하면 즉시 알림이 대신함
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID,
        title: '💪 휴식 종료!',
        body: exerciseName ? `${exerciseName} — 다음 세트 준비` : '다음 세트를 시작하세요',
        schedule: { at: new Date(endTimeMs) },
        sound: 'default',
      }],
    })
  } catch (e) {
    // 조용한 실패는 디버깅 불가 — 화면에 노출
    try {
      const { toast } = await import('../stores/toastStore')
      toast.error(`알림 예약 실패: ${e?.message || e}`)
    } catch {}
  }
}

export async function cancelRestEndNotification() {
  if (!isNative) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] })
    await LocalNotifications.removeDeliveredNotifications({
      notifications: [{ id: REST_NOTIFICATION_ID }],
    })
  } catch {}
}

// Wake Lock (휴식 동안 화면 꺼지지 않도록) — 네이티브는 KeepAwake
export async function acquireWakeLock() {
  if (isNative) {
    try { await KeepAwake.keepAwake(); return true } catch { return false }
  }
  try {
    if (!('wakeLock' in navigator)) return false
    if (wakeLock) return true
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
    return true
  } catch {
    return false
  }
}

export async function releaseWakeLock() {
  if (isNative) {
    try { await KeepAwake.allowSleep() } catch {}
    return
  }
  try {
    if (wakeLock) {
      await wakeLock.release()
      wakeLock = null
    }
  } catch {}
}

// 탭 복귀 시 Wake Lock 재요청
export function reacquireWakeLockIfNeeded() {
  if (!wakeLock && document.visibilityState === 'visible') {
    acquireWakeLock().catch(() => {})
  }
}

// 메인 함수: 휴식 종료 알림 (모든 채널 동시 발사)
export function triggerRestEndAlert(opts = {}) {
  const {
    sound = true,
    vibration = true,
    notification = true,
    volume = 0.8,
    repeat = true,
    exerciseName = '',
  } = opts

  const fire = () => {
    if (sound) playEndMelody(volume)
    if (vibration) vibrate([300, 150, 300, 150, 500])
  }

  fire()

  if (notification) {
    showNotification(
      '💪 휴식 종료!',
      exerciseName ? `${exerciseName} - 다음 세트 준비` : '다음 세트를 시작하세요'
    )
  }

  // 반복 알림 — 사용자가 응답할 때까지 5초 간격
  if (repeat) {
    clearRepeat()
    let count = 0
    activeRepeatTimer = setInterval(() => {
      count++
      if (count > 5) {
        clearRepeat()
        return
      }
      if (sound) playEndMelody(volume)
      if (vibration) vibrate([400, 200, 400])
    }, 5000)
  }
}

// 알림 중단 (사용자가 "다음 세트" 누르면)
export function clearRestAlert() {
  clearRepeat()
  cancelRestEndNotification()
  try {
    activeOscillators.forEach((o) => {
      try { o.stop() } catch {}
    })
    activeOscillators = []
  } catch {}
  try { if (navigator.vibrate) navigator.vibrate(0) } catch {}
  try {
    if (notificationRef) {
      notificationRef.close()
      notificationRef = null
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.getNotifications({ tag: 'rest-end' }).then((notes) =>
            notes.forEach((n) => n.close())
          )
        }
      }).catch(() => {})
    }
  } catch {}
}

function clearRepeat() {
  if (activeRepeatTimer) {
    clearInterval(activeRepeatTimer)
    activeRepeatTimer = null
  }
}

// 카운트다운 마지막 3초 틱 소리 (사용자에게 곧 끝남 알림)
export function playTickSound(volume = 0.5) {
  const ctx = getCtx()
  if (!ctx) return
  playBeep(ctx, ctx.currentTime, 1100, 0.08, Math.max(0, Math.min(1, volume)))
}
