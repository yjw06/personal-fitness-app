// AI 코치 슬래시 명령어 정의
//
// mode:
//   'json'       - 단일 작업. JSON Schema로 호출 후 자동 저장 (kind 필드 사용)
//   'json-multi' - 여러 작업 순차. (kinds 배열)
//   'chat'       - 자유 대화. prompt를 그대로 AI에 전달 (함수도 허용)
//   'client'     - 클라이언트에서 직접 처리 (AI 호출 X, 예: /도움)

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']
const todayDayKo = () => DAY_KO[new Date().getDay()]

export const COMMANDS = [
  {
    id: '오늘',
    aliases: ['생성', '고고'],
    icon: '⚡',
    label: '/오늘',
    description: '오늘의 운동 + 식단 + 스케줄을 한 번에 생성',
    mode: 'json-multi',
    kinds: ['workout', 'meal', 'schedule'],
  },
  {
    id: '운동',
    aliases: ['workout'],
    icon: '🏋️',
    label: '/운동',
    description: '오늘의 운동 루틴만 생성',
    mode: 'json',
    kind: 'workout',
  },
  {
    id: '식단',
    aliases: ['meal'],
    icon: '🥗',
    label: '/식단',
    description: '오늘의 식단만 생성',
    mode: 'json',
    kind: 'meal',
  },
  {
    id: '스케줄',
    aliases: ['일정'],
    icon: '📅',
    label: '/스케줄',
    description: '오늘의 일정 타임라인만 생성',
    mode: 'json',
    kind: 'schedule',
  },
  {
    id: '분석',
    aliases: ['analyze'],
    icon: '📊',
    label: '/분석',
    description: '최근 운동·체성분 패턴을 보고 조언',
    mode: 'chat',
    prompt: () => `오늘(${todayDayKo()}요일) 기준으로 최근 14일 운동 기록과 체성분 추세를 분석해줘. 부위별 빈도·미완료·강도 변화·체중 변화를 정리하고, 다음 주에 보완할 점을 짧게 제안해줘.`,
  },
  {
    id: '컨디션',
    aliases: ['condition'],
    icon: '💪',
    label: '/컨디션',
    description: '오늘 컨디션 묻고 조정 조언',
    mode: 'chat',
    prompt: () => `오늘(${todayDayKo()}요일) 컨디션이 어떤지 먼저 짧게 물어봐. 답변에 따라 ${todayDayKo()}요일 운동·식단·스케줄 조정안을 제안해줘. 부상이나 피로 같은 정보는 save_to_memory로 저장.`,
  },
  {
    id: '메모',
    aliases: ['memo', '기억'],
    icon: '🧠',
    label: '/메모',
    description: 'AI가 기억하고 있는 메모 조회',
    mode: 'chat',
    prompt: '지금까지 내가 알려준 정보 중 저장된 메모(부상, 일정, 선호 등)와 마스터플랜 요약을 짧게 정리해서 보여줘.',
  },
  {
    id: '도움',
    aliases: ['help', '명령어'],
    icon: '❓',
    label: '/도움',
    description: '사용 가능한 명령어 목록',
    mode: 'client',
  },
]

/**
 * 입력 텍스트가 명령어인지 매칭
 * "/오늘 무릎 시큰" → 첫 단어 "오늘" = 명령어, 나머지 "무릎 시큰" = extras
 */
export function parseCommand(text) {
  if (!text.startsWith('/')) {
    return { isCommand: false, command: null, query: '', extras: '' }
  }
  const rest = text.slice(1).trim()
  if (!rest) return { isCommand: true, command: null, query: '', extras: '' }

  // 첫 공백 기준 분리
  const spaceIdx = rest.search(/\s/)
  const firstWord = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
  const extras    = spaceIdx === -1 ? ''   : rest.slice(spaceIdx + 1).trim()
  const query     = firstWord.toLowerCase()

  const exact = COMMANDS.find(
    (c) => c.id.toLowerCase() === query || c.aliases?.some((a) => a.toLowerCase() === query)
  )
  return { isCommand: true, command: exact ?? null, query, extras }
}

/**
 * 부분 매칭 — 자동완성 드롭다운용
 */
export function searchCommands(query) {
  if (!query) return COMMANDS
  const q = query.toLowerCase()
  return COMMANDS.filter(
    (c) =>
      c.id.toLowerCase().startsWith(q) ||
      c.aliases?.some((a) => a.toLowerCase().startsWith(q))
  )
}

export function buildHelpMessage() {
  const lines = ['## 사용 가능한 명령어\n']
  COMMANDS.forEach((c) => {
    lines.push(`- **${c.label}** ${c.icon} — ${c.description}`)
  })
  lines.push('\n입력창에 `/` 를 입력하면 자동완성 메뉴가 뜹니다.')
  lines.push('\n💡 \`/오늘\`, \`/운동\`, \`/식단\`, \`/스케줄\` 은 AI가 만든 데이터를 **자동으로 저장**합니다.')
  return lines.join('\n')
}
