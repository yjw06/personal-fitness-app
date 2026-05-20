import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchMeal, deleteMeal, uploadMealCSV, readFileAsText } from '../services/csvService'
import { useWorkoutStore } from '../stores/workoutStore'
import MealCard from '../components/Meal/MealCard'
import { Upload, RefreshCw, Flame } from 'lucide-react'
import './MealPage.css'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'supplement']

export default function MealPage() {
  const { user }       = useAuth()
  const selectedDate   = useWorkoutStore((s) => s.selectedDate)
  const [rows, setRows]         = useState(null)   // null=로딩중, []=없음
  const [loading, setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMeal(user.uid, selectedDate)
      setRows(data ?? [])
    } catch {
      setError('식단 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user, selectedDate])

  useEffect(() => { load() }, [load])

  // ─── 수동 CSV 업로드 ────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const text = await readFileAsText(file)
      await uploadMealCSV(user.uid, selectedDate, text)
      await load()
    } catch {
      setError('업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ─── 전체 삭제 ──────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('오늘 식단 전체를 삭제할까요?')) return
    try {
      await deleteMeal(user.uid, selectedDate)
      setRows([])
    } catch {
      setError('삭제에 실패했습니다.')
    }
  }

  // ─── 매크로 합산 ────────────────────────────────────
  const totalProtein  = rows?.reduce((s, r) => s + (parseFloat(r.protein_g) || 0), 0) ?? 0
  const totalCalories = rows?.reduce((s, r) => s + (parseFloat(r.calories)  || 0), 0) ?? 0

  // CSV에서 protein_target 읽기 (첫 번째로 발견된 값 사용, 없으면 기본 160g)
  const proteinTarget = (() => {
    if (!rows) return 160
    const found = rows.find(r => r.protein_target && parseFloat(r.protein_target) > 0)
    return found ? parseFloat(found.protein_target) : 160
  })()

  const grouped = MEAL_TYPES.reduce((acc, t) => {
    acc[t] = (rows ?? []).filter((r) => r.meal_type === t)
    return acc
  }, {})

  return (
    <main className="page-content meal-page" role="main">
      {/* 상단 요약 */}
      {rows?.length > 0 && (
        <div className="meal-summary card animate-fadeInUp">
          <div className="summary-item">
            <Flame size={16} color="var(--color-warning)" />
            <span className="summary-val">{Math.round(totalCalories)}</span>
            <span className="summary-unit">kcal</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-val" style={{ color:'var(--color-success)' }}>
              {Math.round(totalProtein)}
            </span>
            <span className="summary-unit">g 단백질</span>
          </div>
          <div className="summary-divider" />
          <ProteinBar current={totalProtein} target={proteinTarget} />
        </div>
      )}

      {/* 업로드 버튼 */}
      <div className="meal-actions">
        <label id="btn-upload-meal" className="btn btn-ghost upload-label" role="button">
          {uploading ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> : <Upload size={16} />}
          CSV 업로드
          <input type="file" accept=".csv" onChange={handleUpload} hidden />
        </label>
        <button id="btn-refresh-meal" className="btn btn-ghost" onClick={load} disabled={loading} aria-label="새로고침">
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
        </button>
        {rows?.length > 0 && (
          <button id="btn-delete-all-meal" className="btn btn-danger" onClick={handleDelete}>
            🗑️ 전체 삭제
          </button>
        )}
      </div>

      {/* 에러 */}
      {error && <p className="error-msg" role="alert">{error}</p>}

      {/* 로딩 */}
      {loading && (
        <div className="empty-state">
          <span className="spinner" />
        </div>
      )}

      {/* 식단 카드 목록 */}
      {!loading && rows !== null && (
        <div className="meal-list">
          {MEAL_TYPES.map((t) =>
            grouped[t].length > 0 ? (
              <MealCard key={t} type={t} items={grouped[t]} />
            ) : null
          )}
          {rows.length === 0 && (
            <div className="empty-state">
              <span style={{ fontSize:'2.5rem' }}>🥗</span>
              <p>오늘 식단 데이터가 없어요.</p>
              <label className="btn btn-primary" role="button">
                CSV 업로드하기
                <input type="file" accept=".csv" onChange={handleUpload} hidden />
              </label>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

// 단백질 160g 목표 진행 바
function ProteinBar({ current, target }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  return (
    <div className="protein-bar-wrap" title={`목표 ${target}g 대비 ${pct}%`}>
      <span className="summary-unit">단백질 목표</span>
      <div className="progress-bar" style={{ width:80 }}>
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
          }}
        />
      </div>
      <span className="summary-unit">{pct}%</span>
    </div>
  )
}
