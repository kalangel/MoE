import { useState } from 'react';
import { motion } from 'framer-motion';
import { signIn, signUp } from '../online/online';

export default function AuthScreen({ onOffline }: { onOffline: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!email || password.length < 6) { setMsg('Введите email и пароль (от 6 символов).'); return; }
    setBusy(true); setMsg(null);
    const { error } = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) { setMsg(error); return; }
    if (mode === 'up') setMsg('Аккаунт создан. Если включено подтверждение email — проверьте почту, затем войдите.');
    // при успехе onAuthStateChange переключит экран
  };

  return (
    <div className="app">
      <div className="auth-screen">
        <motion.div className="win" style={{ width: 'min(400px, 92vw)' }}
          initial={{ scale: 0.9, opacity: 0, y: 18 }} animate={{ scale: 1, opacity: 1, y: 0 }}>
          <div className="win-head">
            <span className="wic">⚜</span>
            <span className="wt">Марш Империй · Онлайн</span>
          </div>
          <div className="win-body">
            <div className="pg-tabs" style={{ marginBottom: 12 }}>
              <button className={`pg-tab ${mode === 'in' ? 'sel' : ''}`} onClick={() => setMode('in')}>Вход</button>
              <button className={`pg-tab ${mode === 'up' ? 'sel' : ''}`} onClick={() => setMode('up')}>Регистрация</button>
            </div>
            <input className="auth-input" type="email" placeholder="email" value={email}
              autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
            <input className="auth-input" type="password" placeholder="пароль" value={password}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {msg && <div className="auth-msg">{msg}</div>}
            <button className="btn btn-green" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={submit}>
              {busy ? '…' : mode === 'in' ? '⚔ Войти в общий мир' : '⚔ Создать аккаунт'}
            </button>
            <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={onOffline}>
              Играть оффлайн
            </button>
            <p className="muted" style={{ marginTop: 10, fontSize: 11, textAlign: 'center' }}>
              Общий мир на 5–10 лордов: видите замки друг друга, нападаете в реальном времени.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
