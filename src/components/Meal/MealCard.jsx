import './MealCard.css'

const MEAL_META = {
  breakfast: { label: '아침',  emoji: '☀️', colorVar: '--color-breakfast' },
  lunch:     { label: '점심',  emoji: '⚡', colorVar: '--color-lunch'     },
  dinner:    { label: '저녁',  emoji: '🌙', colorVar: '--color-dinner'    },
  snack:     { label: '간식',  emoji: '🍎', colorVar: '--color-warning'   },
  supplement:{ label: '보충제', emoji: '💊', colorVar: '--color-info'      },
}

/**
 * @param {{ items: object[], type: string, onDelete?: () => void }} props
 * items: 같은 meal_type의 CSV 행 배열
 */
export default function MealCard({ type, items = [], onDelete }) {
  if (!items.length) return null

  const meta = MEAL_META[type] ?? { label: type, emoji: '🍽️', colorVar: '--color-primary' }

  const totalCalories = items.reduce((s, r) => s + (parseFloat(r.calories) || 0), 0)
  const totalProtein  = items.reduce((s, r) => s + (parseFloat(r.protein_g) || 0), 0)
  const totalCarbs    = items.reduce((s, r) => s + (parseFloat(r.carbs_g)   || 0), 0)
  const totalFat      = items.reduce((s, r) => s + (parseFloat(r.fat_g)     || 0), 0)

  const mealTime = items[0]?.meal_time ?? ''

  return (
    <article
      className="meal-card animate-fadeInUp"
      style={{ '--accent': `var(${meta.colorVar})` }}
      aria-label={`${meta.label} 식사 정보`}
    >
      {/* 헤더 */}
      <div className="meal-card-header">
        <div className="meal-card-title">
          <span className="meal-emoji" aria-hidden="true">{meta.emoji}</span>
          <div>
            <h2 className="meal-label">{meta.label}</h2>
            {mealTime && <p className="meal-time">{mealTime}</p>}
          </div>
        </div>
        <div className="meal-card-right">
          <span className="meal-calories">{Math.round(totalCalories)} kcal</span>
          {onDelete && (
            <button
              id={`btn-delete-meal-${type}`}
              className="btn-icon meal-delete"
              onClick={onDelete}
              aria-label={`${meta.label} 식단 삭제`}
              title="이 식단 삭제"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* 음식 목록 */}
      <ul className="food-list" role="list">
        {items.map((item, i) => (
          <li key={i} className="food-item">
            <span className="food-name">{item.food_name}</span>
            {item.calories && (
              <span className="food-cal">{Math.round(parseFloat(item.calories))} kcal</span>
            )}
          </li>
        ))}
      </ul>

      {/* 매크로 바 */}
      {(totalProtein + totalCarbs + totalFat) > 0 && (
        <div className="macro-row">
          <MacroChip label="단백질" value={totalProtein} color="var(--color-success)" unit="g" />
          <MacroChip label="탄수화물" value={totalCarbs}   color="var(--color-warning)" unit="g" />
          <MacroChip label="지방"   value={totalFat}     color="var(--color-danger)"  unit="g" />
        </div>
      )}
    </article>
  )
}

function MacroChip({ label, value, color, unit }) {
  return (
    <div className="macro-chip" style={{ '--chip-color': color }}>
      <span className="macro-value">{Math.round(value)}<small>{unit}</small></span>
      <span className="macro-label">{label}</span>
    </div>
  )
}
