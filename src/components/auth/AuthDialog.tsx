/** Email + password sign-in / sign-up modal. */
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Icon } from '../ui/Icon';

type Mode = 'signin' | 'signup';

export function AuthDialog() {
  const open = useAuthStore((s) => s.dialogOpen);
  const closeDialog = useAuthStore((s) => s.closeDialog);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setError(null);
      setNotice(null);
      setBusy(false);
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, closeDialog]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const { signIn, signUp } = useAuthStore.getState();
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Try again.');
      return;
    }
    if (result.needsEmailConfirm) {
      setNotice('Account created. Check your email for a confirmation link, then sign in.');
      setMode('signin');
      setPassword('');
      return;
    }
    closeDialog(); // signed in — onAuthStateChange kicks off the sync
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}
    >
      <div className="panel animate-in w-[380px] max-w-[calc(100vw-32px)] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
            <Icon name="cloud" size={17} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[15px] leading-tight font-semibold">
              {mode === 'signin' ? 'Sign in to sync' : 'Create your account'}
            </h2>
            <p className="text-[11.5px] opacity-55">Access your canvases on any device.</p>
          </div>
        </div>

        <label className="mt-4 block text-[11.5px] font-medium opacity-60">Email</label>
        <input
          ref={emailRef}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') void submit();
          }}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-indigo-400 focus:bg-transparent dark:border-white/10 dark:bg-white/[0.04] dark:focus:border-indigo-500"
        />

        <label className="mt-3 block text-[11.5px] font-medium opacity-60">Password</label>
        <div className="relative mt-1">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') void submit();
            }}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            className="w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 pr-10 text-[13.5px] outline-none transition-colors focus:border-indigo-400 focus:bg-transparent dark:border-white/10 dark:bg-white/[0.04] dark:focus:border-indigo-500"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            className="ui-btn absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 opacity-60 hover:opacity-100"
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={15} />
          </button>
        </div>

        {error && <p className="mt-3 text-[12px] font-medium text-red-500">{error}</p>}
        {notice && <p className="mt-3 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-indigo-500 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <p className="mt-3.5 text-center text-[12px] opacity-60">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-semibold text-indigo-500 hover:underline"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setError(null);
              setNotice(null);
            }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
