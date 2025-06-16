'use client';

import { useState, useEffect } from 'react';
import { getTokens } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthenticatedImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}

function AuthenticatedImageComponent({ 
  src, 
  alt = '', 
  className = '', 
  width,
  height,
  style = {}
}: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      try {
        const { accessToken } = getTokens();
        
        const response = await fetch(src, {
          headers: accessToken ? {
            'Authorization': `Bearer ${accessToken}`
          } : {}
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        if (!cancelled) {
          setImageSrc(objectUrl);
          setLoading(false);
        }

        // Cleanup function to revoke the object URL
        return () => {
          URL.revokeObjectURL(objectUrl);
        };
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
  }, [src]);

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={style}
    />
  );
}

AuthenticatedImageComponent.displayName = 'AuthenticatedImage';

export const AuthenticatedImage = AuthenticatedImageComponent;