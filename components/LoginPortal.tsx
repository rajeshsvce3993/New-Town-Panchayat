'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Globe, Lock, LogIn, RefreshCw, User } from 'lucide-react';
import { prefetchLoginDecor } from '@/components/PortalSplash';

type Language = 'en' | 'ta';

const REMEMBER_KEY = 'ems_remember_username';

/** Cached images often skip `onLoad`; detect `complete` so decor is never stuck invisible. */
function useImageVisible(src: string) {
  const ref = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth > 0) setVisible(true);
  }, [src]);

  const onLoad = () => setVisible(true);
  const onError = () => setVisible(true);

  return { ref, visible, onLoad, onError };
}

export function LoginPortal({
  lang,
  logoSrc,
  username,
  password,
  error,
  authenticating,
  onUsername,
  onPassword,
  onToggleLanguage,
  onSubmit,
}: {
  lang: Language;
  logoSrc: string;
  username: string;
  password: string;
  error: string;
  authenticating: boolean;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onToggleLanguage: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const ta = lang === 'ta';
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgotHint, setForgotHint] = useState(false);
  const hero = useImageVisible('/login-hero.jpg');
  const skyline = useImageVisible('/login-skyline.png');

  useEffect(() => {
    prefetchLoginDecor(logoSrc);
  }, [logoSrc]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        onUsername(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    try {
      if (remember && username.trim()) localStorage.setItem(REMEMBER_KEY, username.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
    onSubmit(e);
  };

  const inputClass =
    'h-[52px] w-full appearance-none rounded-full border border-[#D5DCE6] bg-white pl-[52px] pr-4 text-[14px] text-slate-700 shadow-[0_1px_2px_rgba(15,47,107,0.04)] outline-none transition placeholder:text-slate-400 hover:border-[#C3CDDA] focus:border-[#1E4B8E] focus:bg-white focus:shadow-[0_0_0_4px_rgba(30,75,142,0.12)]';

  return (
    <div className="grid h-[100dvh] w-screen grid-cols-1 overflow-hidden bg-[#F9FBFE] lg:grid-cols-[minmax(0,1fr)_minmax(400px,28rem)]">
      <section className="relative hidden min-h-0 min-w-0 bg-[#C9E4F4] lg:block">
        <img
          ref={hero.ref}
          src="/login-hero.jpg"
          alt="Town Panchayat Admin Portal"
          fetchPriority="high"
          decoding="async"
          onLoad={hero.onLoad}
          onError={hero.onError}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
            hero.visible ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </section>

      <section className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F9FBFE] lg:h-full">
        <button
          type="button"
          onClick={onToggleLanguage}
          className="absolute right-5 top-4 z-20 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-[#1E4B8E]"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          {ta ? 'English' : 'தமிழ்'}
        </button>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-6 pb-2 pt-12 sm:px-10">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="text-center">
              <img
                src={logoSrc}
                alt="Town Panchayat"
                fetchPriority="high"
                decoding="async"
                className="mx-auto block h-auto w-[128px] max-w-[46vw] object-contain object-top"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.dataset.fallback === '1') return;
                  el.dataset.fallback = '1';
                  el.onerror = null;
                  el.src = '/login-logo.png';
                }}
              />
              <p className="mt-2 text-[13px] text-slate-400">
                {ta ? 'நிர்வாக முகப்பு உள்நுழைவு' : 'Admin Portal Login'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 w-full">
              {error && (
                <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-medium text-red-700">{error}</p>
              )}
              <label className="relative mb-3 block">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#F1F5F9] text-slate-500">
                  <User className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => onUsername(e.target.value)}
                  placeholder={ta ? 'பயனர் பெயர் / மின்னஞ்சல்' : 'Username / Email ID'}
                  className={inputClass}
                />
              </label>
              <label className="relative mb-4 block">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#F1F5F9] text-slate-500">
                  <Lock className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  placeholder={ta ? 'கடவுச்சொல்' : 'Password'}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>
              <button
                type="submit"
                disabled={authenticating}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#123A73] text-[15px] font-semibold tracking-wide text-white transition hover:bg-[#0E2F5E] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {authenticating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" strokeWidth={2.25} />}
                {authenticating ? (ta ? 'சரிபார்க்கிறது...' : 'Signing in...') : ta ? 'உள்நுழைய' : 'Login'}
              </button>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
                <label className="inline-flex min-w-0 cursor-pointer select-none items-center gap-2.5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-[16px] w-[16px] shrink-0 rounded-[4px] border border-slate-300 accent-[#123A73]"
                  />
                  <span className="whitespace-nowrap">{ta ? 'நினைவில் கொள்க' : 'Remember Me'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForgotHint((v) => !v)}
                  className="shrink-0 text-left font-semibold text-[#1E4B8E] transition hover:text-[#123A73]"
                >
                  {ta ? 'கடவுச்சொல் மறந்துவிட்டதா?' : 'Forgot Password?'}
                </button>
              </div>
              {forgotHint && (
                <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
                  {ta
                    ? 'கடவுச்சொல்லை மீட்டமைக்க நிர்வாகியை தொடர்பு கொள்ளவும்.'
                    : 'Please contact your administrator to reset the password.'}
                </p>
              )}
            </form>
          </div>
        </div>

        <div className="relative z-0 w-full min-w-0 shrink-0 leading-[0]">
          <img
            ref={skyline.ref}
            src="/login-skyline.png"
            alt=""
            decoding="async"
            onLoad={skyline.onLoad}
            onError={skyline.onError}
            className={`block h-auto w-full max-w-none transition-opacity duration-300 ${
              skyline.visible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </section>
    </div>
  );
}
