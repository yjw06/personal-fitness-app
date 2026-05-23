// 활동 텍스트에서 카테고리(아이콘 + 컬러)를 자동 추정
// 키워드 매칭 — 매칭 순서가 우선순위

const RULES = [
  { kw: ['아침'],                                     emoji: '☀️', color: '#fbbf24', label: 'morning' },
  { kw: ['점심'],                                     emoji: '⚡',  color: '#22c55e', label: 'lunch'   },
  { kw: ['저녁', '디너'],                              emoji: '🌙', color: '#a78bfa', label: 'dinner'  },
  { kw: ['간식', '스낵'],                              emoji: '🍪', color: '#f59e0b', label: 'snack'   },
  { kw: ['보충제', '프로틴', 'wpi', 'whey', '크레아틴'], emoji: '💊', color: '#06b6d4', label: 'supp'    },
  { kw: ['식사', '먹', '식단'],                        emoji: '🍽️', color: '#34d399', label: 'meal'    },
  { kw: ['헬스', '웨이트', '운동', '근력', '벤치', '데드', '스쿼트', '풀업', '딥스'], emoji: '🏋️', color: '#ef4444', label: 'workout' },
  { kw: ['러닝', '뛰기', '조깅', '달리', '유산소', '인터벌', '템포'],             emoji: '🏃', color: '#f97316', label: 'cardio'  },
  { kw: ['스트레칭', '폼롤러', '요가', '회복'],            emoji: '🧘', color: '#8b5cf6', label: 'recovery'},
  { kw: ['샤워'],                                     emoji: '🚿', color: '#0ea5e9', label: 'shower'  },
  { kw: ['수면', '취침', '잠', '자기'],                   emoji: '🛌', color: '#64748b', label: 'sleep'   },
  { kw: ['기상', '일어'],                               emoji: '🌅', color: '#fb923c', label: 'wake'    },
  { kw: ['공부', '스터디', '독서'],                       emoji: '📚', color: '#3b82f6', label: 'study'  },
  { kw: ['코딩', '개발', '작업', '프로젝트'],             emoji: '💻', color: '#0ea5e9', label: 'work'   },
  { kw: ['회의', '미팅'],                              emoji: '💬', color: '#6366f1', label: 'meeting' },
  { kw: ['약속', '만남'],                              emoji: '🤝', color: '#ec4899', label: 'social'  },
  { kw: ['이동', '출근', '퇴근', '버스', '지하철'],        emoji: '🚇', color: '#94a3b8', label: 'commute' },
  { kw: ['샤워'],                                     emoji: '🚿', color: '#06b6d4', label: 'shower'  },
  { kw: ['휴식', '쉬', '낮잠'],                         emoji: '☕',  color: '#a3a3a3', label: 'rest'   },
]

const DEFAULT = { emoji: '📌', color: '#a3a3a3', label: 'default' }

export function categorizeActivity(activity = '', detail = '') {
  const text = `${activity} ${detail}`.toLowerCase()
  for (const rule of RULES) {
    if (rule.kw.some((k) => text.includes(k.toLowerCase()))) return rule
  }
  return DEFAULT
}

// "HH:MM" → 분
export function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

// 두 시간 사이 간격을 "1시간 30분" 형태로
export function formatGap(fromMin, toMin) {
  const diff = toMin - fromMin
  if (diff <= 0) return null
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h && m) return `${h}시간 ${m}분 후`
  if (h)      return `${h}시간 후`
  return `${m}분 후`
}
