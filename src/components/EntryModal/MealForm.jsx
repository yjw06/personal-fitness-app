import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

const MEAL_TYPES = [
  { value: 'breakfast',  label: '☀️ 아침' },
  { value: 'lunch',      label: '⚡ 점심' },
  { value: 'dinner',     label: '🌙 저녁' },
  { value: 'snack',      label: '🍎 간식 (과일, 음료 등)' },
  { value: 'supplement', label: '💊 보충제 (단백질, 크레아틴 등)' },
]

/**
 * 식사 추가/편집 폼
 */
export default function MealForm({ initial, onSubmit, onCancel }) {
  const [mealType, setMealType] = useState('breakfast')
  const [mealTime, setMealTime] = useState('')
  const [foodName, setFoodName] = useState('')
  const [protein, setProtein]   = useState('')
  const [carbs, setCarbs]       = useState('')
  const [fat, setFat]           = useState('')
  const [calories, setCalories] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initial) {
      setMealType(MEAL_TYPES.find((m) => m.value === initial.meal_type)?.value ?? 'breakfast')
      setMealTime(initial.meal_time ?? '')
      setFoodName(initial.food_name ?? '')
      setProtein(initial.protein_g != null ? String(initial.protein_g) : '')
      setCarbs(initial.carbs_g     != null ? String(initial.carbs_g)   : '')
      setFat(initial.fat_g         != null ? String(initial.fat_g)     : '')
      setCalories(initial.calories != null ? String(initial.calories)  : '')
    }
  }, [initial])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!foodName.trim()) return
    setSubmitting(true)
    try {
      const row = {
        meal_type: mealType,
        food_name: foodName.trim(),
        ...(mealTime && { meal_time: mealTime }),
        ...(protein  && { protein_g: parseFloat(protein) }),
        ...(carbs    && { carbs_g:   parseFloat(carbs) }),
        ...(fat      && { fat_g:     parseFloat(fat) }),
        ...(calories && { calories:  parseFloat(calories) }),
      }
      // 기존 행 편집 시 protein_target 등 추가 필드 보존
      if (initial) {
        ['protein_target', 'carbs_target', 'fat_target', 'calorie_target'].forEach((k) => {
          if (initial[k] != null) row[k] = initial[k]
        })
      }
      await onSubmit(row)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="em-form" onSubmit={handleSubmit}>
      <div className="em-row-grid">
        <div className="em-row">
          <label className="em-label" htmlFor="meal-type">끼니</label>
          <select
            id="meal-type"
            className="em-select"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
          >
            {MEAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="em-row">
          <label className="em-label" htmlFor="meal-time">시간</label>
          <input
            id="meal-time"
            className="em-input"
            type="time"
            value={mealTime}
            onChange={(e) => setMealTime(e.target.value)}
          />
        </div>
      </div>

      <div className="em-row">
        <label className="em-label" htmlFor="meal-name">음식 이름 *</label>
        <input
          id="meal-name"
          className="em-input"
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="예: 닭가슴살 200g"
          required
          autoFocus
        />
      </div>

      <div className="em-row-grid">
        <div className="em-row">
          <label className="em-label" htmlFor="meal-protein">단백질 (g)</label>
          <input
            id="meal-protein" className="em-input"
            type="number" step="0.1" inputMode="decimal"
            value={protein} onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="em-row">
          <label className="em-label" htmlFor="meal-cal">칼로리 (kcal)</label>
          <input
            id="meal-cal" className="em-input"
            type="number" step="1" inputMode="decimal"
            value={calories} onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="em-row-grid">
        <div className="em-row">
          <label className="em-label" htmlFor="meal-carbs">탄수화물 (g)</label>
          <input
            id="meal-carbs" className="em-input"
            type="number" step="0.1" inputMode="decimal"
            value={carbs} onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="em-row">
          <label className="em-label" htmlFor="meal-fat">지방 (g)</label>
          <input
            id="meal-fat" className="em-input"
            type="number" step="0.1" inputMode="decimal"
            value={fat} onChange={(e) => setFat(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="em-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting || !foodName.trim()}>
          <Save size={14} /> 저장
        </button>
      </div>
    </form>
  )
}
