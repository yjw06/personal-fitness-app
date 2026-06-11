// 점진적 과부하 판정 — 로컬 결정적 계산 (AI 불필요)
// 규칙 (기존 AI 프롬프트와 동일 기준):
//   - 같은 중량 2세션 이상 + 목표 횟수 달성(또는 횟수 기록 없음) → increase
//     상체 +2.5kg / 하체 +5kg
//   - 최근 2세션 연속 목표 횟수 미달 → decrease (현재 × 0.9, 2.5kg 단위)
//   - 첫 기록 → new (같은 중량 유지)
//   - 그 외 → hold
// 입력: fetchVolumeHistory 결과 [{ date, rows, completedReps }]

import { roundToPlate, isBodyweightExercise } from '../services/aiValidate'

const LOWER_BODY = new Set(['하체'])
const LOWER_NAME_RE = /스쿼트|데드\s*리프트|데드리프트|레그\s*|런지|카프|힙\s*쓰러스트|힙쓰러스트/

function isLowerBody(name = '', part = '') {
  return LOWER_BODY.has(part) || LOWER_NAME_RE.test(name)
}

// 세션의 실제 수행 횟수가 목표에 도달했는지 — 기록 없으면 null(불명)
function repsAchieved(row, exIdx, completedReps) {
  const repsMap = completedReps?.[exIdx]
  if (!repsMap || Object.keys(repsMap).length === 0) return null
  const target = parseInt(row.reps_or_duration)
  if (!Number.isFinite(target)) return null
  const actuals = Object.values(repsMap).map(Number).filter(Number.isFinite)
  if (!actuals.length) return null
  // 기록된 세트의 평균이 목표 이상이면 달성으로 본다
  const avg = actuals.reduce((a, b) => a + b, 0) / actuals.length
  return avg >= target
}

export function computeProgression(history = []) {
  // 운동명별 세션 시계열 수집 (날짜 오름차순 가정 — fetchVolumeHistory 순서)
  const byExercise = new Map()

  for (const { date, rows = [], completedReps = {} } of history) {
    rows.forEach((row, exIdx) => {
      const name = (row.exercise_name || '').trim()
      const weight = parseFloat(row.weight_kg)
      if (!name || !Number.isFinite(weight)) return
      if (row.body_part === '러닝' || isBodyweightExercise(name)) return

      if (!byExercise.has(name)) byExercise.set(name, [])
      byExercise.get(name).push({
        date,
        weight,
        part: row.body_part || '',
        achieved: repsAchieved(row, exIdx, completedReps),
      })
    })
  }

  const recommendations = []

  for (const [name, sessions] of byExercise) {
    sessions.sort((a, b) => a.date.localeCompare(b.date))
    const last = sessions[sessions.length - 1]
    const current = last.weight

    if (sessions.length === 1) {
      recommendations.push({
        exercise_name: name,
        current_kg: current,
        target_kg: current,
        status: 'new',
        reason: '첫 기록 — 다음 세션도 같은 중량으로 자세를 안정화하세요.',
      })
      continue
    }

    // 마지막 중량으로 연속 수행한 세션 수
    let streak = 0
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].weight === current) streak++
      else break
    }
    const streakSessions = sessions.slice(sessions.length - streak)
    const anyFailed  = streakSessions.some((s) => s.achieved === false)
    const lastTwoFailed = streakSessions.length >= 2 &&
      streakSessions.slice(-2).every((s) => s.achieved === false)

    if (lastTwoFailed) {
      const target = Math.max(roundToPlate(current * 0.9), 2.5)
      recommendations.push({
        exercise_name: name,
        current_kg: current,
        target_kg: target,
        status: 'decrease',
        reason: `${current}kg에서 2세션 연속 목표 횟수 미달 — ${target}kg로 낮춰 자세부터 회복하세요.`,
      })
    } else if (streak >= 2 && !anyFailed) {
      const inc = isLowerBody(name, last.part) ? 5 : 2.5
      const target = roundToPlate(current + inc)
      const hasRepData = streakSessions.some((s) => s.achieved === true)
      recommendations.push({
        exercise_name: name,
        current_kg: current,
        target_kg: target,
        status: 'increase',
        reason: `${current}kg ${streak}세션 연속 수행${hasRepData ? ' · 목표 횟수 달성' : ''} — ${inc}kg 증량을 제안해요.`,
      })
    } else {
      recommendations.push({
        exercise_name: name,
        current_kg: current,
        target_kg: current,
        status: 'hold',
        reason: streak >= 2
          ? `${current}kg 수행 중이나 일부 세트가 목표 횟수에 못 미쳤어요 — 한 세션 더 유지.`
          : `${current}kg는 최근 변경된 중량 — 2세션 이상 안정적으로 수행 후 증량하세요.`,
      })
    }
  }

  // 증량 → 신규 → 감량 → 유지 순으로 정렬 (실행할 것 먼저)
  const order = { increase: 0, new: 1, decrease: 2, hold: 3 }
  recommendations.sort((a, b) => order[a.status] - order[b.status])
  return recommendations
}
