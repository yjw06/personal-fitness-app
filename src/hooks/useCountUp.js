import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, duration = 500) {
  const [count, setCount] = useState(target)
  const rafRef = useRef(null)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const from = prevTarget.current
    if (target === from) return

    const startTime = performance.now()
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(from + (target - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        prevTarget.current = target
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return count
}
