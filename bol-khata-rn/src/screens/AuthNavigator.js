import { useState } from 'react'
import LoginScreen from './LoginScreen'
import SignupScreen from './SignupScreen'
import VerifyOtpScreen from './VerifyOtpScreen'
import ForgotPasswordScreen from './ForgotPasswordScreen'

// Chhota sa navigator — alag library ki zaroorat nahi.
export default function AuthNavigator() {
  const [route, setRoute] = useState({ name: 'login', params: {} })
  const go = (name, params = {}) => setRoute({ name, params })

  if (route.name === 'signup') return <SignupScreen go={go} />
  if (route.name === 'forgot') return <ForgotPasswordScreen go={go} />
  if (route.name === 'verify') return <VerifyOtpScreen go={go} params={route.params} />
  return <LoginScreen go={go} />
}
