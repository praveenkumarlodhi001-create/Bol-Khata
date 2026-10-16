import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange } from '../services/authService'

const AuthContext = createContext({ user: null, initializing: true })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u)
      setInitializing(false)
    })
    return unsub
  }, [])

  return <AuthContext.Provider value={{ user, initializing }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
