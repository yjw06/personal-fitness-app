import { useEffect, useRef, useCallback } from 'react'
import { useWorkoutStore } from '../../stores/workoutStore'
import './RestTimer.css'

// 알림 사운드 생성 (Web Audio API 기반 - 파일 필요 없음)
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // 3회 연속 비프음
    const playBeep = (startTime, freq, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.5, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    const now = ctx.currentTime
    playBeep(now, 880, 0.15)         // 높은 라
    playBeep(now + 0.2, 880, 0.15)
    playBeep(now + 0.4, 1108.73, 0.3) // 높은 도#
  } catch {
    // Audio API 미지원 시 무시
  }
}

export default function RestTimer() {
  const {
    workoutData, currentIndex, currentSet, restSecondsLeft,
    restEndTime, tickRest, afterRest,
  } = useWorkoutStore()

  const rafRef = useRef(null)
  const hasPlayedSound = useRef(false)

  // requestAnimationFrame 기반 카운트다운 (백그라운드에서도 정확)
  const tick = useCallback(() => {
    const now = Date.now()
    const endTime = restEndTime
    if (!endTime) return

    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000))
    tickRest(remaining)

    if (remaining <= 0) {
      if (!hasPlayedSound.current) {
        playAlertSound()
        // 진동도 시도 (모바일)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300])
        hasPlayedSound.current = true
      }
      setTimeout(afterRest, 600)
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [restEndTime, tickRest, afterRest])

  useEffect(() => {
    if (!restEndTime) return
    hasPlayedSound.current = false
    rafRef.current = requestAnimationFrame(tick)

    // 탭 복귀 시 즉시 동기화
    const onVisibility = () => {
      if (!document.hidden) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [restEndTime, tick])

  const exercise = workoutData?.[currentIndex]
  const totalSets = parseInt(exercise?.sets) || 3
  const totalSec  = parseInt(exercise?.rest_seconds) || 60
  const pct       = Math.round(((totalSec - restSecondsLeft) / totalSec) * 100)

  // 원형 SVG 진행 바
  const R = 56
  const C = 2 * Math.PI * R
  const strokeDashoffset = C - (pct / 100) * C

  return (
    <div className="rest-timer animate-fadeInUp">
      <h2 className="rest-title">휴식 중 ☕</h2>
      <p className="rest-next">
        세트 <strong>{currentSet}</strong> / {totalSets} 준비
      </p>

      {/* 원형 타이머 */}
      <div className="timer-ring-wrap" role="timer" aria-label={`휴식 ${restSecondsLeft}초 남음`}>
        <svg className="timer-svg" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={R} className="ring-bg" />
          <circle
            cx="64" cy="64" r={R}
            className="ring-fill"
            strokeDasharray={C}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="timer-center">
          <span className="timer-seconds">{restSecondsLeft}</span>
          <span className="timer-unit">SEC</span>
        </div>
      </div>

      {/* 건너뛰기 */}
      <button
        id="btn-skip-rest"
        className="btn btn-primary btn-full"
        onClick={afterRest}
      >
        다음 세트 바로 시작 →
      </button>
    </div>
  )
}
