import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchAllBody, uploadBodyCSV, readFileAsText,
  saveBodyData, fetchBody, deleteBody,
} from '../services/csvService'
import { useWorkoutStore } from '../stores/workoutStore'
import { todayYMD } from '../utils/dateUtils'
import { toast } from '../stores/toastStore'
import { useSelection } from '../hooks/useSelection'
import SelectionToolbar from '../components/Selection/SelectionToolbar'
import LineChart from '../components/Chart/LineChart'
import '../components/Chart/charts.css'
import '../components/Selection/SelectionToolbar.css'
import { Upload, RefreshCw, Plus, TrendingUp, TrendingDown, Check } from 'lucide-react'
import './BodyPage.css'

// YYYYMMDD → "M/D"
function shortDate(ymd) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${parseInt(ymd.slice(4, 6))}/${parseInt(ymd.slice(6, 8))}`
}

// YYYYMMDD ↔ YYYY-MM-DD 변환 (input[type=date] 호환)
function ymdToISO(ymd) {
  if (!ymd || ymd.length !== 8) return ''
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}
function isoToYmd(iso) {
  return (iso || '').replace(/-/g, '')
}

export default function BodyPage() {
  const { user } = useAuth()
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: selectedDate,           // YYYYMMDD
    weight_kg: '',
    body_fat_pct: '',
    muscle_mass_kg: '',
  })

  // 폼 열 때 현재 선택 날짜로 초기화
  useEffect(() => {
    if (showForm) {
      setForm((f) => ({ ...f, date: selectedDate }))
    }
  }, [showForm, selectedDate])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchAllBody(user.uid)
      setRecords(data)
    } catch {
      toast.error('체성분 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // 최근 기록 리스트(역순)
  const recent = useMemo(
    () => [...records].reverse().slice(0, 30),  // 최대 30건까지 선택 가능
    [records]
  )
  const allIds = useMemo(() => recent.map((r) => r.date), [recent])
  const selection = useSelection(allIds)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const result = await uploadBodyCSV(user.uid, selectedDate, text)
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(`체성분 ${result.count}개 업로드 완료`)
        await load()
      }
    } catch {
      toast.error('업로드에 실패했습니다.')
    } finally {
      e.target.value = ''
    }
  }

  const handleManualAdd = async (e) => {
    e.preventDefault()
    if (!form.weight_kg) {
      toast.warning('체중은 필수 입력입니다.')
      return
    }
    const targetDate = form.date && form.date.length === 8 ? form.date : selectedDate
    if (!/^\d{8}$/.test(targetDate)) {
      toast.error('측정 날짜가 올바르지 않습니다.')
      return
    }
    try {
      // 같은 날짜에 기존 기록이 있으면 합치기
      const existing = await fetchBody(user.uid, targetDate)
      const row = {
        date: targetDate,
        ...(form.weight_kg      && { weight_kg:      parseFloat(form.weight_kg) }),
        ...(form.body_fat_pct   && { body_fat_pct:   parseFloat(form.body_fat_pct) }),
        ...(form.muscle_mass_kg && { muscle_mass_kg: parseFloat(form.muscle_mass_kg) }),
      }
      const newRows = existing ? [...existing.filter((r) => r.date !== targetDate), row] : [row]
      await saveBodyData(user.uid, targetDate, newRows)
      toast.success(`체성분 기록 저장 완료 (${shortDate(targetDate)})`)
      setForm({ date: selectedDate, weight_kg: '', body_fat_pct: '', muscle_mass_kg: '' })
      setShowForm(false)
      await load()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  // 선택된 날짜들 일괄 삭제
  const handleDeleteSelected = async () => {
    const dates = Array.from(selection.selected)
    if (!dates.length) return
    try {
      // Firestore body 문서는 date 별로 1개이므로 doc 단위 삭제
      await Promise.all(dates.map((d) => deleteBody(user.uid, d)))
      toast.success(`체성분 기록 ${dates.length}건 삭제 완료`)
      selection.disable()
      await load()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // 라인 차트 데이터
  const weightData = records
    .filter((r) => r.weight_kg)
    .map((r) => ({ x: shortDate(r.date), y: parseFloat(r.weight_kg), date: r.date }))

  const fatData = records
    .filter((r) => r.body_fat_pct)
    .map((r) => ({ x: shortDate(r.date), y: parseFloat(r.body_fat_pct), date: r.date }))

  const muscleData = records
    .filter((r) => r.muscle_mass_kg)
    .map((r) => ({ x: shortDate(r.date), y: parseFloat(r.muscle_mass_kg), date: r.date }))

  // 최신/이전 비교
  const renderDelta = (data, unit) => {
    if (data.length < 2) return null
    const latest = data[data.length - 1].y
    const previous = data[data.length - 2].y
    const delta = latest - previous
    const Icon = delta > 0 ? TrendingUp : TrendingDown
    const color = delta > 0 ? 'var(--color-warning)' : 'var(--color-success)'
    return (
      <span className="body-delta" style={{ color }}>
        <Icon size={12} />
        {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
      </span>
    )
  }

  return (
    <main className="page-content body-page" role="main">
      {/* 툴바 */}
      <div className="body-toolbar">
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} /> 기록 추가
        </button>
        <label className="btn btn-ghost upload-label" role="button">
          <Upload size={16} /> CSV
          <input type="file" accept=".csv" onChange={handleUpload} hidden />
        </label>
        <button className="btn btn-ghost" onClick={load} disabled={loading} aria-label="새로고침">
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
        </button>
        {records.length > 0 && (
          <SelectionToolbar
            enabled={selection.enabled}
            totalCount={recent.length}
            selectedCount={selection.size}
            allSelected={selection.isAllSelected}
            onEnable={selection.enable}
            onCancel={selection.disable}
            onToggleAll={() => selection.toggleAll()}
            onDelete={handleDeleteSelected}
            confirmText={`선택한 체성분 기록 ${selection.size}건을 삭제할까요?`}
          />
        )}
      </div>

      {/* 수동 입력 폼 */}
      {showForm && (
        <form className="body-form card animate-fadeInUp" onSubmit={handleManualAdd}>
          <p className="body-form-label">체성분 기록 추가</p>
          <div className="body-form-row body-form-date-row">
            <label className="body-form-date">
              <span>측정 날짜</span>
              <input
                type="date"
                value={ymdToISO(form.date)}
                max={ymdToISO(todayYMD())}
                onChange={(e) => setForm({ ...form, date: isoToYmd(e.target.value) })}
                required
              />
            </label>
          </div>
          <div className="body-form-row">
            <label>
              <span>체중 (kg)</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="체중을 입력하세요"
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                required
              />
            </label>
            <label>
              <span>체지방률 (%)</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="체지방률을 입력하세요 (선택)"
                value={form.body_fat_pct}
                onChange={(e) => setForm({ ...form, body_fat_pct: e.target.value })}
              />
            </label>
            <label>
              <span>근육량 (kg)</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="근육량을 입력하세요 (선택)"
                value={form.muscle_mass_kg}
                onChange={(e) => setForm({ ...form, muscle_mass_kg: e.target.value })}
              />
            </label>
          </div>
          <div className="body-form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="empty-state"><span className="spinner" /></div>
      )}

      {!loading && records.length === 0 && (
        <div className="empty-state">
          <span style={{ fontSize: '2.5rem' }}>💪</span>
          <p>체성분 기록이 없어요.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
            상단 "기록 추가" 또는 CSV 업로드로 시작하세요.
          </p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <>
          {/* 요약 카드 */}
          <div className="body-stats card">
            {weightData.length > 0 && (
              <div className="body-stat-item">
                <span className="body-stat-label">체중</span>
                <div className="body-stat-row">
                  <span className="body-stat-val">{weightData[weightData.length - 1].y}</span>
                  <span className="body-stat-unit">kg</span>
                  {renderDelta(weightData, 'kg')}
                </div>
              </div>
            )}
            {fatData.length > 0 && (
              <div className="body-stat-item">
                <span className="body-stat-label">체지방률</span>
                <div className="body-stat-row">
                  <span className="body-stat-val">{fatData[fatData.length - 1].y}</span>
                  <span className="body-stat-unit">%</span>
                  {renderDelta(fatData, '%')}
                </div>
              </div>
            )}
            {muscleData.length > 0 && (
              <div className="body-stat-item">
                <span className="body-stat-label">근육량</span>
                <div className="body-stat-row">
                  <span className="body-stat-val">{muscleData[muscleData.length - 1].y}</span>
                  <span className="body-stat-unit">kg</span>
                  {renderDelta(muscleData, 'kg')}
                </div>
              </div>
            )}
          </div>

          {/* 차트들 */}
          {weightData.length > 0 && (
            <LineChart
              data={weightData}
              label="체중 추이 (kg)"
              color="var(--color-primary)"
              unit="kg"
            />
          )}
          {fatData.length > 0 && (
            <LineChart
              data={fatData}
              label="체지방률 추이 (%)"
              color="var(--color-warning)"
              unit="%"
            />
          )}
          {muscleData.length > 0 && (
            <LineChart
              data={muscleData}
              label="근육량 추이 (kg)"
              color="var(--color-success)"
              unit="kg"
            />
          )}

          {/* 최근 기록 리스트 (선택 모드 시 체크박스 표시) */}
          <div className="body-records card">
            <p className="body-records-title">최근 기록</p>
            {recent.map((r) => {
              const checked = selection.isSelected(r.date)
              return (
                <div
                  key={r.date}
                  className={`body-record-item ${selection.enabled ? 'selectable' : ''} ${checked ? 'selected' : ''}`}
                  onClick={selection.enabled ? () => selection.toggle(r.date) : undefined}
                  role={selection.enabled ? 'button' : undefined}
                >
                  {selection.enabled && (
                    <span className={`sel-checkbox ${checked ? 'checked' : ''}`} aria-hidden="true">
                      {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                  )}
                  <span className="body-record-date">{shortDate(r.date)}</span>
                  <div className="body-record-vals">
                    {r.weight_kg && <span>{r.weight_kg}kg</span>}
                    {r.body_fat_pct && <span>{r.body_fat_pct}%</span>}
                    {r.muscle_mass_kg && <span>근육 {r.muscle_mass_kg}kg</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
