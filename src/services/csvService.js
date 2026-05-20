import Papa from 'papaparse'
import {
  doc, setDoc, getDoc, deleteDoc, updateDoc,
  collection, getDocs,
} from 'firebase/firestore'
import { db } from './firebase'

/*
  Firestore 구조:
  users/{uid}/workouts/{YYYYMMDD}  → { rows: [...], updatedAt: timestamp }
  users/{uid}/meals/{YYYYMMDD}     → { rows: [...], updatedAt: timestamp }
  users/{uid}/schedules/{YYYYMMDD} → { rows: [...], updatedAt: timestamp }
*/

// ─── CSV 파싱 헬퍼 ────────────────────────────────────────────
const parseCSV = (text) =>
  Papa.parse(text, { header: true, skipEmptyLines: true }).data

// ─── Firestore 경로 헬퍼 ─────────────────────────────────────
const workoutDoc = (uid, date) => doc(db, 'users', uid, 'workouts', date)
const mealDoc    = (uid, date) => doc(db, 'users', uid, 'meals', date)
const scheduleDoc = (uid, date) => doc(db, 'users', uid, 'schedules', date)

// ─── Download (Firestore에서 읽기) ────────────────────────────
export async function fetchWorkout(uid, date) {
  try {
    const snap = await getDoc(workoutDoc(uid, date))
    if (!snap.exists()) return null
    const data = snap.data()
    return { rows: data.rows, completedSets: data.completedSets || {} }
  } catch {
    return null
  }
}

export async function fetchMeal(uid, date) {
  try {
    const snap = await getDoc(mealDoc(uid, date))
    return snap.exists() ? snap.data().rows : null
  } catch {
    return null
  }
}

export async function fetchSchedule(uid, date) {
  try {
    const snap = await getDoc(scheduleDoc(uid, date))
    return snap.exists() ? snap.data().rows : null
  } catch {
    return null
  }
}

// ─── Upload (CSV 텍스트 → 파싱 → Firestore에 저장, 자동 덮어쓰기) ──
export async function uploadWorkoutCSV(uid, date, csvText) {
  const rows = parseCSV(csvText)
  await setDoc(workoutDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

export async function uploadMealCSV(uid, date, csvText) {
  const rows = parseCSV(csvText)
  await setDoc(mealDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

export async function uploadScheduleCSV(uid, date, csvText) {
  const rows = parseCSV(csvText)
  await setDoc(scheduleDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

// ─── 직접 데이터 저장 (파싱 없이 배열 직접 저장) ─────────────
export async function saveWorkoutData(uid, date, rows) {
  await setDoc(workoutDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

// ─── 운동 진행 상태만 저장 (completedSets) ────────────────────
export async function saveWorkoutProgress(uid, date, completedSets) {
  try {
    await updateDoc(workoutDoc(uid, date), {
      completedSets,
      updatedAt: new Date().toISOString(),
    })
  } catch {
    // 문서가 아직 없는 경우 무시
  }
}

export async function saveMealData(uid, date, rows) {
  await setDoc(mealDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

export async function saveScheduleData(uid, date, rows) {
  await setDoc(scheduleDoc(uid, date), {
    rows,
    updatedAt: new Date().toISOString(),
  })
}

// ─── Delete ──────────────────────────────────────────────────
export async function deleteWorkout(uid, date) {
  await deleteDoc(workoutDoc(uid, date))
}

export async function deleteMeal(uid, date) {
  await deleteDoc(mealDoc(uid, date))
}

export async function deleteSchedule(uid, date) {
  await deleteDoc(scheduleDoc(uid, date))
}

// ─── 사용 가능한 날짜 목록 조회 ──────────────────────────────
export async function listAvailableDates(uid) {
  const dates = new Set()

  const workoutSnap = await getDocs(collection(db, 'users', uid, 'workouts'))
  workoutSnap.forEach((d) => dates.add(d.id))

  const mealSnap = await getDocs(collection(db, 'users', uid, 'meals'))
  mealSnap.forEach((d) => dates.add(d.id))

  const scheduleSnap = await getDocs(collection(db, 'users', uid, 'schedules'))
  scheduleSnap.forEach((d) => dates.add(d.id))

  return Array.from(dates).sort().reverse()
}

// ─── File → CSV Text 변환 (앱 내 수동 업로드용) ──────────────
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}
