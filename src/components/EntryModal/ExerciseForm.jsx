import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

const BODY_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '러닝']

/**
 * 운동 종목 추가/편집 폼
 * props:
 *   initial?  기존 행 (편집 모드)
 *   onSubmit  (row) => Promise
 *   onCancel  () => void
 */
export default function ExerciseForm({ initial, onSubmit, onCancel }) {
  const [name, setName]         = useState('')
  const [part, setPart]         = useState(BODY_PARTS[0])
  const [sets, setSets]         = useState('3')
  const [reps, setReps]         = useState('')
  const [rest, setRest]         = useState('60')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initial) {
      setName(initial.exercise_name ?? '')
      setPart(BODY_PARTS.includes(initial.body_part) ? initial.body_part : BODY_PARTS[0])
      setSets(String(initial.sets ?? '3'))
      setReps(String(initial.reps_or_duration ?? ''))
      setRest(String(initial.rest_seconds ?? '60'))
    }
  }, [initial])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        exercise_name: name.trim(),
        body_part: part,
        sets: String(parseInt(sets) || 3),
        reps_or_duration: reps.trim() || '8-10',
        rest_seconds: String(parseInt(rest) || 60),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="em-form" onSubmit={handleSubmit}>
      <div className="em-row">
        <label className="em-label" htmlFor="ex-name">운동 이름 *</label>
        <input
          id="ex-name"
          className="em-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 벤치프레스"
          required
          autoFocus
        />
      </div>

      <div className="em-row">
        <label className="em-label" htmlFor="ex-part">부위</label>
        <select
          id="ex-part"
          className="em-select"
          value={part}
          onChange={(e) => setPart(e.target.value)}
        >
          {BODY_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="em-row-grid">
        <div className="em-row">
          <label className="em-label" htmlFor="ex-sets">세트 수</label>
          <input
            id="ex-sets"
            className="em-input"
            type="number"
            inputMode="numeric"
            min="1"
            max="20"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </div>
        <div className="em-row">
          <label className="em-label" htmlFor="ex-reps">반복/시간</label>
          <input
            id="ex-reps"
            className="em-input"
            type="text"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder='예: "8-10" 또는 "20분"'
          />
        </div>
      </div>

      <div className="em-row">
        <label className="em-label" htmlFor="ex-rest">세트 간 휴식 (초)</label>
        <input
          id="ex-rest"
          className="em-input"
          type="number"
          inputMode="numeric"
          min="0"
          max="600"
          step="5"
          value={rest}
          onChange={(e) => setRest(e.target.value)}
        />
      </div>

      <div className="em-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
          <Save size={14} /> 저장
        </button>
      </div>
    </form>
  )
}
