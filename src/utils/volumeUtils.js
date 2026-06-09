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
 * 어시스트 머신 여부 — 이름에 "어시스트" 또는 "assist" 포함
 * 실제 사용 중량 = 체중 - 어시스트중량
 */
export function isAssistExercise(exercise) {
  const name = (exercise?.exercise_name ?? '').toLowerCase()
  return name.includes('어시스트') || name.includes('assist')
}

/**
 * 단일 운동 행의 볼륨(kg). 러닝·시간제이면 null.
 * @param {object} exercise
 * @param {number|null} bodyWeight - 사용자 체중(kg). 맨몸·어시스트 운동 계산에 필요.
 */
export function calcExerciseVolume(exercise, bodyWeight = null) {
  const sets = parseInt(exercise.sets)
  const reps = parseAvgReps(exercise.reps_or_duration)
  if (!sets || !reps) return null

  if (isCardio(exercise)) return null

  const rawW = parseFloat(exercise.weight_kg)

  if (isAssistExercise(exercise)) {
    // 어시스트 머신: 실제 중량 = 체중 - 보조중량
    if (!bodyWeight || isNaN(rawW) || bodyWeight <= rawW) return null
    return sets * reps * (bodyWeight - rawW)
  }

  if (!isNaN(rawW) && rawW > 0) {
    // 일반 중량 운동
    return sets * reps * rawW
  }

  // 맨몸 운동 (weight_kg 없음) — 체중이 등록된 경우 체중으로 계산
  if (bodyWeight && bodyWeight > 0) {
    return sets * reps * bodyWeight
  }

  return null
}

/**
 * 부위별 볼륨 합산
 * @param {object[]} exercises
 * @param {number|null} bodyWeight - 사용자 체중(kg)
 * @returns {{ [bodyPart: string]: number }}
 */
export function aggregateVolumeByPart(exercises, bodyWeight = null) {
  const result = {}
  for (const ex of (exercises ?? [])) {
    const vol = calcExerciseVolume(ex, bodyWeight)
    if (vol == null) continue
    result[ex.body_part] = (result[ex.body_part] ?? 0) + vol
  }
  return result
}

/** 전체 총 볼륨(kg) */
export function totalVolume(exercises, bodyWeight = null) {
  return Object.values(aggregateVolumeByPart(exercises, bodyWeight)).reduce((s, v) => s + v, 0)
}

/** "1,980" 형식 포맷 (소수점 없음) */
export function fmtVolume(n) {
  return Math.round(n).toLocaleString('ko-KR')
}

/** 러닝 여부 */
export function isCardio(exercise) {
  return exercise?.body_part === '러닝'
}

/**
 * 맨몸 운동 rep 볼륨: sets × avgReps (중량 없음, 러닝 아님)
 * 중량 있거나 러닝이면 null
 */
export function calcRepVolume(exercise) {
  if (exercise?.weight_kg != null || isCardio(exercise)) return null
  const sets = parseInt(exercise?.sets)
  const reps = parseAvgReps(exercise?.reps_or_duration)
  if (!sets || !reps) return null
  return sets * reps
}
