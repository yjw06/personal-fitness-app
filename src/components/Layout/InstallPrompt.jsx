import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, Share, X } from 'lucide-react'
import './InstallPrompt.css'

const DISMISS_KEY = 'installPromptDismissed_v1'

// 이미 홈 화면 설치(스탠드얼론)로 실행 중인지
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}
function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

// 친구에게 웹 링크로 공유 시: 설치를 유도하는 배너.
//  - Android/Chrome: beforeinstallprompt 가로채 1탭 설치
//  - iOS Safari: 이벤트가 없어 "공유 → 홈 화면에 추가" 수동 안내
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // 네이티브 앱 / 이미 설치됨 / 이전에 닫음 → 표시 안 함
    if (Capacitor.isNativePlatform() || isStandalone()) return
    try { if (localStorage.getItem(DISMISS_KEY)) return } catch {}

    const onBIP = (e) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    if (isIos()) {
      setIosHint(true)
      setShow(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    dismiss()
  }

  if (!show) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="앱 설치 안내">
      <button className="install-close" onClick={dismiss} aria-label="닫기">
        <X size={16} />
      </button>
      {iosHint ? (
        <p className="install-text">
          <Share size={16} />
          <span>하단 <strong>공유</strong> → <strong>"홈 화면에 추가"</strong>로 앱처럼 설치하세요</span>
        </p>
      ) : (
        <>
          <p className="install-text">
            <Download size={16} />
            <span>홈 화면에 설치하면 앱처럼 빠르게 열려요</span>
          </p>
          <button className="btn btn-primary install-btn" onClick={install}>설치</button>
        </>
      )}
    </div>
  )
}
