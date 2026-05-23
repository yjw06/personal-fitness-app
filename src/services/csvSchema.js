// CSV 스키마 검증 — 업로드 전 필수 컬럼 누락 여부 확인

import Papa from 'papaparse'

export const SCHEMAS = {
  workout: {
    required: ['exercise_name', 'body_part', 'sets', 'reps_or_duration', 'rest_seconds'],
    label: '운동',
    hint: 'exercise_name,body_part,sets,reps_or_duration,rest_seconds',
  },
  meal: {
    required: ['meal_type', 'food_name'],
    optional: ['meal_time', 'protein_g', 'carbs_g', 'fat_g', 'calories', 'protein_target', 'carbs_target', 'fat_target'],
    label: '식단',
    hint: 'meal_type,meal_time,food_name,protein_g,carbs_g,fat_g,calories',
  },
  schedule: {
    required: ['time', 'activity'],
    optional: ['detail', 'completed'],
    label: '스케줄',
    hint: 'time,activity,detail,completed',
  },
  body: {
    required: ['date'],
    optional: ['weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'bmi', 'water_pct'],
    label: '체성분',
    hint: 'date,weight_kg,body_fat_pct,muscle_mass_kg',
  },
}

/**
 * CSV 텍스트를 파싱하고 필수 컬럼 검증
 * @returns {{ ok: boolean, error?: string, rows?: any[] }}
 */
export function parseAndValidate(csvText, kind) {
  const schema = SCHEMAS[kind]
  if (!schema) return { ok: false, error: `알 수 없는 CSV 종류: ${kind}` }

  if (!csvText || !csvText.trim()) {
    return { ok: false, error: 'CSV 파일이 비어있습니다.' }
  }

  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  if (result.errors?.length) {
    const firstErr = result.errors[0]
    return { ok: false, error: `CSV 파싱 오류: ${firstErr.message}` }
  }

  const rows = result.data
  if (!rows.length) {
    return { ok: false, error: 'CSV에 데이터 행이 없습니다.' }
  }

  // 헤더 검증
  const headers = result.meta?.fields || []
  const missing = schema.required.filter((col) => !headers.includes(col))

  if (missing.length) {
    return {
      ok: false,
      error: `필수 컬럼 누락: ${missing.join(', ')}\n예시: ${schema.hint}`,
    }
  }

  return { ok: true, rows }
}
