import { useEffect, useRef } from 'react'
import { useWorkoutStore } from '../../stores/workoutStore'
import './RestTimer.css'

export default function RestTimer() {
  const {
    workoutData, currentIndex, currentSet, restSecondsLeft,
    tickRest, afterRest,
  } = useWorkoutStore()

  const intervalRef = useRef(null)

  // 카운트다운
  useEffect(() => {
    if (restSecondsLeft <= 0) {
      clearInterval(intervalRef.current)
      const t = setTimeout(afterRest, 500)
      return () => clearTimeout(t)
    }
    intervalRef.current = setInterval(tickRest, 1000)
    return () => clearInterval(intervalRef.current)
  }, [restSecondsLeft])

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
