"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { PublicDocumentResponse } from '@/lib/api/client';
import { Markdown } from '@/components/markdown/markdown';
import { CollapsibleToc } from '@/components/editor/table-of-contents-collapsible';
import { Menu, X } from 'lucide-react';
import { PublicPageLayout } from './PublicPageLayout';
import { formatPublicDate } from '@/lib/utils/date';
import { Button } from '@/components/ui/button';

interface PublicDocumentPageProps {
  document: PublicDocumentResponse;
}

export function PublicDocumentPage({ document }: PublicDocumentPageProps) {
  const [showToc, setShowToc] = useState(false);
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
              <Markdown content={document.content || ''} isPublic={true} />
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
    </PublicPageLayout>
  );
}