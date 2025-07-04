"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from "react";
import Image from "next/image";
import { CodeBlock } from '@/components/markdown/code-block';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import type { ViewMode } from "@/components/layout/header";
import { CollapsibleToc } from "@/components/editor/table-of-contents-collapsible";
import { generateHeadingId } from "@/lib/utils/heading-id";
import { CsvPreview } from "@/components/markdown/csv-preview";
import dynamic from 'next/dynamic';
import { PlantUMLDiagram } from "@/components/markdown/plantuml-diagram";
import { FileAttachment } from "@/components/markdown/file-attachment";
import { AuthenticatedImage } from "@/components/markdown/authenticated-image";
import { WikiLink } from "@/components/markdown/wiki-link";
import { getApiUrl } from "@/lib/config";
import { ImageModal } from "@/components/ui/image-modal";

// Stable references for dynamic imports
const MermaidDiagram = dynamic(() => import("@/components/markdown/mermaid-diagram").then(mod => ({ default: mod.MermaidDiagram })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-muted h-32 rounded-md" />
});

const SafeMarkdown = dynamic(() => import("@/components/markdown/markdown").then(mod => ({ default: mod.Markdown })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-muted h-32 rounded-md" />
});

interface PreviewPaneProps {
  content: string;
  onScroll?: (scrollTop: number, scrollPercentage: number) => void;
  scrollPercentage?: number;
  documentId?: string;
  viewMode?: ViewMode;
  previewRef?: React.RefObject<HTMLDivElement>;
  contentStats?: { wordCount: number; charCount: number };
  token?: string;
  onCheckboxChange?: (lineIndex: number, checked: boolean) => void;
  isSecondaryViewer?: boolean;
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void;
  onTagClick?: (tagName: string) => void;
  className?: string;
  forceFloatingToc?: boolean;
}

