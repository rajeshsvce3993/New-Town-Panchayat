import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-slate-300 tracking-tight">404</h1>
          <h2 className="text-2xl font-bold text-slate-800">Page Not Found</h2>
          <p className="text-slate-500 max-w-sm mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div>
          <Link 
            href="/" 
            className="inline-block px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-colors duration-200"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
