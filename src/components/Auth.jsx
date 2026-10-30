import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    const { error, data } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else if (mode === 'signup' && !data.session) setMsg('가입 완료! 이메일 인증 후 로그인해 주세요.')
  }

  return (
    <form className="card auth" onSubmit={submit}>
      <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>
      <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      <button className="primary">{mode === 'login' ? '로그인' : '가입하기'}</button>
      {msg && <p className="error">{msg}</p>}
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
      </button>
    </form>
  )
}
