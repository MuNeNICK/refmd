"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/config';
import { Music } from 'lucide-react';

interface AuthenticatedAudioProps {
  src: string;
  documentId?: string;
  token?: string;
  className?: string;
}

export function AuthenticatedAudio({ src, documentId, token, className }: AuthenticatedAudioProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        setLoading(true);
        setError(false);

        // If it's an external URL, use it directly
        if (src.startsWith('http://') || src.startsWith('https://')) {
          setAudioUrl(src);
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

        // Fetch the audio file
        const response = await fetch(fetchUrl, {
          headers: accessToken ? {
            'Authorization': `Bearer ${accessToken}`
          } : {}
        });

        if (!response.ok) {
          throw new Error('Failed to load audio');
        }

        // Create blob URL for the audio
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setAudioUrl(url);
      } catch (err) {
        console.error('Error loading audio:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadAudio();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [src, documentId, token]);

  if (loading) {
    return (
      <div className="w-full h-12 flex items-center gap-2 p-2 bg-muted rounded">
        <Music className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-6 flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-12 flex items-center gap-2 p-2 bg-destructive/10 rounded">
        <Music className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">Failed to load audio</span>
      </div>
    );
  }

  return (
    <audio
      controls
      className={className || "w-full"}
      src={audioUrl || undefined}
    >
      Your browser does not support the audio element.
    </audio>
  );
}