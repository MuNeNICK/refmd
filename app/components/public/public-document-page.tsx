"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { PublicDocumentResponse } from '@/lib/api/client';
import { Markdown } from '@/components/markdown/markdown';
import { CollapsibleToc } from '@/components/editor/table-of-contents-collapsible';
import { Menu, X } from 'lucide-react';
import { PublicPageLayout } from './PublicPageLayout';
import { formatPublicDate } from '@/lib/utils/date';
import { Button } from '@/components/ui/button';
import { AuthenticatedImage } from '@/components/markdown/authenticated-image';
import Image from 'next/image';
import { ImageModal } from '@/components/ui/image-modal';

interface PublicDocumentPageProps {
  document: PublicDocumentResponse;
}

export function PublicDocumentPage({ document }: PublicDocumentPageProps) {
  const [showToc, setShowToc] = useState(false);
  const [modalImage, setModalImage] = useState<{ src: string; alt?: string } | null>(null);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const floatingTocRef = useRef<HTMLDivElement>(null);
  
  // Format dates
  const publishedDate = document.published_at ? formatPublicDate(document.published_at) : '';
  const updatedDate = document.updated_at ? formatPublicDate(document.updated_at) : '';
  
  // Handle click outside for floating TOC
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (showToc && 
          floatingTocRef.current && 
          !floatingTocRef.current.contains(event.target as Node) &&
          tocButtonRef.current &&
          !tocButtonRef.current.contains(event.target as Node)) {
        setShowToc(false);
      }
    };

    window.document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showToc]);
  
  // Custom components for markdown rendering
  const markdownComponents = useMemo(() => {
    const apiUrl = typeof window !== 'undefined' ? window.location.origin + '/api' : '/api';
    
    return {
      img: ({ src, alt, width, height, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
        if (!src || typeof src !== 'string') return null;
        
        let imageSrc = src;
        
        // Convert relative paths to API URLs
        if (imageSrc.startsWith('./attachments/')) {
          const filename = imageSrc.substring(14);
          const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
          imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
          if (document.id) {
            imageSrc += `?document_id=${document.id}`;
          }
        } else if (imageSrc.startsWith('./')) {
          const filename = imageSrc.substring(2);
          const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
          imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
          if (document.id) {
            imageSrc += `?document_id=${document.id}`;
          }
        } else if (imageSrc.startsWith('/api/')) {
          imageSrc = imageSrc.replace('/api/', `${apiUrl}/`);
        }
        
        // Use authenticated image for internal files
        if (imageSrc.includes('/api/files/')) {
          return (
            <AuthenticatedImage
              key={imageSrc}
              src={imageSrc}
              alt={alt || ""}
              width={typeof width === 'number' ? width : undefined}
              height={typeof height === 'number' ? height : undefined}
              className="max-w-full h-auto rounded-md shadow-md"
              style={{ width: 'auto', height: 'auto' }}
              isPublic={true}
            />
          );
        }
        
        // Use regular Image component for external images
        return (
          <Image
            key={imageSrc}
            src={imageSrc}
            alt={alt || ""}
            width={typeof width === 'number' ? width : 800}
            height={typeof height === 'number' ? height : 600}
            className="max-w-full h-auto rounded-md shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
            style={{ width: 'auto', height: 'auto' }}
            unoptimized={typeof imageSrc === 'string' && (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:'))}
            onClick={() => setModalImage({ src: imageSrc, alt: alt || undefined })}
            {...props}
          />
        );
      },
    };
  }, [document.id]);
  
  return (
    <PublicPageLayout 
      pageType="document"
      title={document.title}
      author={document.author}
      publishedDate={publishedDate}
      updatedDate={updatedDate}
    >

      {/* Main Content with TOC */}
      <div className="flex-1 relative">
        <div className="max-w-6xl mx-auto flex gap-8 px-4 sm:px-6 md:px-8 py-8">
          {/* Content area */}
          <article className="flex-1 min-w-0">
            <div className="prose prose-neutral dark:prose-invert max-w-none markdown-preview">
              <Markdown content={document.content || ''} isPublic={true} components={markdownComponents} />
            </div>
          </article>
          
          {/* Table of Contents - Desktop Sidebar */}
          <aside className="w-64 shrink-0 hidden lg:block sticky top-20 self-start">
            <CollapsibleToc 
              contentSelector=".markdown-preview" 
            />
          </aside>
        </div>
      </div>
      
      {/* Floating TOC for Mobile */}
      <div className="lg:hidden">
        {/* Floating TOC button */}
        <Button
          ref={tocButtonRef}
          onClick={() => setShowToc(!showToc)}
          className="fixed bottom-6 right-6 rounded-full shadow-lg"
          size="icon"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Floating TOC window */}
        {showToc && (
          <div 
            ref={floatingTocRef}
            className="fixed bottom-20 right-6 max-w-[90vw] bg-white dark:bg-gray-800 border rounded-lg shadow-xl z-50"
          >
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="text-sm font-semibold">Table of Contents</h3>
              <Button
                onClick={() => setShowToc(false)}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <CollapsibleToc 
                contentSelector=".markdown-preview" 
                onItemClick={() => setShowToc(false)}
                small={true}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Image Modal */}
      <ImageModal
        src={modalImage?.src || ''}
        alt={modalImage?.alt}
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
      />
    </PublicPageLayout>
  );
}