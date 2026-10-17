'use client';

import React, { useState, useEffect } from 'react';
import { imageCacheDB } from '@/lib/imageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: string;
  containerClassName?: string;
}

export default function CachedImage({ 
  src, 
  alt, 
  className, 
  fallback, 
  containerClassName = '', 
  ...props 
}: CachedImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorOccurred, setErrorOccurred] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let objectUrl = '';

    async function loadAndCacheImage() {
      if (!imageCacheDB) {
        if (isMounted) {
          setCurrentSrc(src);
          setLoading(false);
        }
        return;
      }

      try {
        // 1. Try to fetch from IndexedDB Local Cache
        const cachedBlob = await imageCacheDB.get(src);
        if (cachedBlob && isMounted) {
          objectUrl = URL.createObjectURL(cachedBlob);
          setCurrentSrc(objectUrl);
          setLoading(false);
          return;
        }

        // 2. Cache Miss - Fetch from network
        // Use server proxy if it's an external URL to avoid CORS blocks
        const isExternal = src.startsWith('http') && !src.includes(window.location.host);
        const fetchUrl = isExternal ? `/api/media?url=${encodeURIComponent(src)}` : src;

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        
        // 3. Save to IndexedDB
        await imageCacheDB.set(src, blob);

        if (isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setCurrentSrc(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.warn('CachedImage: fallback to direct src due to error:', err);
        if (isMounted) {
          setCurrentSrc(src);
          setLoading(false);
        }
      }
    }

    loadAndCacheImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (errorOccurred) return;
    setErrorOccurred(true);

    const target = e.currentTarget;
    if (!target.dataset.retried) {
      target.dataset.retried = 'true';
      target.src = `/api/media?url=${encodeURIComponent(src)}`;
    } else if (fallback) {
      target.src = fallback;
    }
    
    if (props.onError) {
      props.onError(e);
    }
  };

  return (
    <div className={`relative ${containerClassName}`}>
      {loading && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <span className="text-[10px] text-slate-400">Loading Cache...</span>
        </div>
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`${className || ''} transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onError={handleError}
          {...props}
        />
      )}
    </div>
  );
}
