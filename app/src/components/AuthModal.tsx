import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { Modal } from './ui/Ui'

type Mode = 'login' | 'register'

/** 登录 / 注册弹窗。内测期注册需要邀请码。 */
export function AuthModal() {
  const { modalOpen, closeAuth, login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    email.trim() && password && (mode === 'login' || invite.trim()) && !submitting

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const r =
      mode === 'login'
        ? await login(email.trim(), password)
        : await register({
            email: email.trim(),
            password,
            nickname: nickname.trim(),
            invite_code: invite.trim(),
          })
    setSubmitting(false)
    if (!r.ok) {
      setError(r.error || '操作失败，请稍后再试')
      return
    }
    // 成功后 AuthContext 已关闭弹窗；清掉敏感输入，下次打开是干净的
    setPassword('')
    setInvite('')
  }

  return (
    <Modal open={modalOpen} onClose={closeAuth} width="max-w-md">
      <div className="mb-5 flex gap-1 rounded-full bg-water-100/70 p-1">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all duration-300 ${
              mode === m
                ? 'bg-white text-water-700 shadow-[0_4px_12px_-6px_rgba(0,119,182,.5)]'
                : 'text-ink-500 hover:text-water-700'
            }`}
          >
            {m === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <h3 className="text-lg font-bold text-ink-900">
        {mode === 'login' ? '欢迎回来' : '加入流水'}
      </h3>
      <p className="mt-1 text-xs text-ink-400">
        {mode === 'login'
          ? '登录后可使用工具、写评价，对话记录也会保存下来。'
          : '目前为邀请制内测，需要邀请码才能注册。'}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3.5">
        <div>
          <label className="text-xs font-semibold text-ink-500">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            className="field mt-1.5"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-ink-500">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? '输入密码' : '至少 8 位'}
            className="field mt-1.5"
          />
        </div>

        {mode === 'register' && (
          <>
            <div>
              <label className="text-xs font-semibold text-ink-500">
                昵称 <span className="font-normal text-ink-300">（选填，默认取邮箱前缀）</span>
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="别人看到的名字"
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500">邀请码</label>
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="8 位邀请码"
                className="field mt-1.5 tracking-widest"
              />
            </div>
          </>
        )}

        {error && <p className="text-xs text-accent-coral">{error}</p>}

        <button type="submit" disabled={!canSubmit} className="btn-water w-full py-3">
          {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>
    </Modal>
  )
}
