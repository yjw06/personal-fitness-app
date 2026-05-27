import { useEffect, useRef, useCallback, useState } from 'react'
import { useWorkoutStore } from '../../stores/workoutStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  triggerRestEndAlert,
  clearRestAlert,
  unlockAudio,
  acquireWakeLock,
  releaseWakeLock,
  reacquireWakeLockIfNeeded,
  playTickSound,
} from '../../services/restAlert'
import { Volume2, VolumeX, Plus, Minus } from 'lucide-react'
import './RestTimer.css'

export default function RestTimer() {
  const {
    workoutData, currentIndex, currentSet, restSecondsLeft,
    restEndTime, tickRest, afterRest, extendRest,
  } = useWorkoutStore()

  const settings = useSettingsStore()
  const rafRef = useRef(null)
  const hasFiredRef = useRef(false)
  const lastTickSecondRef = useRef(null)
  const [alertActive, setAlertActive] = useState(false)

  // 휴식 종료 처리
  const handleEnd = useCallback(() => {
    if (hasFiredRef.current) return
    hasFiredRef.current = true

    const exercise = workoutData?.[currentIndex]
    triggerRestEndAlert({
      sound:        settings.soundEnabled,
      vibration:    settings.vibrateEnabled,
      notification: settings.notifyEnabled,
      volume:       settings.volume,
      repeat:       settings.repeatAlert,
      exerciseName: exercise?.exercise_name || '',
    })
    setAlertActive(true)
  }, [
    workoutData, currentIndex, currentSet,
    settings.soundEnabled,
    settings.vibrateEnabled, settings.notifyEnabled,
    settings.volume, settings.repeatAlert,
  ])

  // 카운트다운 (requestAnimationFrame)
  const tick = useCallback(() => {
    const endTime = restEndTime
    if (!endTime) return

    const now = Date.now()
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000))
    tickRest(remaining)

    // 마지막 3초 카운트 비프
    if (remaining > 0 && remaining <= 3 && lastTickSecondRef.current !== remaining) {
      lastTickSecondRef.current = remaining
      if (settings.soundEnabled) playTickSound(settings.volume * 0.6)
    }

    if (remaining <= 0) {
      handleEnd()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [restEndTime, tickRest, handleEnd, settings.soundEnabled, settings.volume])

  // 휴식 시작 시 — Wake Lock 획득 + 오디오 해제
  useEffect(() => {
    if (!restEndTime) return
    hasFiredRef.current = false
    lastTickSecondRef.current = null
    setAlertActive(false)

    unlockAudio()
    if (settings.wakeLockEnabled) acquireWakeLock()

    rafRef.current = requestAnimationFrame(tick)

    const onVisibility = () => {
      if (!document.hidden) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
        reacquireWakeLockIfNeeded()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      releaseWakeLock()
      clearRestAlert()
    }
  }, [restEndTime, tick, settings.wakeLockEnabled])

  // "다음 세트" 누르면 알림 중단 + 다음 세트로
  const handleNext = () => {
    clearRestAlert()
    setAlertActive(false)
    afterRest()
  }

  // ±15초 조절
  const handleAdjust = (delta) => {
    extendRest(delta)
  }

  const exercise = workoutData?.[currentIndex]
  const totalSets = parseInt(exercise?.sets) || 3
  const totalSec  = Math.max(1, parseInt(exercise?.rest_seconds) || 60)
  const pct       = Math.max(0, Math.min(100, Math.round(((totalSec - restSecondsLeft) / totalSec) * 100)))

  const R = 56
  const C = 2 * Math.PI * R
  const strokeDashoffset = C - (pct / 100) * C

  const mins = Math.floor(restSecondsLeft / 60)
  const secs = restSecondsLeft % 60
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}`

  return (
    <div className={`rest-timer animate-fadeInUp ${alertActive ? 'alert-active' : ''}`}>
      {alertActive && <div className="alert-flash" aria-hidden="true" />}

      <h2 className="rest-title">{alertActive ? '🔔 휴식 종료!' : '휴식 중 ☕'}</h2>
      <p className="rest-next">
        다음: <strong>{exercise?.exercise_name}</strong> · 세트 <strong>{currentSet}</strong> / {totalSets}
      </p>

      {/* 원형 타이머 */}
      <div className="timer-ring-wrap" role="timer" aria-label={`휴식 ${restSecondsLeft}초 남음`}>
        <svg className="timer-svg" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={R} className="ring-bg" />
          <circle
            cx="64" cy="64" r={R}
            className={`ring-fill ${alertActive ? 'ring-done' : ''} ${restSecondsLeft <= 3 && restSecondsLeft > 0 ? 'ring-warn' : ''}`}
            strokeDasharray={C}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="timer-center">
          <span className={`timer-seconds ${restSecondsLeft <= 3 && restSecondsLeft > 0 ? 'timer-warn' : ''}`}>
            {display}
          </span>
          <span className="timer-unit">{mins > 0 ? 'MIN' : 'SEC'}</span>
        </div>
      </div>

      {/* ± 시간 조절 */}
      <div className="rest-adjust-row">
        <button
          className="btn btn-ghost rest-adjust-btn"
          onClick={() => handleAdjust(-15)}
          aria-label="휴식 15초 줄이기"
          disabled={alertActive}
        >
          <Minus size={14} /> 15초
        </button>
        <button
          className="btn btn-ghost rest-adjust-btn"
          onClick={() => handleAdjust(15)}
          aria-label="휴식 15초 늘리기"
          disabled={alertActive}
        >
          <Plus size={14} /> 15초
        </button>
      </div>

      {/* 빠른 토글: 소리 on/off */}
      <button
        className="btn-icon rest-mute-btn"
        onClick={() => settings.update({ soundEnabled: !settings.soundEnabled })}
        aria-label={settings.soundEnabled ? '소리 끄기' : '소리 켜기'}
        title={settings.soundEnabled ? '소리 끄기' : '소리 켜기'}
      >
        {settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>

      {/* 메인 액션 버튼 */}
      <button
        id="btn-skip-rest"
        className={`btn ${alertActive ? 'btn-primary alert-btn' : 'btn-primary'} btn-full`}
        onClick={handleNext}
      >
        {alertActive ? '✓ 다음 세트 시작!' : '다음 세트 바로 시작 →'}
      </button>

      {/iPhone|iPad/i.test(navigator.userAgent) && (
        <p className="rest-ios-note">iOS는 진동·알림 미지원 — 화면 깜빡임으로 대체됩니다</p>
      )}
    </div>
  )
}
