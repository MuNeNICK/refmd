"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from "react";
import Image from "next/image";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
import { getApiUrl } from "@/lib/config";

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
}

function PreviewPaneComponent({ 
  content, 
  onScroll,
  scrollPercentage,
  documentId,
  viewMode = "preview",
  previewRef,
  contentStats
}: PreviewPaneProps) {
  const [showFloatingToc, setShowFloatingToc] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
      const target = e.target as HTMLDivElement;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const scrollPercentage = target.scrollTop / (scrollHeight - clientHeight);
      onScroll(target.scrollTop, scrollPercentage);
    }
  }, [onScroll]);

  useEffect(() => {
    if (scrollPercentage !== undefined && actualPreviewRef.current) {
      const scrollHeight = actualPreviewRef.current.scrollHeight;
      const clientHeight = actualPreviewRef.current.clientHeight;
      const scrollTop = scrollPercentage * (scrollHeight - clientHeight);
      actualPreviewRef.current.scrollTop = scrollTop;
    }
  }, [scrollPercentage, actualPreviewRef]);

  return (
    <div className="h-full bg-background relative overflow-hidden flex flex-col">
      {/* Floating content stats for split mode */}
      {viewMode === "split" && contentStats && (
        <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 border shadow-sm">
          <div className="text-sm text-muted-foreground">
            <span>{contentStats.wordCount} words</span>
            <span className="mx-2">•</span>
            <span>{contentStats.charCount} characters</span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto" ref={actualPreviewRef} onScroll={handleScroll}>
        <div className={cn(
          "max-w-full mx-auto flex gap-8 p-8"
        )}>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="prose prose-neutral dark:prose-invert max-w-none markdown-preview break-words overflow-wrap-anywhere">
              {useMemo(() => {
                try {
                  return (
                    <SafeMarkdown 
                      content={content}
                      components={{
                        img: ({ src, alt, width, height, ...props }) => {
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
                                src={imageSrc}
                                alt={alt || ""}
                                width={typeof width === 'number' ? width : undefined}
                                height={typeof height === 'number' ? height : undefined}
                                className="max-w-full h-auto rounded-md shadow-md"
                                style={{ width: 'auto', height: 'auto' }}
                              />
                            );
                          }
                          
                          // Use regular Image component for external images
                          return (
                            <Image
                              src={imageSrc}
                              alt={alt || ""}
                              width={typeof width === 'number' ? width : 800}
                              height={typeof height === 'number' ? height : 600}
                              className="max-w-full h-auto rounded-md shadow-md"
                              style={{ width: 'auto', height: 'auto' }}
                              unoptimized={typeof imageSrc === 'string' && (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:'))}
                              {...props}
                            />
                          );
                        },
                        a: ({ href, children, ...props }) => (
                          <FileAttachment href={href || '#'} documentId={documentId} {...props}>
                            {children}
                          </FileAttachment>
                        ),
                        p: ({ children, ...props }) => {
                          // Check if the paragraph contains only an image
                          const childArray = React.Children.toArray(children);
                          const hasOnlyImage = childArray.length === 1 && 
                            React.isValidElement(childArray[0]) && 
                            (childArray[0].type === 'img' || 
                             childArray[0].type === AuthenticatedImage ||
                             (typeof childArray[0].type === 'function' && 
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (childArray[0].type as any).displayName === 'AuthenticatedImage') ||
                             // eslint-disable-next-line @typescript-eslint/no-explicit-any
                             (childArray[0].props && (childArray[0].props as any).src));
                          
                          // If paragraph contains only an image, render as div to avoid hydration errors
                          if (hasOnlyImage) {
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
                            <SyntaxHighlighter
                              language={match[1]}
                              style={oneDark}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                padding: 0,
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                backgroundColor: 'transparent'
                              }}
                              codeTagProps={{
                                style: {
                                  textShadow: 'none',
                                  fontFamily: 'inherit',
                                  backgroundColor: 'transparent',
                                  padding: 0,
                                  margin: 0
                                }
                              }}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
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
                      }}
                    />
                  );
                } catch {
                  return <div>Error rendering markdown</div>;
                }
              }, [content, headingComponents, documentId])}
            </div>
          </div>
          {/* Table of Contents - only show in preview mode, not in split mode */}
          {viewMode === "preview" && (
            <aside className="w-64 shrink-0 hidden lg:block">
              <CollapsibleToc contentSelector=".markdown-preview" containerRef={actualPreviewRef as React.RefObject<HTMLElement>} />
            </aside>
          )}
        </div>
      </div>
      
      {/* Floating TOC button - show in split mode or on mobile in preview mode */}
      {(viewMode === "split" || (viewMode === "preview" && isMobile)) && (
          <Button
            ref={tocButtonRef}
            onClick={() => setShowFloatingToc(!showFloatingToc)}
            className="fixed bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all z-50"
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
              className="fixed bottom-20 right-6 max-w-[90vw] bg-background border rounded-lg shadow-xl z-50"
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
                  contentSelector=".markdown-preview"
                  containerRef={actualPreviewRef as React.RefObject<HTMLElement>}
                  onItemClick={() => setShowFloatingToc(false)}
                  small={true}
                />
              </div>
            </div>
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
    prevProps.contentStats?.charCount === nextProps.contentStats?.charCount
  );
});