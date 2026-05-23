import { useEffect } from 'react'
import { X } from 'lucide-react'
import './EntryModal.css'

/**
 * 공용 모달 쉘 — 추가/편집 폼을 감싸는 컨테이너.
 * 자식이 form/필드/액션 버튼을 직접 그리도록 둠.
 *
 * props:
 *   open       boolean
 *   onClose    () => void
 *   title      string
 *   children   ReactNode
 *   wide       boolean (선택)  넓은 모달 (기본 false)
 */
export default function EntryModal({ open, onClose, title, children, wide = false }) {
  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="em-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={handleBackdrop}>
      <div className={`em-modal animate-fadeInUp ${wide ? 'em-wide' : ''}`}>
        <header className="em-header">
          <h2>{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
