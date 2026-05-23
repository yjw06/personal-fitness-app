import { CheckSquare, Square, Trash2, X } from 'lucide-react'
import './SelectionToolbar.css'

/**
 * 선택 모드 진입/조작/삭제를 위한 공통 툴바
 *
 * props:
 *   enabled          선택 모드 활성 여부
 *   totalCount       전체 항목 수 (0이면 진입 버튼 숨김)
 *   selectedCount    현재 선택된 개수
 *   allSelected      모두 선택됐는지
 *   onEnable         선택 모드 켜기
 *   onCancel         선택 모드 끄기 (선택도 비움)
 *   onToggleAll      전체선택 토글
 *   onDelete         선택된 항목 삭제 (확인 후 호출)
 *   confirmText      삭제 확인 메시지 (기본: "선택된 N개를 삭제할까요?")
 *   enterLabel       선택 모드 진입 버튼 라벨 (기본: "선택")
 *   className        추가 클래스
 */
export default function SelectionToolbar({
  enabled,
  totalCount = 0,
  selectedCount = 0,
  allSelected = false,
  onEnable,
  onCancel,
  onToggleAll,
  onDelete,
  confirmText,
  enterLabel = '선택',
  className = '',
}) {
  if (totalCount === 0) return null

  if (!enabled) {
    return (
      <button
        type="button"
        className={`btn btn-ghost sel-enter-btn ${className}`}
        onClick={onEnable}
      >
        <CheckSquare size={14} /> {enterLabel}
      </button>
    )
  }

  const handleDelete = () => {
    if (selectedCount === 0) return
    const msg = confirmText ?? `선택된 ${selectedCount}개를 삭제할까요?`
    if (!confirm(msg)) return
    onDelete?.()
  }

  return (
    <div className={`selection-toolbar animate-fadeInUp ${className}`}>
      <button
        type="button"
        className="sel-all-btn"
        onClick={onToggleAll}
        aria-pressed={allSelected}
        title={allSelected ? '전체 해제' : '전체 선택'}
      >
        {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        <span>전체 선택</span>
      </button>

      <span className="sel-count">
        {selectedCount > 0
          ? <><strong>{selectedCount}</strong> / {totalCount}</>
          : `0 / ${totalCount}`}
      </span>

      <button
        type="button"
        className="btn btn-danger sel-delete-btn"
        onClick={handleDelete}
        disabled={selectedCount === 0}
      >
        <Trash2 size={14} /> 삭제
      </button>

      <button
        type="button"
        className="btn-icon sel-cancel-btn"
        onClick={onCancel}
        aria-label="선택 모드 종료"
        title="선택 모드 종료"
      >
        <X size={16} />
      </button>
    </div>
  )
}
