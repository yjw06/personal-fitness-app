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

/** 러닝 여부 */
export function isCardio(exercise) {
  return exercise?.body_part === '러닝'
}

// 명시적으로 맨몸 운동인 종목 키워드 (weight_kg 없을 때만 체중 적용)
const BODYWEIGHT_KEYWORDS = [
  '팔굽혀펴기', '푸시업', '푸쉬업',
  '딥스',
  '턱걸이', '풀업',
  '크런치', '윗몸일으키기', '싯업',
  '버피',
  '플랭크',
  '마운틴클라이머', '마운틴 클라이머',
  '레그레이즈', '힙레이즈', '글루트브릿지', '글루트 브릿지',
  'push-up', 'pushup', 'push up',
  'dip', 'pull-up', 'pullup', 'chin-up', 'chinup',
  'crunch', 'plank', 'burpee', 'leg raise', 'mountain climber',
  'sit-up', 'situp', 'glute bridge',
]

/** 명시적 맨몸 운동 여부 — weight_kg 없고 키워드 or 코어 부위면 체중으로 볼륨 계산 */
export function isBodyweightExercise(exercise) {
  if (exercise?.weight_kg != null) return false
  if (isCardio(exercise) || isAssistExercise(exercise)) return false
  // 코어 부위는 중량 미설정이면 맨몸으로 처리 (케이블 크런치 등 중량 있는 경우는 위에서 제외됨)
  if (exercise?.body_part === '코어') return true
  const name = (exercise?.exercise_name ?? '').toLowerCase()
  return BODYWEIGHT_KEYWORDS.some((kw) => name.includes(kw))
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
    return sets * reps * rawW
  }

  // 명시적 맨몸 운동 키워드 매칭 시에만 체중으로 계산 (중량 미입력 운동은 제외)
  if (isBodyweightExercise(exercise) && bodyWeight && bodyWeight > 0) {
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
