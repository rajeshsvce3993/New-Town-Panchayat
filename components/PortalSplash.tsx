'use client';

type SplashVariant = 'login' | 'app';
type Language = 'en' | 'ta';

export function PortalSplash({
  variant = 'login',
  lang = 'en',
}: {
  variant?: SplashVariant;
  lang?: Language;
}) {
  const ta = lang === 'ta';
  const title = ta ? 'பேரூராட்சி' : 'Town Panchayat';
  const subtitle =
    variant === 'login'
      ? ta
        ? 'நிர்வாக முகப்பு ஏற்றப்படுகிறது...'
        : 'Loading admin portal...'
      : ta
        ? 'பணியிடம் தயாராகிறது...'
        : 'Preparing your workspace...';

  if (variant === 'app') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F9FBFE] px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(18,58,115,0.12)] ring-1 ring-slate-200/80">
          <img src="/app_icon.png" alt="" className="h-11 w-11 object-contain" />
        </div>
        <p className="mt-5 text-[15px] font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="portal-splash-bar h-full w-1/2 rounded-full bg-[#123A73]" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-[100dvh] w-screen grid-cols-1 overflow-hidden bg-[#F9FBFE] lg:grid-cols-[minmax(0,1fr)_minmax(400px,28rem)]">
      <section className="relative hidden min-w-0 bg-[#C9E4F4] lg:block">
        <div className="portal-splash-shimmer absolute inset-0 bg-[linear-gradient(110deg,#C9E4F4_0%,#E8F4FC_45%,#C9E4F4_90%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,58,115,0.08)_0%,transparent_55%)]" />
      </section>

      <section className="relative flex h-full flex-col bg-[#F9FBFE] px-8 pt-16 sm:px-12">
        <div className="mx-auto w-full max-w-[360px] flex-1 flex flex-col justify-center pb-24">
          <div className="mx-auto h-[168px] w-[140px] animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="mx-auto mt-5 h-4 w-40 animate-pulse rounded-full bg-slate-200/70" />
          <div className="mt-10 space-y-3.5">
            <div className="h-[52px] animate-pulse rounded-full bg-slate-200/60" />
            <div className="h-[52px] animate-pulse rounded-full bg-slate-200/60" />
            <div className="h-[52px] animate-pulse rounded-full bg-[#123A73]/25" />
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-[13px] text-slate-500">
            <span className="portal-splash-spinner h-4 w-4 rounded-full border-2 border-slate-300 border-t-[#123A73]" />
            <span>{subtitle}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** Decorative images — prefetch only, never block the login form. */
export function prefetchLoginDecor(logoSrc: string) {
  const logo = logoSrc || '/app_logo.png';
  void preloadImage('/login-hero.jpg');
  void preloadImage('/login-skyline.png');
  void preloadImage(logo);
}

/** @deprecated Use prefetchLoginDecor; login UI no longer waits on this. */
export function ensureLoginAssets(logoSrc: string): Promise<void> {
  prefetchLoginDecor(logoSrc);
  return Promise.resolve();
}
