import Papa from 'papaparse'
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import { parseAndValidate, SCHEMAS } from './csvSchema'

/*
  Firestore 구조:
  users/{uid}/workouts/{YYYYMMDD}  → { rows: [...], updatedAt: timestamp }
  users/{uid}/meals/{YYYYMMDD}     → { rows: [...], updatedAt: timestamp }
  users/{uid}/schedules/{YYYYMMDD} → { rows: [...], updatedAt: timestamp }
  users/{uid}/body/{YYYYMMDD}      → { rows: [...], updatedAt: timestamp }
*/

// ─── CSV 파싱 헬퍼 ────────────────────────────────────────────
const parseCSV = (text) =>
  Papa.parse(text, { header: true, skipEmptyLines: true }).data

// ─── Firestore 경로 헬퍼 ─────────────────────────────────────
const workoutDoc  = (uid, date) => doc(db, 'users', uid, 'workouts',  date)
const mealDoc     = (uid, date) => doc(db, 'users', uid, 'meals',     date)
const scheduleDoc = (uid, date) => doc(db, 'users', uid, 'schedules', date)
const bodyDoc     = (uid, date) => doc(db, 'users', uid, 'body',      date)
const memoryDoc   = (uid)       => doc(db, 'users', uid, 'memory',    'master')

// ─── AI 메모리 (Firestore: users/{uid}/memory/master) ────────
export async function fetchMemory(uid) {
  try {
    const snap = await getDoc(memoryDoc(uid))
    return snap.exists() ? snap.data() : null
  } catch (err) {
    console.error('[fetchMemory]', err)
    return null
  }
}

