"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/config';
import { Film } from 'lucide-react';

interface AuthenticatedVideoProps {
  src: string;
  documentId?: string;
  token?: string;
  className?: string;
}

export function AuthenticatedVideo({ src, documentId, token, className }: AuthenticatedVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(false);

        // If it's an external URL, use it directly
        if (src.startsWith('http://') || src.startsWith('https://')) {
          setVideoUrl(src);
          setLoading(false);
          return;
        }

        // Convert relative paths to API paths
        const apiBaseUrl = getApiUrl();
        let fetchUrl = src;
        
        if (src.startsWith('./attachments/')) {
          const filename = src.substring(14);
          // Only encode if not already encoded (doesn't contain %)
          const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
          fetchUrl = `${apiBaseUrl}/files/documents/${encodedFilename}`;
          if (documentId) {
            fetchUrl += `?document_id=${documentId}`;
          }
        } else if (src.startsWith('./')) {
          const filename = src.substring(2);
          // Only encode if not already encoded (doesn't contain %)
          const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
          fetchUrl = `${apiBaseUrl}/files/documents/${encodedFilename}`;
          if (documentId) {
            fetchUrl += `?document_id=${documentId}`;
          }
        } else if (src.startsWith('/api/')) {
          fetchUrl = src.replace('/api/', `${apiBaseUrl}/`);
        }

        // If there's a share token, append it
        if (token) {
          const separator = fetchUrl.includes('?') ? '&' : '?';
          fetchUrl = `${fetchUrl}${separator}token=${token}`;
        }

        // Get auth token
        const { getTokens } = await import('@/lib/api');
        const { accessToken } = getTokens();

        // Fetch the video file
        const response = await fetch(fetchUrl, {
          headers: accessToken ? {
            'Authorization': `Bearer ${accessToken}`
          } : {}
        });

        if (!response.ok) {
          throw new Error('Failed to load video');
        }

        // Create blob URL for the video
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setVideoUrl(url);
      } catch (err) {
        console.error('Error loading video:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadVideo();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [src, documentId, token]);

  if (loading) {
    return (
      <div className="w-full aspect-video flex items-center justify-center bg-muted rounded">
        <div className="flex flex-col items-center gap-2">
          <Film className="h-8 w-8 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full aspect-video flex items-center justify-center bg-destructive/10 rounded">
        <div className="flex flex-col items-center gap-2">
          <Film className="h-8 w-8 text-destructive" />
          <span className="text-sm text-destructive">Failed to load video</span>
        </div>
      </div>
    );
  }

  return (
    <video
      controls
      className={className || "w-full rounded"}
      src={videoUrl || undefined}
    >
      Your browser does not support the video element.
    </video>
  );
}