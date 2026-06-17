// 날짜 유틸 — 모두 "로컬 타임존" 기준.
// 주의: new Date().toISOString()은 UTC라서 KST(UTC+9) 자정~오전 9시 사이에는
//       날짜가 전날로 밀린다. 그래서 '오늘' 계산은 반드시 이 유틸을 쓸 것.

/** Date → 로컬 기준 YYYYMMDD 문자열 */
export function toYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** 오늘 날짜를 로컬 기준 YYYYMMDD 문자열로 반환 */
export function todayYMD() {
  return toYMD(new Date())
}

/** 오늘로부터 n일 전의 YYYYMMDD (로컬 기준) */
export function ymdMinusDays(n) {
  const date = new Date()
  date.setDate(date.getDate() - n)
  return toYMD(date)
}
