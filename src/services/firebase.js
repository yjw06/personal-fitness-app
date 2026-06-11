import { initializeApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// 오프라인 persistence + 멀티 탭 지원
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
} catch (err) {
  console.warn('[firebase] persistence 초기화 실패, 메모리 캐시로 폴백:', err)
  db = getFirestore(app)
}

export { db }

// 네이티브(Capacitor)에서는 getAuth() 기본 초기화가 capacitor:// 스킴에서
// 멈춰버림 → indexedDB persistence로 명시 초기화 (Firebase 공식 권장 패턴)
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app)

export const googleProvider = new GoogleAuthProvider()
