"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/config';
import { FileText } from 'lucide-react';

interface AuthenticatedPdfProps {
  src: string;
  documentId?: string;
  token?: string;
  className?: string;
}

export function AuthenticatedPdf({ src, documentId, token, className }: AuthenticatedPdfProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const [currentPage] = useState<number>(1);
  const [scale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(false);

        // If it's an external URL, use it directly
        if (src.startsWith('http://') || src.startsWith('https://')) {
          setPdfUrl(src);
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

        // Fetch the PDF file
        const response = await fetch(fetchUrl, {
          headers: accessToken ? {
            'Authorization': `Bearer ${accessToken}`
          } : {}
        });

        if (!response.ok) {
          throw new Error('Failed to load PDF');
        }

        // Create blob URL for the PDF
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [src, documentId, token]);


  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted rounded">
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-destructive/10 rounded">
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-8 w-8 text-destructive" />
          <span className="text-sm text-destructive">Failed to load PDF</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className || "w-full"}>
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* PDF Viewer */}
        <div ref={containerRef} className="w-full h-[600px] overflow-auto bg-muted/20">
          <iframe
            src={`${pdfUrl}#page=${currentPage}&zoom=${scale * 100}`}
            className="w-full h-full border-0"
            title="PDF Viewer"
            onLoad={(e) => {
              // Try to get page count from PDF (this might not work in all browsers)
              try {
                const iframe = e.target as HTMLIFrameElement;
                const pdfDoc = iframe.contentWindow?.document;
                // This is a simplified approach - in production you might want to use PDF.js
                console.log('PDF loaded', pdfDoc);
              } catch (err) {
                console.log('Could not access PDF document', err);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}