export async function saveMemory(uid, patch) {
  await setDoc(memoryDoc(uid), {
    ...patch,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

// ─── Download (Firestore에서 읽기) ────────────────────────────
export async function fetchWorkout(uid, date) {
  try {
    const snap = await getDoc(workoutDoc(uid, date))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      rows: data.rows,
      completedSets: data.completedSets || {},
      completedReps: data.completedReps || {},
    }
  } catch (err) {
    console.error('[fetchWorkout]', err)
    throw err
  }
}

export async function fetchMeal(uid, date) {
  try {
    const snap = await getDoc(mealDoc(uid, date))
    return snap.exists() ? snap.data().rows : null
  } catch (err) {
    console.error('[fetchMeal]', err)
    throw err
  }
}

export async function fetchSchedule(uid, date) {
  try {
    const snap = await getDoc(scheduleDoc(uid, date))
    return snap.exists() ? snap.data().rows : null
  } catch (err) {
    console.error('[fetchSchedule]', err)
    throw err
  }
}

export async function fetchBody(uid, date) {
  try {
    const snap = await getDoc(bodyDoc(uid, date))
    return snap.exists() ? snap.data().rows : null
  } catch (err) {
    console.error('[fetchBody]', err)
    throw err
  }
}

// ─── Upload + 스키마 검증 ────────────────────────────────────
// 반환: { ok: boolean, error?: string }
async function uploadWithSchema(uid, date, csvText, kind, docRef) {
  const result = parseAndValidate(csvText, kind)
  if (!result.ok) return result

  try {
    await setDoc(docRef(uid, date), {
      rows: result.rows,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true, count: result.rows.length }
  } catch (err) {
    return { ok: false, error: `저장 실패: ${err.message || err}` }
  }
}

export async function uploadWorkoutCSV(uid, date, csvText) {
  return uploadWithSchema(uid, date, csvText, 'workout', workoutDoc)
}

export async function uploadMealCSV(uid, date, csvText) {
  return uploadWithSchema(uid, date, csvText, 'meal', mealDoc)
}

export async function uploadScheduleCSV(uid, date, csvText) {
  return uploadWithSchema(uid, date, csvText, 'schedule', scheduleDoc)
}

export async function uploadBodyCSV(uid, date, csvText) {
  return uploadWithSchema(uid, date, csvText, 'body', bodyDoc)
}

// ─── 직접 데이터 저장 (파싱 없이 배열) ────────────────────────
export async function saveWorkoutData(uid, date, rows) {
  await setDoc(workoutDoc(uid, date), { rows, updatedAt: new Date().toISOString() })
}

export async function saveWorkoutProgress(uid, date, completedSets, completedReps) {
  try {
    await setDoc(workoutDoc(uid, date), {
      completedSets,
      ...(completedReps != null && { completedReps }),
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (err) {
    console.error('[saveWorkoutProgress]', err)
  }
}

export async function saveMealData(uid, date, rows) {
  await setDoc(mealDoc(uid, date), { rows, updatedAt: new Date().toISOString() })
}

export async function saveScheduleData(uid, date, rows) {
  await setDoc(scheduleDoc(uid, date), { rows, updatedAt: new Date().toISOString() })
}

export async function saveBodyData(uid, date, rows) {
  await setDoc(bodyDoc(uid, date), { rows, updatedAt: new Date().toISOString() })
}

// ─── Delete ──────────────────────────────────────────────────
export async function deleteWorkout(uid, date)  { await deleteDoc(workoutDoc(uid, date))  }
export async function deleteMeal(uid, date)     { await deleteDoc(mealDoc(uid, date))     }
export async function deleteSchedule(uid, date) { await deleteDoc(scheduleDoc(uid, date)) }
export async function deleteBody(uid, date)     { await deleteDoc(bodyDoc(uid, date))     }

// ─── 사용 가능한 날짜 목록 조회 ──────────────────────────────
export async function listAvailableDates(uid) {
  const dates = new Set()

  for (const sub of ['workouts', 'meals', 'schedules', 'body']) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub))
      snap.forEach((d) => dates.add(d.id))
    } catch (err) {
      console.error(`[listAvailableDates:${sub}]`, err)
    }
  }

  return Array.from(dates).sort().reverse()
}

// 종류별 날짜 목록 (히스토리/볼륨 차트용)
export async function listDatesByKind(uid, kind) {
  const collMap = { workout: 'workouts', meal: 'meals', schedule: 'schedules', body: 'body' }
  const coll = collMap[kind]
  if (!coll) return []
  try {
    const snap = await getDocs(collection(db, 'users', uid, coll))
    return snap.docs.map((d) => d.id).sort().reverse()
  } catch (err) {
    console.error(`[listDatesByKind:${kind}]`, err)
    return []
  }
}

// 기간별 운동 데이터 일괄 조회 (히스토리 차트용)
export async function fetchWorkoutRange(uid, startDate, endDate) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'workouts'))
    const result = []
    snap.forEach((d) => {
      if (d.id >= startDate && d.id <= endDate) {
        result.push({ date: d.id, ...d.data() })
      }
    })
    return result.sort((a, b) => a.date.localeCompare(b.date))
  } catch (err) {
    console.error('[fetchWorkoutRange]', err)
    return []
  }
}

// 모든 체성분 기록 조회 (체중 추이 차트용)
export async function fetchAllBody(uid) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'body'))
    const result = []
    snap.forEach((d) => {
      const data = d.data()
      if (Array.isArray(data.rows)) {
        data.rows.forEach((row) => result.push(row))
      }
    })
    return result.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  } catch (err) {
    console.error('[fetchAllBody]', err)
    return []
  }
}

// ─── File → CSV Text 변환 ─────────────────────────────────────
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * 최근 N일의 운동 데이터를 병렬 조회
 * @returns {Promise<Array<{ date: string, rows: object[] }>>} 오래된 날짜 → 최신 순
 */
export async function fetchVolumeHistory(uid, days = 14) {
  const today = new Date()
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - 1 - i))  // oldest first
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  })
  const snaps = await Promise.all(dates.map((date) => fetchWorkout(uid, date)))
  return dates.map((date, i) => ({
    date,
    rows: snaps[i]?.rows ?? [],
    completedSets: snaps[i]?.completedSets ?? {},
    completedReps: snaps[i]?.completedReps ?? {},
  }))
}

export { parseCSV, SCHEMAS }
