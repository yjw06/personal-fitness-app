import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'

export function useAuth() {
  const [user,    setUser]    = useState(undefined) // undefined = 아직 로딩중
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading }
}
