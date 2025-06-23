"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/config';
import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [numPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
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

  const handleDownload = async () => {
    if (!pdfUrl) return;
    
    try {
      // Extract filename from src
      let filename = 'document.pdf';
      if (src.startsWith('./attachments/')) {
        filename = src.substring(14);
      } else if (src.startsWith('./')) {
        filename = src.substring(2);
      } else if (src.includes('/')) {
        const segments = src.split('/');
        filename = segments[segments.length - 1];
      }
      
      // Decode if needed
      try {
        filename = decodeURIComponent(filename);
      } catch {
        // Use original if decode fails
      }
      
      // Create download link
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

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
        {/* PDF Controls */}
        <div className="flex items-center justify-between p-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} {numPages > 0 && `of ${numPages}`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setScale(Math.min(2, scale + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
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