'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LoginPortal } from '@/components/LoginPortal';
import { normalizePortalSessionUser } from '@/lib/userScope';
import { PortalSplash, prefetchLoginDecor } from '@/components/PortalSplash';

type Language = 'en' | 'ta';

/** Loaded only after sign-in so the login screen does not download the full portal bundle. */
const PortalApp = dynamic(() => import('@/components/PortalApp'), {
  ssr: false,
  loading: () => <PortalSplash variant="app" lang="en" />,
});

function readSavedUser() {
  try {
    const saved = localStorage.getItem('ems_current_user');
    return saved ? normalizePortalSessionUser(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    prefetchLoginDecor('/app_logo.png');
    setCurrentUser(readSavedUser());
    setAuthChecked(true);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthenticating(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const isInspectionUser =
          data.user.isInspectionUser ||
          (data.user.roleId && String(data.user.roleId).toLowerCase().includes('inspect')) ||
          (data.user.role && String(data.user.role).toLowerCase().includes('inspect'));
        if (isInspectionUser) {
          setLoginError(
            lang === 'ta'
              ? 'அனுமதி மறுக்கப்பட்டது: கள ஆய்வுப் பயனர்கள் இணையதளத்தில் உள்நுழைய அனுமதியில்லை.'
              : 'Access Denied: Field inspection users are not permitted to log in to the webapp.'
          );
          return;
        }
        const sessionUser = normalizePortalSessionUser(data.user);
        localStorage.setItem('ems_current_user', JSON.stringify(sessionUser));
        void import('@/lib/portalBootstrapClient').then(({ loadPortalBootstrap }) => loadPortalBootstrap());
        setCurrentUser(sessionUser);
      } else {
        setLoginError(
          data.message ||
            (lang === 'ta' ? 'தவறான பயனர் பெயர் அல்லது கடவுச்சொல்' : 'Invalid username or password')
        );
      }
    } catch {
      setLoginError('Server error connecting to authentication service.');
    } finally {
      setAuthenticating(false);
    }
  };

  if (!authChecked) {
    return <PortalSplash variant="app" lang={lang} />;
  }

  if (currentUser) {
    return <PortalApp initialUser={currentUser} />;
  }

  return (
    <LoginPortal
      lang={lang}
      logoSrc="/app_logo.png"
      username={loginUsername}
      password={loginPassword}
      error={loginError}
      authenticating={authenticating}
      onUsername={setLoginUsername}
      onPassword={setLoginPassword}
      onToggleLanguage={() => setLang((v) => (v === 'en' ? 'ta' : 'en'))}
      onSubmit={handleLoginSubmit}
    />
  );
}
