import { useCallback, useState } from 'react'

/**
 * 다중 선택 상태 관리 훅
 * @param {Array<string|number>} allIds  전체 항목 ID 배열 (전체 선택 판별용)
 *
 * 반환:
 *   enabled        선택 모드 여부
 *   selected       Set<id>
 *   size           선택된 개수
 *   isSelected(id) 해당 ID가 선택됐는지
 *   isAllSelected  현재 enabled 상태에서 전체 선택됐는지
 *   toggle(id)     단일 항목 토글
 *   toggleAll(allIds?) 전체 선택/해제 (인자 없으면 hook 인자의 allIds 사용)
 *   enable()       선택 모드 켜기
 *   disable()      선택 모드 끄고 선택 비우기
 *   clear()        선택만 비움
 *   setMany(ids)   선택을 임의로 교체
 */
export function useSelection(allIds = []) {
  const [enabled, setEnabled] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((overrideIds) => {
    const ids = overrideIds ?? allIds
    setSelected((prev) => {
      // 모두 선택돼 있으면 비우고, 아니면 모두 선택
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id))
      return allOn ? new Set() : new Set(ids)
    })
  }, [allIds])

  const clear  = useCallback(() => setSelected(new Set()), [])
  const enable = useCallback(() => setEnabled(true), [])
  const disable = useCallback(() => {
    setEnabled(false)
    setSelected(new Set())
  }, [])
  const setMany = useCallback((ids) => setSelected(new Set(ids)), [])

  const isSelected = useCallback((id) => selected.has(id), [selected])
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  return {
    enabled,
    selected,
    size: selected.size,
    isSelected,
    isAllSelected,
    toggle,
    toggleAll,
    enable,
    disable,
    clear,
    setMany,
  }
}
