"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, Globe, ExternalLink, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { PublicDocumentResponse } from '@/lib/api/client';
import { Markdown } from '@/components/markdown/markdown';
import { CollapsibleToc } from '@/components/editor/table-of-contents-collapsible';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicDocumentPageProps {
  document: PublicDocumentResponse;
}

export function PublicDocumentPage({ document }: PublicDocumentPageProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const floatingTocRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Format dates consistently for SSR/client
  const publishedDate = document.published_at ? 
    new Date(document.published_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric'
    }) : '';
  const updatedDate = document.updated_at ?
    new Date(document.updated_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'  
    }) : '';
  
  // Track mounted state to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Initialize theme from localStorage or system preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemDark);
      
      setIsDarkMode(shouldBeDark);
      if (shouldBeDark) {
        window.document.documentElement.classList.add('dark');
      } else {
        window.document.documentElement.classList.remove('dark');
      }
    }
  }, []);
  
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
  
  const toggleTheme = () => {
    if (typeof window !== 'undefined') {
      const newDarkMode = !isDarkMode;
      setIsDarkMode(newDarkMode);
      
      if (newDarkMode) {
        window.document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        window.document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  };
  
  return (
    <>
      {/* Custom header for public documents - positioned outside MainLayout */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="text-xl font-bold text-primary hover:opacity-80"
              >
                RefMD
              </Link>
              <Badge variant="outline" className="gap-1">
                <Globe className="w-3 h-3" />
                Public Document
              </Badge>
            </div>
            
            {/* Center - Document Info */}
            <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-4">
              <div className="text-lg font-semibold truncate max-w-md">
                {document.title}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-xs">
                      {document.author?.name?.charAt(0) || document.author?.username?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <Link 
                    href={`/u/${document.author?.username}`}
                    className="font-medium hover:text-foreground"
                  >
                    {document.author?.name || document.author?.username}
                  </Link>
                </div>
                
                <Separator orientation="vertical" className="h-4" />
                
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Published {publishedDate}</span>
                </div>
                
                {publishedDate !== updatedDate && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span>Updated {updatedDate}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              
              <Button variant="outline" asChild>
                <Link href="/">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open RefMD
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Document Info */}
      <div className="md:hidden border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="space-y-3">
            <h1 className="text-xl font-bold tracking-tight">
              {document.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-xs">
                    {document.author?.name?.charAt(0) || document.author?.username?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <Link 
                  href={`/u/${document.author?.username}`}
                  className="font-medium hover:text-foreground"
                >
                  {document.author?.name || document.author?.username}
                </Link>
              </div>
              
              <Separator orientation="vertical" className="h-4" />
              
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Published {publishedDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with TOC - Match Preview Layout */}
      <div className="h-full bg-background relative overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <div className="w-full mx-auto flex gap-8 p-4 sm:p-6 md:p-8 max-w-6xl">
            {/* Content area */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto markdown-preview">
                {/* Document Content */}
                <Markdown content={document.content || ''} isPublic={true} />
                
                {/* Footer */}
                <footer className="mt-12 pt-8 border-t">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Created with</span>
                      <Link 
                        href="https://github.com/MuNeNICK/refmd" 
                        className="font-medium text-primary hover:opacity-80"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        RefMD
                      </Link>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Link 
                        href={`/u/${document.author?.username}`}
                        className="hover:text-foreground"
                      >
                        More from {document.author?.name || document.author?.username}
                      </Link>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
            
            {/* Table of Contents - Desktop Sidebar */}
            <aside className="w-64 shrink-0 hidden lg:block">
              <CollapsibleToc 
                contentSelector=".markdown-preview" 
                containerRef={containerRef}
              />
            </aside>
          </div>
        </div>
      </div>
      
      {/* Floating TOC for Mobile - Match Preview Style */}
      <div className="lg:hidden">
        {/* Floating TOC button */}
        <Button
          ref={tocButtonRef}
          onClick={() => setShowToc(!showToc)}
          className="fixed bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all z-50"
          title="Table of Contents"
          size="icon"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Floating TOC window */}
        {showToc && (
          <div 
            ref={floatingTocRef}
            className="fixed bottom-20 right-6 max-w-[90vw] bg-background border rounded-lg shadow-xl z-50"
          >
            <div className="flex items-center justify-between p-2 border-b">
              <h3 className="text-xs font-semibold pr-4">Table of Contents</h3>
              <Button
                onClick={() => setShowToc(false)}
                className="p-0.5 h-auto w-auto hover:bg-accent rounded-md transition-colors flex-shrink-0"
                variant="ghost"
                size="sm"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="max-h-[60vh]">
              <CollapsibleToc 
                contentSelector=".markdown-preview" 
                containerRef={containerRef}
                onItemClick={() => setShowToc(false)}
                small={true}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}