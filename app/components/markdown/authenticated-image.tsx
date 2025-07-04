'use client';

import { useState, useEffect, memo } from 'react';
import { getTokens } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageModal } from '@/components/ui/image-modal';

// Global cache for loaded images
const imageCache = new Map<string, string>();

interface AuthenticatedImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  token?: string;
}

function AuthenticatedImageComponent({ 
  src, 
  alt = '', 
  className = '', 
  width,
  height,
  style = {},
  token
}: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      try {
        // Create cache key from src and token
        const cacheKey = `${src}${token ? `?token=${token}` : ''}`;
        
        // Check if image is already cached
        const cachedUrl = imageCache.get(cacheKey);
        if (cachedUrl) {
          if (!cancelled) {
            setImageSrc(cachedUrl);
            setLoading(false);
          }
          return;
        }
        
        const { accessToken } = getTokens();
        
        // If there's a share token, append it to the URL
        let fetchUrl = src;
        if (token) {
          const separator = src.includes('?') ? '&' : '?';
          fetchUrl = `${src}${separator}token=${token}`;
        }
        
        const response = await fetch(fetchUrl, {
          headers: accessToken ? {
            'Authorization': `Bearer ${accessToken}`
          } : {}
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        // Cache the object URL
        imageCache.set(cacheKey, objectUrl);
        
        if (!cancelled) {
          setImageSrc(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [src, token]);

  if (loading) {
    return (
      <Skeleton 
        className={className}
        style={{ 
          width: width || '100px', 
          height: height || '100px',
          ...style 
        }}
      />
    );
  }

  if (error) {
    return (
      <span 
        className={`inline-flex items-center justify-center bg-muted text-muted-foreground text-xs ${className}`}
        style={{ 
          width: width || '100px', 
          height: height || '100px',
          ...style 
        }}
      >
        [Failed to load]
      </span>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} cursor-pointer transition-transform hover:scale-[1.02]`}
        width={width}
        height={height}
        style={style}
        onClick={() => setShowModal(true)}
      />
      <ImageModal
        src={imageSrc}
        alt={alt}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

AuthenticatedImageComponent.displayName = 'AuthenticatedImage';

// Memoize the component to prevent unnecessary re-renders
export const AuthenticatedImage = memo(AuthenticatedImageComponent);