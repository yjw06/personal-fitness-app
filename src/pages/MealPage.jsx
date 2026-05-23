import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchMeal, deleteMeal, uploadMealCSV, readFileAsText,
  saveMealData,
} from '../services/csvService'
import { useWorkoutStore } from '../stores/workoutStore'
import { toast } from '../stores/toastStore'
import { useSelection } from '../hooks/useSelection'
import SelectionToolbar from '../components/Selection/SelectionToolbar'
import EntryModal from '../components/EntryModal/EntryModal'
import MealForm from '../components/EntryModal/MealForm'
import MealCard from '../components/Meal/MealCard'
import { Upload, RefreshCw, Flame, Check, Plus, Pencil } from 'lucide-react'
import '../components/Selection/SelectionToolbar.css'
import './MealPage.css'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'supplement']
const MEAL_META = {
  breakfast: { label: '아침',  emoji: '☀️' },
  lunch:     { label: '점심',  emoji: '⚡' },
  dinner:    { label: '저녁',  emoji: '🌙' },
  snack:     { label: '간식',  emoji: '🍎' },
  supplement:{ label: '보충제', emoji: '💊' },
}

export default function MealPage() {
  const { user }       = useAuth()
  const selectedDate   = useWorkoutStore((s) => s.selectedDate)
  const [rows, setRows]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMeal(user.uid, selectedDate)
      setRows(data ?? [])
    } catch (err) {
      setError('식단 데이터를 불러오지 못했습니다.')
      toast.error('식단 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user, selectedDate])

  useEffect(() => { load() }, [load])

  const allIndices = useMemo(() => (rows ?? []).map((_, i) => i), [rows])
  const selection = useSelection(allIndices)

  // 추가/편집 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState(null)

  const openAdd  = () => { setEditIndex(null); setModalOpen(true) }
  const openEdit = (i) => { setEditIndex(i); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditIndex(null) }

  const handleSaveEntry = async (row) => {
    try {
      let newRows
      if (editIndex == null) {
        newRows = [...(rows ?? []), row]
      } else {
        newRows = (rows ?? []).map((r, i) => (i === editIndex ? row : r))
      }
      await saveMealData(user.uid, selectedDate, newRows)
      setRows(newRows)
      toast.success(editIndex == null ? '식사를 추가했습니다.' : '식사를 수정했습니다.')
      closeModal()
      if (editIndex != null) selection.disable()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const text = await readFileAsText(file)
      const result = await uploadMealCSV(user.uid, selectedDate, text)
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(`식단 ${result.count}개 업로드 완료`)
        await load()
      }
    } catch {
      toast.error('업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteSelected = async () => {
    const removeSet = selection.selected
    if (!removeSet.size) return
    const newRows = (rows ?? []).filter((_, i) => !removeSet.has(i))
    try {
      if (newRows.length === 0) {
        await deleteMeal(user.uid, selectedDate)
        setRows([])
      } else {
        await saveMealData(user.uid, selectedDate, newRows)
        setRows(newRows)
      }
      toast.success(`식사 ${removeSet.size}개 삭제 완료`)
      selection.disable()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // 매크로 합산
  const totalProtein  = rows?.reduce((s, r) => s + (parseFloat(r.protein_g) || 0), 0) ?? 0
  const totalCarbs    = rows?.reduce((s, r) => s + (parseFloat(r.carbs_g)   || 0), 0) ?? 0
  const totalFat      = rows?.reduce((s, r) => s + (parseFloat(r.fat_g)     || 0), 0) ?? 0
  const totalCalories = rows?.reduce((s, r) => s + (parseFloat(r.calories)  || 0), 0) ?? 0

  // CSV에서 목표값 읽기 (첫 행 우선)
  const readTarget = (col, fallback) => {
    if (!rows) return fallback
    const found = rows.find((r) => r[col] && parseFloat(r[col]) > 0)
    return found ? parseFloat(found[col]) : fallback
  }
  // 사용자가 별도 목표값을 설정하지 않으면 일반 가이드라인(120g)을 임시로 사용
  // 정확한 값은 식단 CSV의 protein_target 컬럼 또는 마스터플랜 메모리에서 가져옴
  const proteinTarget = readTarget('protein_target', 120)
  const carbsTarget   = readTarget('carbs_target',   0)
  const fatTarget     = readTarget('fat_target',     0)
  const calTarget     = readTarget('calorie_target', 0)

  // 인덱스 정보를 유지하면서 그룹화 (선택용)
  const groupedWithIdx = MEAL_TYPES.reduce((acc, t) => {
    acc[t] = (rows ?? [])
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => row.meal_type === t)
    return acc
  }, {})

  return (
    <main className="page-content meal-page" role="main">
      {/* 상단 요약 */}
      {rows?.length > 0 && (
        <div className="meal-summary card animate-fadeInUp">
          <div className="summary-row">
            <div className="summary-item">
              <Flame size={16} color="var(--color-warning)" />
              <span className="summary-val">{Math.round(totalCalories)}</span>
              <span className="summary-unit">kcal</span>
            </div>
            {calTarget > 0 && (
              <span className="summary-target">/ {calTarget}</span>
            )}
          </div>

          <div className="macro-bars">
            <MacroBar
              label="단백질"
              current={totalProtein}
              target={proteinTarget}
              color="var(--color-success)"
            />
            {carbsTarget > 0 && (
              <MacroBar
                label="탄수화물"
                current={totalCarbs}
                target={carbsTarget}
                color="var(--color-warning)"
              />
            )}
            {fatTarget > 0 && (
              <MacroBar
                label="지방"
                current={totalFat}
                target={fatTarget}
                color="var(--color-danger)"
              />
            )}
          </div>
        </div>
      )}

      <div className="meal-actions">
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> 식사 추가
        </button>
        <label id="btn-upload-meal" className="btn btn-ghost upload-label" role="button">
          {uploading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Upload size={16} />}
          CSV
          <input type="file" accept=".csv" onChange={handleUpload} hidden />
        </label>
        <button id="btn-refresh-meal" className="btn btn-ghost" onClick={load} disabled={loading} aria-label="새로고침">
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
        </button>
        {rows?.length > 0 && (
          <>
            <SelectionToolbar
              enabled={selection.enabled}
              totalCount={allIndices.length}
              selectedCount={selection.size}
              allSelected={selection.isAllSelected}
              onEnable={selection.enable}
              onCancel={selection.disable}
              onToggleAll={() => selection.toggleAll()}
              onDelete={handleDeleteSelected}
              confirmText={`선택한 식사 ${selection.size}개를 삭제할까요?`}
            />
            {selection.enabled && selection.size === 1 && (
              <button
                className="btn btn-ghost"
                onClick={() => openEdit(Array.from(selection.selected)[0])}
              >
                <Pencil size={14} /> 편집
              </button>
            )}
          </>
        )}
      </div>

      <EntryModal
        open={modalOpen}
        onClose={closeModal}
        title={editIndex == null ? '식사 추가' : '식사 편집'}
      >
        <MealForm
          initial={editIndex != null ? rows?.[editIndex] : null}
          onSubmit={handleSaveEntry}
          onCancel={closeModal}
        />
      </EntryModal>

      {error && <p className="error-msg" role="alert">{error}</p>}

      {loading && (
        <div className="empty-state">
          <span className="spinner" />
        </div>
      )}

      {!loading && rows !== null && (
        <div className="meal-list">
          {/* 선택 모드일 땐 음식 단위로 평탄하게 보여 줌 */}
          {selection.enabled ? (
            <div className="meal-select-list">
              {(rows ?? []).map((r, i) => {
                const meta = MEAL_META[r.meal_type] ?? { label: r.meal_type, emoji: '🍽️' }
                const checked = selection.isSelected(i)
                return (
                  <div
                    key={i}
                    className={`meal-select-item selectable ${checked ? 'selected' : ''}`}
                    onClick={() => selection.toggle(i)}
                    role="button"
                  >
                    <span className={`sel-checkbox ${checked ? 'checked' : ''}`} aria-hidden="true">
                      {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className="msl-emoji">{meta.emoji}</span>
                    <div className="msl-body">
                      <span className="msl-type">{meta.label}{r.meal_time ? ` · ${r.meal_time}` : ''}</span>
                      <span className="msl-name">{r.food_name}</span>
                    </div>
                    {r.calories && (
                      <span className="msl-cal">{Math.round(parseFloat(r.calories))} kcal</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              {MEAL_TYPES.map((t) =>
                groupedWithIdx[t].length > 0 ? (
                  <MealCard
                    key={t}
                    type={t}
                    items={groupedWithIdx[t].map((g) => g.row)}
                  />
                ) : null
              )}
              {rows.length === 0 && (
                <div className="empty-state">
                  <span style={{ fontSize: '2.5rem' }}>🥗</span>
                  <p>식단 데이터가 없어요.</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
                    상단 "식사 추가" 또는 CSV 업로드로 시작하세요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  )
}

function MacroBar({ label, current, target, color }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const done = current >= target
  return (
    <div className="macro-bar-row" title={`목표 ${target}g · ${pct}%`}>
      <span className="macro-bar-label">{label}</span>
      <div className="macro-bar-track">
        <div
          className="macro-bar-fill"
          style={{ width: `${pct}%`, background: done ? 'var(--color-success)' : color }}
        />
      </div>
      <span className="macro-bar-val" style={{ color: done ? 'var(--color-success)' : 'var(--color-text-2)' }}>
        {Math.round(current)}/{target}g
      </span>
    </div>
  )
}
