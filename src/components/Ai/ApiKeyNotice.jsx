import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ExternalLink, Save } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMemoryStore } from '../../stores/memoryStore'
import { toast } from '../../stores/toastStore'
import './ApiKeyNotice.css'

// AI 기능을 쓰려면 무료 Gemini 키가 필요한데, 설정까지 안 가도 이 자리에서 바로 저장.
// 키 없이 쓰고 싶은 사람은 외부 AI(/assistant) 복붙 흐름으로 유도.
export default function ApiKeyNotice({ feature = 'AI 기능' }) {
  const { user } = useAuth()
  const save = useMemoryStore((s) => s.save)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = key.trim()
    if (!trimmed) { toast.error('키를 붙여넣어 주세요.'); return }
    if (!user) { toast.error('로그인이 필요합니다.'); return }
    setSaving(true)
    try {
      await save(user.uid, { apiKey: trimmed })
      toast.success('Gemini 키 저장 완료! 이제 AI 기능을 쓸 수 있어요.')
      setKey('')
    } catch (err) {
      toast.error(`저장 실패: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="apikey-notice card animate-fadeInUp">
      <div className="apikey-notice-head">
        <Sparkles size={18} />
        <strong>{feature}은 무료 Gemini 키로 켤 수 있어요</strong>
      </div>

      <ol className="apikey-notice-steps">
        <li>
          <a
            className="btn btn-ghost apikey-getbtn"
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} /> 무료 키 발급받기
          </a>
          <span className="apikey-hint">구글 로그인 → "Create API key" → 복사</span>
        </li>
        <li>
          <div className="apikey-input-row">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza… 여기에 붙여넣기"
              className="apikey-input"
              autoComplete="off"
              spellCheck="false"
            />
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </li>
      </ol>

      <p className="apikey-notice-alt">
        키 없이 쓰고 싶다면 → <Link to="/assistant">외부 AI(ChatGPT·Claude)로 만들기</Link>
      </p>
    </div>
  )
}
