import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import './ToastContainer.css'

const ICONS = {
  info:    Info,
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!toasts.length) return null

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="알림">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind] || Info
        return (
          <div key={t.id} className={`toast toast-${t.kind} animate-fadeInUp`} role="alert">
            <Icon size={18} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
