// 볼륨 계산 순수 함수 — 볼륨 = 세트 × 평균반복 × 중량(kg)

/**
 * "10-12" → 11 | "8" → 8 | "최대 횟수" → null | "20분" → null
 */
export function parseAvgReps(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)$/)
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2
  const single = s.match(/^(\d+(?:\.\d+)?)$/)
  if (single) return parseFloat(single[1])
  return null
}

/**
 * 단일 운동 행의 볼륨(kg). 중량 미설정·러닝·시간제이면 null.
 */
export function calcExerciseVolume(exercise) {
  const sets   = parseInt(exercise.sets)
  const reps   = parseAvgReps(exercise.reps_or_duration)
  const weight = parseFloat(exercise.weight_kg)
  if (!sets || !reps || !weight || isNaN(weight)) return null
  return sets * reps * weight
}

/**
 * 부위별 볼륨 합산
 * @returns {{ [bodyPart: string]: number }}
 */
export function aggregateVolumeByPart(exercises) {
  const result = {}
  for (const ex of (exercises ?? [])) {
    const vol = calcExerciseVolume(ex)
    if (vol == null) continue
    result[ex.body_part] = (result[ex.body_part] ?? 0) + vol
  }
  return result
}

/** 전체 총 볼륨(kg) */
export function totalVolume(exercises) {
  return Object.values(aggregateVolumeByPart(exercises)).reduce((s, v) => s + v, 0)
}

/** "1,980" 형식 포맷 (소수점 없음) */
export function fmtVolume(n) {
  return Math.round(n).toLocaleString('ko-KR')
}
