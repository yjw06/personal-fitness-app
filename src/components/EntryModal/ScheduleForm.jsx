import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

/**
 * 스케줄 항목 추가/편집 폼
 */
export default function ScheduleForm({ initial, onSubmit, onCancel }) {
  const [time, setTime]         = useState('')
  const [activity, setActivity] = useState('')
  const [detail, setDetail]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initial) {
      setTime(initial.time ?? '')
      setActivity(initial.activity ?? '')
      setDetail(initial.detail ?? '')
    }
  }, [initial])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activity.trim() || !time) return
    setSubmitting(true)
    try {
      await onSubmit({
        time,
        activity: activity.trim(),
        detail: detail.trim(),
        completed: initial?.completed ?? false,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="em-form" onSubmit={handleSubmit}>
      <div className="em-row">
        <label className="em-label" htmlFor="sch-time">시간 *</label>
        <input
          id="sch-time"
          className="em-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="em-row">
        <label className="em-label" htmlFor="sch-activity">활동 *</label>
        <input
          id="sch-activity"
          className="em-input"
          type="text"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="예: 운동, 식사, 스터디"
          required
        />
      </div>

      <div className="em-row">
        <label className="em-label" htmlFor="sch-detail">세부 (선택)</label>
        <textarea
          id="sch-detail"
          className="em-textarea"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="예: 헬스장에서 가슴 운동"
          rows={2}
        />
      </div>

      <div className="em-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !activity.trim() || !time}
        >
          <Save size={14} /> 저장
        </button>
      </div>
    </form>
  )
}