function PreviewPaneComponent({ 
  content, 
  onScroll,
  scrollPercentage,
  documentId,
  viewMode = "preview",
  previewRef,
  token,
  onCheckboxChange,
  isSecondaryViewer = false,
  onNavigate,
  onTagClick,
  className,
  forceFloatingToc = false
}: PreviewPaneProps) {
  const [showFloatingToc, setShowFloatingToc] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modalImage, setModalImage] = useState<{ src: string; alt?: string } | null>(null);
  const scrollRafId = useRef<number | null>(null);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const floatingTocRef = useRef<HTMLDivElement>(null);
  
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Create heading components with automatic IDs for tocbot
  const createHeadingComponent = useCallback((level: number) => {
    const HeadingComponent = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => {
      const extractText = (node: React.ReactNode): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (React.isValidElement(node) && (node.props as Record<string, unknown>)?.children) return extractText((node.props as Record<string, unknown>).children as React.ReactNode);
        return '';
      };
      
      const text = extractText(children).trim();
      const id = generateHeadingId(text);
      const Tag = `h${level}` as const;
      
      return React.createElement(Tag, { id, ...props }, children);
    };
    HeadingComponent.displayName = `Heading${level}`;
    return HeadingComponent;
  }, []);
  
  const headingComponents = useMemo(() => {
    return {
      h1: createHeadingComponent(1),
      h2: createHeadingComponent(2),
      h3: createHeadingComponent(3),
      h4: createHeadingComponent(4),
      h5: createHeadingComponent(5),
      h6: createHeadingComponent(6),
    };
  }, [createHeadingComponent]);
  
  // Memoize the markdown components to prevent recreation on every render
  const markdownComponents = useMemo(() => ({
    img: ({ src, alt, width, height, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
      if (!src) return null;
      
      let imageSrc = src as string;
      
      // Handle empty or placeholder URLs
      if (imageSrc === '' || imageSrc === 'url' || imageSrc === '()') {
        return (
          <span className="inline-flex items-center justify-center bg-muted text-muted-foreground text-xs p-4 rounded-md">
            [Please enter image URL]
          </span>
        );
      }
      const apiUrl = getApiUrl();
      
      if (imageSrc.startsWith('./attachments/')) {
        // Handle new relative path format: ./attachments/{filename}
        const filename = imageSrc.substring(14); // Remove './attachments/'
        // Don't encode if already encoded (contains %)
        const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
        imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
        if (documentId) {
          imageSrc += `?document_id=${documentId}`;
        }
      } else if (imageSrc.startsWith('./')) {
        // Handle legacy relative paths
        const filename = imageSrc.substring(2);
        // Don't encode if already encoded (contains %)
        const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
        imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
        if (documentId) {
          imageSrc += `?document_id=${documentId}`;
        }
      } else if (imageSrc.startsWith('/api/')) {
        // Convert relative API path to absolute URL
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
            token={token}
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
    a: ({ href, className, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const extendedProps = props as Record<string, unknown>;
      
      
      // Check if this is a hashtag link
      const isHashtagByClass = className?.includes('hashtag');
      const isHashtagByHref = href?.startsWith('#tag-');
      const hasDataTag = !!(extendedProps['data-tag'] || extendedProps['dataTag']);
      
      if (isHashtagByClass || isHashtagByHref || hasDataTag) {
        let tagName = '';
        
        // Try to get tag name from data attributes first
        if (extendedProps['data-tag']) {
          tagName = String(extendedProps['data-tag']);
        } else if (extendedProps['dataTag']) {
          tagName = String(extendedProps['dataTag']);
        }
        
        // Extract tag name from href if not in data attributes
        if (!tagName && href?.startsWith('#tag-')) {
          const match = href.match(/#tag-(.+)/);
          if (match) {
            tagName = decodeURIComponent(match[1]);
          }
        }
        
        // Extract tag name from children if it's a hashtag
        if (!tagName && typeof children === 'string' && children.startsWith('#')) {
          tagName = children.substring(1);
        }
        
        if (!tagName) {
          return (
            <a href={href} className={className} {...props}>
              {children}
            </a>
          );
        }
        
        return (
          <a 
            href={`/search?tag=${encodeURIComponent(tagName)}`} 
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors no-underline"
            onClick={(e) => {
              e.preventDefault();
              if (onTagClick) {
                onTagClick(tagName);
              }
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      
      // Check if this is a wiki link or mention link
      const isWikiLink = href?.startsWith('#wiki:');
      const isMentionLink = href?.startsWith('#mention:');
      
      if (isWikiLink || isMentionLink) {
        // Extract target from URL
        let target = '';
        if (isWikiLink && href) {
          target = decodeURIComponent(href.replace('#wiki:', ''));
        } else if (isMentionLink && href) {
          target = decodeURIComponent(href.replace('#mention:', ''));
        }
        
        return (
          <WikiLink 
            href={href || '#'} 
            data-wiki-target={isWikiLink ? target : undefined}
            data-mention-target={isMentionLink ? target : undefined}
            onNavigate={onNavigate}
            {...props}
          >
            {children}
          </WikiLink>
        );
      }
      
      // For non-wiki links, use FileAttachment as before
      return (
        <FileAttachment href={href || '#'} documentId={documentId} token={token} {...props}>
          {children}
        </FileAttachment>
      );
    },
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
      // Check if the paragraph contains only an image or file attachment
      const childArray = React.Children.toArray(children);
      const hasOnlyImageOrFile = childArray.length === 1 && 
        React.isValidElement(childArray[0]) && 
        (childArray[0].type === 'img' || 
         childArray[0].type === AuthenticatedImage ||
         childArray[0].type === FileAttachment ||
         (typeof childArray[0].type === 'function' && 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((childArray[0].type as any).displayName === 'AuthenticatedImage' ||
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           (childArray[0].type as any).displayName === 'FileAttachment')) ||
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         (childArray[0].props && ((childArray[0].props as any).src || (childArray[0].props as any).href)));
      
      // If paragraph contains only an image or file attachment, render as div to avoid hydration errors
      if (hasOnlyImageOrFile) {
        return <div className="my-4" {...props}>{children}</div>;
      }
      
      return <p {...props}>{children}</p>;
    },
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
      const inline = !className;
      const match = /language-(\w+)(=(\+)?(\d+)?)?/.exec(className || '');
      
      if (match && match[1] === 'csvpreview') {
        const fullClassName = className || '';
        const optionsMatch = fullClassName.match(/\{([^}]+)\}/);
        const options = optionsMatch ? optionsMatch[1] : '';
        return <CsvPreview content={String(children)} options={options} />;
      }
      
      if (match && match[1] === 'mermaid') {
        return <MermaidDiagram content={String(children)} />;
      }
      
      if (match && match[1] === 'plantuml') {
        return <PlantUMLDiagram code={String(children)} />;
      }
      
      return !inline && match ? (
        <CodeBlock language={match[1]}>
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table: ({ ...props }) => (
      <div className="overflow-x-auto mb-4 -mx-4 px-4">
        <table className="table-auto" {...props} />
      </div>
    ),
    ...headingComponents,
  }), [documentId, token, onTagClick, onNavigate, headingComponents]);

  // Handle click outside for floating TOC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFloatingToc && 
          floatingTocRef.current && 
          !floatingTocRef.current.contains(event.target as Node) &&
          tocButtonRef.current &&
          !tocButtonRef.current.contains(event.target as Node)) {
        setShowFloatingToc(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFloatingToc]);

  const localPreviewRef = useRef<HTMLDivElement>(null);
  const actualPreviewRef = previewRef || localPreviewRef;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (onScroll) {
      // Cancel previous animation frame
      if (scrollRafId.current !== null) {
        cancelAnimationFrame(scrollRafId.current);
      }
      
      // Throttle with requestAnimationFrame
      scrollRafId.current = requestAnimationFrame(() => {
        const target = e.target as HTMLDivElement;
        const scrollHeight = target.scrollHeight;
        const clientHeight = target.clientHeight;
        const scrollPercentage = target.scrollTop / (scrollHeight - clientHeight);
        onScroll(target.scrollTop, scrollPercentage);
        scrollRafId.current = null;
      });
    }
  }, [onScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollRafId.current !== null) {
        cancelAnimationFrame(scrollRafId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (scrollPercentage !== undefined && actualPreviewRef.current) {
      const scrollHeight = actualPreviewRef.current.scrollHeight;
      const clientHeight = actualPreviewRef.current.clientHeight;
      const scrollTop = scrollPercentage * (scrollHeight - clientHeight);
      actualPreviewRef.current.scrollTop = scrollTop;
    }
  }, [scrollPercentage, actualPreviewRef]);

  return (
    <div className={cn("h-full bg-background relative overflow-hidden flex flex-col", className)}>
      <div className="flex-1 overflow-auto" ref={actualPreviewRef} onScroll={handleScroll}>
        <div className={cn(
          "w-full mx-auto flex gap-8 p-4 sm:p-6 md:p-8",
          viewMode === "preview" && "max-w-6xl"
        )}>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className={cn(
              "prose prose-neutral dark:prose-invert markdown-preview break-words overflow-wrap-anywhere",
              viewMode === "preview" ? "max-w-3xl mx-auto" : "max-w-none",
              isSecondaryViewer && "markdown-preview-secondary"
            )}>
              {useMemo(() => {
                try {
                  return (
                    <SafeMarkdown 
                      key={documentId || 'preview'}
                      content={content}
                      onCheckboxChange={onCheckboxChange}
                      onTagClick={onTagClick}
                      components={markdownComponents}
                    />
                  );
                } catch {
                  return <div>Error rendering markdown</div>;
                }
              }, [content, markdownComponents, onCheckboxChange, onTagClick])}
            </div>
          </div>
          {/* Table of Contents - only show in preview mode on desktop when not forced to floating */}
          {viewMode === "preview" && !isMobile && !isSecondaryViewer && !forceFloatingToc && (
            <aside className="w-64 shrink-0 hidden lg:block">
              <CollapsibleToc 
                contentSelector=".markdown-preview:not(.markdown-preview-secondary)" 
                containerRef={actualPreviewRef as React.RefObject<HTMLElement>} 
              />
            </aside>
          )}
        </div>
      </div>
      
      {/* Floating TOC button - show when appropriate */}
      {(viewMode === "split" || (viewMode === "preview" && isMobile) || isSecondaryViewer || forceFloatingToc) && (
          <Button
            ref={tocButtonRef}
            onClick={() => setShowFloatingToc(!showFloatingToc)}
            className="absolute bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all z-40"
            title="Table of Contents"
            size="icon"
          >
            <Menu className="h-5 w-5" />
          </Button>
      )}
          
          {/* Floating TOC window */}
          {showFloatingToc && (
            <div 
              ref={floatingTocRef}
              className="absolute bottom-20 right-6 w-[300px] max-w-[calc(100%-3rem)] bg-background border rounded-lg shadow-xl z-40"
            >
              <div className="flex items-center justify-between p-2 border-b">
                <h3 className="text-xs font-semibold pr-4">Table of Contents</h3>
                <Button
                  onClick={() => setShowFloatingToc(false)}
                  className="p-0.5 h-auto w-auto hover:bg-accent rounded-md transition-colors flex-shrink-0"
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="max-h-[60vh]">
                <CollapsibleToc 
                  contentSelector={isSecondaryViewer ? ".markdown-preview-secondary" : ".markdown-preview:not(.markdown-preview-secondary)"}
                  containerRef={actualPreviewRef as React.RefObject<HTMLElement>}
                  onItemClick={() => setShowFloatingToc(false)}
                  small={true}
                />
              </div>
            </div>
          )}
      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          isOpen={!!modalImage}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}

// Export memoized component
export const PreviewPane = memo(PreviewPaneComponent, (prevProps, nextProps) => {
  // Custom comparison function for optimization
  return (
    prevProps.content === nextProps.content &&
    prevProps.scrollPercentage === nextProps.scrollPercentage &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.documentId === nextProps.documentId &&
    prevProps.contentStats?.wordCount === nextProps.contentStats?.wordCount &&
    prevProps.contentStats?.charCount === nextProps.contentStats?.charCount &&
    prevProps.onCheckboxChange === nextProps.onCheckboxChange &&
    prevProps.isSecondaryViewer === nextProps.isSecondaryViewer &&
    prevProps.onNavigate === nextProps.onNavigate &&
    prevProps.onTagClick === nextProps.onTagClick &&
    prevProps.className === nextProps.className &&
    prevProps.forceFloatingToc === nextProps.forceFloatingToc
  );
});