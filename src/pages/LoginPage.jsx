import { useState } from 'react'
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { auth, googleProvider } from '../services/firebase'
import './LoginPage.css'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브(iOS): WebView에서는 구글 OAuth 팝업이 차단됨
        // → 네이티브 구글 로그인 후 idToken으로 웹 SDK 세션 생성
        const result = await FirebaseAuthentication.signInWithGoogle()
        const idToken = result.credential?.idToken
        if (!idToken) throw new Error('no idToken')
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      } else {
        await signInWithPopup(auth, googleProvider)
      }
    } catch (e) {
      console.error('[login]', e)
      setError('로그인에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" role="main">
      <div className="login-card animate-fadeInUp">
        {/* 로고 / 제목 */}
        <div className="login-hero">
          <div className="login-emblem" aria-hidden="true">💪</div>
          <h1 className="login-title">WORK OUT!</h1>
          <p className="login-sub">Personal Training & Running</p>
        </div>

        {/* 구분선 */}
        <div className="divider" />

        {/* 로그인 버튼 */}
        <button
          id="btn-google-login"
          className="btn btn-google btn-full"
          onClick={handleGoogle}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="spinner" style={{ width:20, height:20, borderWidth:2 }} />
          ) : (
            <GoogleIcon />
          )}
          {loading ? '로그인 중...' : 'Google로 계속하기'}
        </button>

        {error && <p className="login-error" role="alert">{error}</p>}

        <p className="login-note">개인 데이터는 Firebase에 안전하게 저장됩니다.</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
